import {
    addListener,
    addListenerAll,
    createHTMLFromString,
    createHook,
    elementData,
    htmlElement,
    isInstanceOf,
    localize,
    templateLocalize,
    warn,
} from "pf2e-api";
import { BaseActorContext, PF2eHudBaseActor, RenderOptionsHUD } from "./hud";
import { hud } from "./main";
import {
    AdvancedHealthData,
    BaseActorData,
    HealthData,
    SHARED_PARTIALS,
    addArmorListeners,
    addSharedListeners,
    addUpdateActorFromInput,
    getAdvancedData,
    getAdvancedHealthData,
    getDefaultData,
    getHealth,
} from "./shared";
import { PF2eHudSidebar, SidebarHUD, SidebarName } from "./sidebar";

class PF2eHudPersistent
    extends PF2eHudBaseActor<PersistentSettings, ActorType>
    implements SidebarHUD<PersistentSettings, PF2eHudPersistent>
{
    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));
    #renderHotbarHook = createHook("renderHotbar", this.#onRenderHotbar.bind(this));
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteActor.bind(this));
    #deleteActorHook = createHook("deleteActor", this.#onDeleteActor.bind(this));
    #updateUserHook = createHook("updateUser", this.#onUpdateUser.bind(this));

    #isUserCharacter: boolean = false;
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

    get fontSize() {
        return 14;
    }

    get hudKey(): "persistent" {
        return "persistent";
    }

    get enabled(): boolean {
        return this.setting("enabled");
    }

    get useModifiers() {
        return this.setting("modifiers");
    }

    get keybinds(): KeybindingActionConfig[] {
        return [
            {
                name: "setActor",
                onUp: () => this.#setSelectedToken(),
            },
        ];
    }

    get settings(): SettingOptions[] {
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
                onChange: () => {
                    this.render();
                },
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
            {
                key: "highestSpeed",
                type: Boolean,
                default: false,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "cleanPortrait",
                type: Boolean,
                default: false,
                scope: "client",
                config: false,
                onChange: (value) => {
                    this.render({ parts: ["menu"] });
                    this.portraitElement?.classList.toggle("cleaned", value);
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

    get sidebar(): PF2eHudSidebar<PersistentSettings, PF2eHudPersistent> | null {
        throw new Error("Method not implemented.");
    }

    _onEnable(enabled: boolean = this.enabled) {
        this.#renderHotbarHook.toggle(enabled);
        this.#renderActorSheetHook.toggle(enabled);
        this.#deleteTokenHook.toggle(enabled);
        this.#deleteActorHook.toggle(enabled);
        this.#updateUserHook.toggle(enabled);

        if (enabled) {
            const selected = this.setting("selected");

            let actor = fromUuidSync<ActorPF2e>(selected);

            if (!isInstanceOf<ActorPF2e>(actor, "ActorPF2e") || !isValidActor(actor)) {
                actor = (game.user as UserPF2e).character;
            }

            if (actor) this.setActor(actor, { skipSave: true });
            else this.render(true);
        } else {
            this.close({ forced: true });
        }
    }

    _configureRenderOptions(options: PersistentRenderOptions) {
        super._configureRenderOptions(options);

        options.hasSavedActor = !!this.setting("selected");
        options.cleaned = this.setting("cleanPortrait");

        const allowedParts = this.templates;
        if (!options.parts) options.parts = allowedParts;
        else options.parts?.filter((part) => allowedParts.includes(part));
    }

    async _prepareContext(options: PreparedRenderOptions): Promise<PersistentContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);

        const data: PersistentContext = {
            ...parentData,
            isNPC: !!actor?.isOfType("npc"),
            isCharacter: !!actor?.isOfType("character"),
        };

        return data;
    }

    async _renderHTML(
        context: PersistentContext,
        options: PreparedRenderOptions
    ): Promise<RenderedTemplates> {
        return Promise.all(
            options.parts.map(async (partName) => {
                const part = this.#parts[partName];
                const partContext = part.prepareContext(context, options);
                const template = await this.renderTemplate(partName, {
                    i18n: templateLocalize(`persistent.${partName}`),
                    ...partContext,
                });
                return { name: partName, element: createHTMLFromString(template) };
            })
        );
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

        for (let { name, element } of templates) {
            const oldElement = this.#elements[name];
            const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

            if (oldElement) {
                oldElement.replaceWith(element);
            } else if (name === "main") {
                content.replaceChildren(...element.children);
                element = content;
            } else if (name === "menu") {
                this.#elements.left.prepend(element);
            } else {
                this.#elements.left.append(element);
            }

            if (focusName) {
                element.querySelector<HTMLInputElement>(`input[name="${focusName}"]`)?.focus();
            }

            if (name !== "main") this.#elements[name] = element;
            this.#parts[name].activateListeners(element);
        }
    }

    _insertElement(element: HTMLElement) {
        element.dataset.tooltipDirection = "UP";
        const existing = document.getElementById(element.id);
        if (existing) existing.replaceWith(element);
        else document.getElementById("ui-bottom")?.prepend(element);
    }

    async close(
        options?: ApplicationClosingOptions & { forced?: boolean }
    ): Promise<ApplicationV2> {
        if (!options?.forced) return this;

        this.#actor = null;
        this.#isUserCharacter = false;

        for (const key in this.#elements) {
            this.#elements[key as PartName | "left"]?.remove();
            this.#elements[key as PartName | "left"] = null;
        }

        return super.close(options);
    }

    setActor(
        actor: ActorPF2e | null,
        { token, skipSave }: { token?: Token; skipSave?: boolean } = {}
    ) {
        if (actor && (this.isCurrentActor(actor) || !isValidActor(actor))) return;

        const savedActor = actor;
        delete this.actor?.apps[this.id];

        if (!actor) {
            const userActor = (game.user as UserPF2e).character;
            if (isValidActor(userActor)) actor = userActor;
        }

        if (actor) {
            actor.apps[this.id] = this;

            const tokens = token ? [token] : actor.getActiveTokens();

            for (const token of tokens) {
                if (hud.token.token === token) hud.token.close();
                if (hud.tooltip.token === token) hud.tooltip.close();
            }
        }

        this.#isUserCharacter = actor === game.user.character;
        this.#actor = actor as ActorType;

        if (skipSave) this.render(!!actor);
        else this.setSetting("selected", savedActor?.uuid ?? "");
    }

    toggleSidebar(sidebar: SidebarName | null): void {
        throw new Error("Method not implemented.");
    }

    isCurrentActor(actor: ActorPF2e | null | undefined, flash = false) {
        const isCurrentActor = actor && this.actor?.uuid === actor.uuid;
        if (isCurrentActor && flash) this.flash();
        return isCurrentActor;
    }

    flash() {
        const off = { boxShadow: "0 0 0px transparent" };
        const on = {
            boxShadow:
                "0 0 var(--flash-outset-blur) 0px var(--flash-outset-color), inset 0 0 var(--flash-inset-blur) 0px var(--flash-inset-color)",
        };

        this.portraitElement?.querySelector(".flash")?.animate([off, on, on, on, off], {
            duration: 200,
            iterations: 2,
        });
    }

    #onUpdateUser(user: UserPF2e, updates: Partial<UserSourceData>) {
        if (
            user === game.user &&
            "character" in updates &&
            (!this.actor || this.#isUserCharacter)
        ) {
            this.setActor(user.character);
        }
    }

    #onDeleteActor(doc: ActorPF2e | TokenDocumentPF2e) {
        const actor = doc instanceof Actor ? doc : doc.actor;
        if (this.isCurrentActor(actor)) {
            this.setActor(null);
        }
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
        const tooltip = localize("persistent.portrait.selectActor");
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

    #prepareMenuContext(context: PersistentContext, options: PreparedRenderOptions): MenuContext {
        const setTooltipParts = [["setActor", "leftClick"]];
        if (options.hasSavedActor) setTooltipParts.push(["unsetActor", "rightClick"]);

        const setTooltip = setTooltipParts
            .map(([key, click]) => {
                let msg = localize("persistent.menu", key);
                if (options.hasSavedActor) msg = `${localize(click)} ${msg}`;
                return `<div>${msg}</div>`;
            })
            .join("");

        return {
            ...context,
            setActorTooltip: `<div class="pf2e-hud-left">${setTooltip}</div>`,
            hotbarLocked: ui.hotbar.locked,
            cleaned: options.cleaned,
        };
    }

    #activateMenuListeners(html: HTMLElement) {
        const actor = this.actor;

        addListener(html, "[data-action='select-actor']", "contextmenu", () => {
            this.setActor(null);
        });

        addListenerAll(html, "[data-action]", (event, el) => {
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
                    this.#setSelectedToken();
                    break;
                }
                case "toggle-clean": {
                    this.setSetting("cleanPortrait", !this.setting("cleanPortrait"));
                    break;
                }
            }
        });
    }

    #setSelectedToken() {
        const tokens = canvas.tokens.controlled;
        const token = tokens[0];
        if (tokens.length !== 1 || !isValidActor(token.actor)) {
            return warn("persistent.error.selectOne");
        }
        this.setActor(token.actor, { token });
    }

    #preparePortraitContext(
        context: PersistentContext,
        options: PreparedRenderOptions
    ): PortraitContext | PersistentContext {
        const actor = this.actor;
        if (!actor) return context;

        const data: PortraitContext = {
            ...context,
            ...getAdvancedHealthData(actor),
            avatar: actor.img,
            name: actor.name,
            health: getHealth(actor)!,
            cleaned: options.cleaned,
        };

        return data;
    }

    #activatePortraitListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addUpdateActorFromInput(html, actor);
        addArmorListeners(html, actor);
    }

    #prepareMainContext(
        context: PersistentContext,
        options: PreparedRenderOptions
    ): MainContext | PersistentContext {
        const actor = this.actor;
        if (!actor) return context;

        const baseData = getDefaultData(actor, this.useModifiers);
        const advancedData = getAdvancedData(actor, baseData, {
            fontSize: options.fontSize,
            useHighestSpeed: true,
        });

        return {
            ...context,
            ...baseData,
            ...advancedData,
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
    return !!actor && (actor as ActorPF2e).isOfType("character", "npc") && !!actor.isOwner;
}

type Part<TContext extends PersistentContext> = {
    prepareContext: (
        context: PersistentContext,
        options: PreparedRenderOptions
    ) => TContext | PersistentContext;
    activateListeners: (html: HTMLElement) => void;
};

type Parts = {
    menu: Part<MenuContext>;
    portrait: Part<PortraitContext>;
    main: Part<MainContext>;
};

type MenuContext = PersistentContext & {
    hotbarLocked: boolean;
    setActorTooltip: string;
    cleaned: boolean;
};

type PortraitContext = PersistentContext &
    AdvancedHealthData & {
        avatar: string;
        name: string;
        health: HealthData;
        cleaned: boolean;
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

type PersistentRenderOptions = RenderOptionsHUD<PartName> & {
    hasSavedActor: boolean;
    cleaned: boolean;
};

type PreparedRenderOptions = Omit<PersistentRenderOptions, "parts"> & {
    parts: PartName[];
};

type MenuActionEvent =
    | "toggle-users"
    | "open-macros"
    | "toggle-hotbar-lock"
    | "open-sheet"
    | "select-actor"
    | "toggle-clean";

type RenderedTemplates = { name: PartName; element: HTMLElement }[];

type ActorType = CharacterPF2e | NPCPF2e;

type PersistentSettings = {
    enabled: boolean;
    selected: string;
    modifiers: boolean;
    cleanPortrait: boolean;
};

export { PF2eHudPersistent };
