import {
    addListenerAll,
    createHTMLFromString,
    createHook,
    elementData,
    htmlElement,
    isInstanceOf,
    subLocalize,
    templateLocalize,
} from "pf2e-api";
import { BaseActorContext, BaseActorHUD } from "./hud";
import { hud } from "./main";
import {
    ADJUSTMENTS,
    BaseActorData,
    HealthData,
    SHARED_PARTIALS,
    addArmorListeners,
    addSharedListeners,
    addUpdateActorFromInput,
    getCoverEffect,
    getDefaultData,
    getHealth,
} from "./shared";

const localize = subLocalize("persistent");

class PF2eHudPersistent extends BaseActorHUD<PersistentSettings, ActorType> {
    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));
    #renderHotbarHook = createHook("renderHotbar", this.#onRenderHotbar.bind(this));

    #actor: ActorType | null = null;

    #elements: Record<PartName | "left", HTMLElement | null> = {
        left: null,
        menu: null,
        portrait: null,
        main: null,
    };

    #parts: Parts = {
        main: {
            prepareContext: this.#prepareMainContext.bind(this),
            activateListeners: this.#activateMainListeners.bind(this),
        },
        menu: {
            prepareContext: this.#prepareMenuContext.bind(this),
            activateListeners: this.#activateMenuListeners.bind(this),
        },
        portrait: {
            prepareContext: this.#preparePortraitContext.bind(this),
            activateListeners: this.#activatePortraitListeners.bind(this),
        },
    };

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-persistent",
        window: {
            positioned: false,
        },
    };

    get partials() {
        return SHARED_PARTIALS;
    }

    get templates(): PartName[] {
        return ["portrait", "main", "menu"];
    }

    get key(): "persistent" {
        return "persistent";
    }

    get enabled(): boolean {
        return this.setting("enabled");
    }

    get useModifiers() {
        return this.setting("modifiers");
    }

    get settings(): SettingOptions<string>[] {
        return [
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: (value) => {
                    this.enable(value);
                },
            },
            {
                key: "selected",
                type: String,
                default: "",
                scope: "client",
                config: false,
            },
            {
                key: "modifiers",
                type: Boolean,
                default: false,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
        ];
    }

    get actor() {
        return this.#actor;
    }

    get mainElement() {
        return this.element;
    }

    get leftElement() {
        return this.#elements.left;
    }

    get portraitElement() {
        return this.#elements.portrait;
    }

    get menuElement() {
        return this.#elements.menu;
    }

    _onEnable(enabled: boolean = this.enabled) {
        this.#renderHotbarHook.toggle(enabled);
        this.#renderActorSheetHook.toggle(enabled);

        if (enabled) {
            const selected = this.setting("selected");

            let actor = fromUuidSync<ActorPF2e>(selected);

            if (!isInstanceOf<ActorPF2e>(actor, "ActorPF2e") || !isValidActor(actor)) {
                actor = (game.user as UserPF2e).character;
            }

            if (actor) this.setActor(actor);
            else this.render(true);
        } else {
            this.close({ forced: true });
        }
    }

    _configureRenderOptions(options: RenderOptions) {
        super._configureRenderOptions(options);

        const allowedParts = this.templates;

        if (!options.parts) options.parts = allowedParts;
        else options.parts?.filter((part) => allowedParts.includes(part));
    }

    async _prepareContext(options: PreparedRenderOptions): Promise<PersistentContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);

        return {
            ...parentData,
            isNPC: !!actor?.isOfType("npc"),
            isCharacter: !!actor?.isOfType("character"),
        };
    }

    async _renderHTML(
        context: PersistentContext,
        options: PreparedRenderOptions
    ): Promise<RenderedTemplates> {
        const actor = this.actor;
        if (!actor) return [];

        return Promise.all(
            options.parts.map(async (partName) => {
                const part = this.#parts[partName];
                const partContext = part.prepareContext(context);
                const template = await this.renderTemplate(partName, {
                    i18n: templateLocalize(`persistent.${partName}`),
                    ...partContext,
                });
                return { name: partName, element: createHTMLFromString(template) };
            })
        );
    }

    _insertElement(element: HTMLElement) {
        element.dataset.tooltipDirection = "UP";
        const existing = document.getElementById(element.id);
        if (existing) existing.replaceWith(element);
        else document.getElementById("ui-bottom")?.prepend(element);
    }

    _replaceHTML(
        templates: RenderedTemplates,
        content: HTMLElement,
        options: PreparedRenderOptions
    ) {
        content.dataset.actorUuid = this.actor?.uuid;

        if (!this.#elements.left) {
            this.#elements.left = createHTMLFromString("<div id='pf2e-hud-persistent-left'></div>");
            document.getElementById("ui-left")?.append(this.#elements.left);
        }

        for (const { name, element } of templates) {
            const oldElement = this.#elements[name];
            const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

            if (oldElement) {
                oldElement.replaceWith(element);
            } else if (name === "main") {
                content.append(element);
            } else if (name === "menu") {
                this.#elements.left.prepend(element);
            } else {
                this.#elements.left.append(element);
            }

            if (focusName) {
                element.querySelector<HTMLInputElement>(`input[name="${focusName}"]`)?.focus();
            }

            this.#elements[name] = element;
            this.#parts[name].activateListeners(element);
        }
    }

    async close(
        options?: ApplicationClosingOptions & { forced?: boolean }
    ): Promise<ApplicationV2> {
        if (!options?.forced) return this;

        this.setActor(false);

        for (const key in this.#elements) {
            this.#elements[key as PartName | "left"]?.remove();
            this.#elements[key as PartName | "left"] = null;
        }

        return super.close(options);
    }

    setActor(actor: ActorPF2e | null | false, token?: Token) {
        const skipRender = actor === false;

        actor ||= null;

        if (this.isCurrentActor(actor)) return;
        if (actor && !isValidActor(actor)) return;

        delete this.actor?.apps[this.id];

        if (actor) {
            actor.apps[this.id] = this;

            const tokens = token ? [token] : actor.getActiveTokens();

            for (const token of tokens) {
                if (hud.token.token === token) hud.token.close();
                if (hud.tooltip.token === token) hud.tooltip.close();
            }
        }

        this.#actor = actor;

        if (!skipRender) this.render(true);
    }

    #onRenderActorSheet(sheet: ActorSheetPF2e, $html: JQuery) {
        const actor = sheet.actor;
        if (!isValidActor(actor)) return;

        const html = htmlElement($html);
        const titleElement = html
            .closest(".window-app")
            ?.querySelector(".window-header .window-title");
        if (!titleElement) return;

        const existing = titleElement.querySelector(".document-id-link.persistent");
        const tooltip = localize("portrait.selectActor");
        const btn = createHTMLFromString(
            `<a class="document-id-link persistent" data-tooltip="${tooltip}" data-tooltip-direction="UP">
                <i class='fa-solid fa-user-vneck'></i>
            </a>`
        );

        btn.addEventListener("click", () => this.setActor(actor));

        if (existing) existing.replaceWith(btn);
        else titleElement.append(btn);
    }

    #onRenderHotbar() {
        this.render({ parts: ["menu"] });
    }

    #prepareMenuContext(context: PersistentContext): MenuContext {
        return {
            ...context,
            hotbarLocked: ui.hotbar.locked,
        };
    }

    #activateMenuListeners(html: HTMLElement) {
        const actor = this.actor;
        const menuElement = this.menuElement;
        if (!menuElement) return;

        addListenerAll(menuElement, "[data-action]", (event, el) => {
            const action = elementData<{ action: MenuActionEvent }>(el).action;

            switch (action) {
                case "toggle-users": {
                    this.leftElement?.classList.toggle("show-users");
                    break;
                }
                case "open-macros": {
                    ui.macros.renderPopout(true);
                    break;
                }
                case "toggle-hotbar-lock": {
                    ui.hotbar._toggleHotbarLock();
                    break;
                }
                case "open-sheet": {
                    actor?.sheet.render(true);
                    break;
                }
                case "select-actor": {
                    const tokens = canvas.tokens.controlled;
                    const token = tokens[0];
                    if (tokens.length !== 1 || !isValidActor(token.actor)) {
                        return localize.warn("error.selectOne");
                    }
                    this.setActor(token.actor, token);
                    break;
                }
            }
        });
    }

    #preparePortraitContext(context: PersistentContext): PortraitContext | PersistentContext {
        const actor = this.actor;
        if (!actor) return context;

        const isNPC = actor.isOfType("npc");
        const isCharacter = actor.isOfType("character");

        const data: PortraitContext = {
            ...context,
            avatar: actor.img,
            name: actor.name,
            health: getHealth(actor)!,
            hasCover: !!getCoverEffect(actor),
            ac: actor.attributes.ac.value,
            resolve: isCharacter ? actor.system.resources.resolve : undefined,
            shield: actor.attributes.shield,
            adjustment:
                (isNPC && ADJUSTMENTS[actor.attributes.adjustment ?? "normal"]) || undefined,
        };

        return data;
    }

    #activatePortraitListeners(html: HTMLElement) {
        const actor = this.actor;
        const portraitElement = this.portraitElement;
        if (!actor || !portraitElement) return;

        addUpdateActorFromInput(portraitElement, actor);
        addArmorListeners(portraitElement, actor);
    }

    #prepareMainContext(context: PersistentContext): MainContext | PersistentContext {
        const actor = this.actor;
        if (!actor) return context;

        const defaultData = getDefaultData(actor, this.useModifiers);

        return {
            ...context,
            ...defaultData,
            level: actor.level,
        };
    }

    #activateMainListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addSharedListeners(html, actor);
    }
}

function isValidActor(actor: Actor | null): actor is CharacterPF2e | NPCPF2e {
    return (actor as ActorPF2e).isOfType("character", "npc") && !!actor?.isOwner;
}

type ActionEvent = "raise-shield" | "take-cover";

type Part<TContext extends PersistentContext> = {
    prepareContext: (context: PersistentContext) => TContext | PersistentContext;
    activateListeners: (html: HTMLElement) => void;
};

type Parts = {
    menu: Part<MenuContext>;
    portrait: Part<PortraitContext>;
    main: Part<MainContext>;
};

type MenuContext = PersistentContext & {
    hotbarLocked: boolean;
};

type PortraitContext = PersistentContext & {
    ac: number;
    avatar: string;
    name: string;
    health: HealthData;
    resolve: ValueAndMax | undefined;
    adjustment: (typeof ADJUSTMENTS)[keyof typeof ADJUSTMENTS] | undefined;
    shield: HeldShieldData | undefined;
    hasCover: boolean;
};

type MainContext = PersistentContext &
    BaseActorData & {
        level: number;
    };

type PersistentContext = BaseActorContext & {
    isCharacter: boolean;
    isNPC: boolean;
};

type PartName = "menu" | "main" | "portrait";

type RenderOptions = ApplicationRenderOptions<PartName>;

type PreparedRenderOptions = Omit<RenderOptions, "parts"> & { parts: PartName[] };

type MenuActionEvent =
    | "toggle-users"
    | "open-macros"
    | "toggle-hotbar-lock"
    | "open-sheet"
    | "select-actor";

type RenderedTemplates = { name: PartName; element: HTMLElement }[];

type ActorType = CharacterPF2e | NPCPF2e;

type PersistentSettings = {
    enabled: boolean;
    selected: string;
    modifiers: boolean;
};

export { PF2eHudPersistent };
