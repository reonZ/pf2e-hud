import {
    addListener,
    addListenerAll,
    createHTMLElement,
    createHook,
    isInstanceOf,
    localize,
    templateLocalize,
    warn,
} from "foundry-pf2e";
import {
    BaseActorContext,
    BaseActorRenderOptions,
    BaseActorSettings,
    PF2eHudBaseActor,
} from "./base/actor";
import {
    AdvancedHudAnchor,
    AdvancedHudEvent,
    CLOSE_SETTINGS,
    CloseSetting,
    makeAdvancedHUD,
} from "./base/advanced";
import { hud } from "../main";
import { StatsHeader, getStatsHeader } from "./shared/base";
import {
    StatsAdvanced,
    StatsHeaderExtras,
    getAdvancedStats,
    getStatsHeaderExtras,
} from "./shared/advanced";
import { SidebarSettings } from "./sidebar/base";
import { addStatsAdvancedListeners, addStatsHeaderListeners } from "./shared/listeners";

class PF2eHudPersistent extends makeAdvancedHUD(
    PF2eHudBaseActor<PersistentSettings, PersistentHudActor>
) {
    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));
    #renderHotbarHook = createHook("renderHotbar", this.#onRenderHotbar.bind(this));
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteActor.bind(this));
    #deleteActorHook = createHook("deleteActor", this.#onDeleteActor.bind(this));
    #updateUserHook = createHook("updateUser", this.#onUpdateUser.bind(this));

    #isUserCharacter: boolean = false;
    #actor: PersistentHudActor | null = null;

    #elements: Record<PartName | "left", HTMLElement | null> = {
        left: null,
        menu: null,
        portrait: null,
        main: null,
    };

    #parts: Parts = {
        main: {
            tooltipDirection: "UP",
            prepareContext: this.#prepareMainContext.bind(this),
            activateListeners: this.#activateMainListeners.bind(this),
        },
        menu: {
            classes: ["app"],
            tooltipDirection: "RIGHT",
            prepareContext: this.#prepareMenuContext.bind(this),
            activateListeners: this.#activateMenuListeners.bind(this),
        },
        portrait: {
            classes: ["app"],
            tooltipDirection: "UP",
            prepareContext: this.#preparePortraitContext.bind(this),
            activateListeners: this.#activatePortraitListeners.bind(this),
        },
    };

    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        window: {
            positioned: false,
        },
    };

    get SETTINGS_ORDER(): (keyof PersistentSettings)[] {
        return [
            "enabled",
            "fontSize",
            "sidebarFontSize",
            "sidebarHeight",
            "multiColumns",
            "noflash",
            "closeOnSendToChat",
            "closeOnSpell",
        ];
    }

    get SETTINGS(): SettingOptions[] {
        return super.SETTINGS.concat([
            {
                key: "selected",
                type: String,
                default: "",
                scope: "client",
                config: false,
                onChange: () => this.render(),
            },
            {
                key: "noflash",
                type: Boolean,
                default: false,
                scope: "client",
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
            ...CLOSE_SETTINGS.map(
                (key): SettingOptions => ({
                    key,
                    type: Boolean,
                    default: false,
                    scope: "client",
                })
            ),
        ]);
    }

    get keybinds(): KeybindingActionConfig[] {
        return [
            {
                name: "setActor",
                onUp: () => this.#setSelectedToken(),
            },
        ];
    }

    get templates(): PartName[] {
        return ["portrait", "main", "menu"];
    }

    get key(): string {
        return "persistent";
    }

    get allowedActorTypes(): (ActorType | "creature")[] {
        return ["character", "npc"];
    }

    get actor(): PersistentHudActor | null {
        return this.#actor ?? null;
    }

    get mainElement() {
        return this.#elements.main;
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

    get anchor(): AdvancedHudAnchor {
        return { x: 0, y: 0 };
    }

    _onEnable(enabled: boolean = this.enabled) {
        this.#renderHotbarHook.toggle(enabled);
        this.#renderActorSheetHook.toggle(enabled);
        this.#deleteTokenHook.toggle(enabled);
        this.#deleteActorHook.toggle(enabled);
        this.#updateUserHook.toggle(enabled);

        if (enabled) {
            const selected = this.getSetting("selected");

            let actor = fromUuidSync<ActorPF2e>(selected);

            if (!isValidActor(actor)) {
                actor = game.user.character;
            }

            if (actor) this.setActor(actor, { skipSave: true });
            else this.render(true);
        } else {
            this.close({ forced: true });
        }
    }

    _configureRenderOptions(options: PersistentRenderOptions) {
        super._configureRenderOptions(options);

        options.hasSavedActor = !!this.getSetting("selected");
        options.cleaned = this.getSetting("cleanPortrait");

        const allowedParts = this.templates;
        if (!options.parts) options.parts = allowedParts;
        else options.parts?.filter((part) => allowedParts.includes(part));
    }

    async _prepareContext(
        options: PersistentRenderOptions
    ): Promise<PersistentContext | BaseActorContext<PersistentHudActor>> {
        const parentData = await super._prepareContext(options);
        if (!parentData.hasActor) return parentData;

        const actor = parentData.actor;
        return {
            ...parentData,
            isNPC: actor.isOfType("npc"),
            isCharacter: actor.isOfType("character"),
        };
    }

    async _renderHTML(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<PersistentTemplates> {
        return Promise.all(
            options.parts.map(async (partName) => {
                const part = this.#parts[partName];
                const tooltipDirection = part.tooltipDirection ?? "DOWN";
                const partContext = part.prepareContext(context, options);
                const template = await this.renderTemplate(partName, {
                    i18n: templateLocalize(`persistent.${partName}`),
                    ...partContext,
                });

                const classes = part.classes?.slice() ?? [];
                if (partName !== "main" && options.cleaned) {
                    classes.push("cleaned");
                }

                const element = createHTMLElement("div", {
                    id: `pf2e-hud-persistent-${partName}`,
                    dataset: { tooltipDirection },
                    innerHTML: template,
                    classes,
                });

                return { name: partName, element };
            })
        );
    }

    _replaceHTML(
        templates: PersistentTemplates,
        content: HTMLElement,
        options: PersistentRenderOptions
    ) {
        if (!this.#elements.left) {
            this.#elements.left = createHTMLElement("div", {
                id: "pf2e-hud-persistent-left",
            });
            document.getElementById("ui-left")?.append(this.#elements.left);
        }

        for (let { name, element } of templates) {
            const oldElement = this.#elements[name];
            const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

            if (oldElement) {
                oldElement.replaceWith(element);
            } else if (name === "main") {
                document.getElementById("ui-bottom")?.prepend(element);
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

    _insertElement(element: HTMLElement) {}

    _actorCleanup() {
        this.#actor = null;
        this.#isUserCharacter = false;
        super._actorCleanup();
    }

    _onClose(options: ApplicationClosingOptions) {
        for (const key in this.#elements) {
            this.#elements[key as PartName | "left"]?.remove();
            this.#elements[key as PartName | "left"] = null;
        }
        super._onClose(options);
    }

    async close(options?: ApplicationClosingOptions & { forced?: boolean }): Promise<this> {
        if (!options?.forced) return this;
        return super.close(options);
    }

    closeIf(event: AdvancedHudEvent) {
        const settingKey = this.eventToSetting(event);
        const setting = this.getSetting(settingKey);

        if (setting) {
            this.toggleSidebar(null);
            return true;
        }

        return false;
    }

    setActor(
        actor: ActorPF2e | null,
        { token, skipSave }: { token?: Token; skipSave?: boolean } = {}
    ) {
        if (actor && (this.isCurrentActor(actor) || !isValidActor(actor))) return;

        const savedActor = actor;
        this._actorCleanup();

        if (!actor) {
            const userActor = game.user.character;
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
        this.#actor = actor as PersistentHudActor;

        if (skipSave) this.render(!!actor);
        else this.setSetting("selected", savedActor?.uuid ?? "");
    }

    isCurrentActor(actor: Maybe<ActorPF2e>, flash = false): actor is PersistentHudActor {
        const isCurrentActor = super.isCurrentActor(actor);
        if (isCurrentActor && flash) this.flash();
        return isCurrentActor;
    }

    flash() {
        if (this.getSetting("noflash")) return;

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

    #onUpdateUser(user: UserPF2e, updates: Partial<UserSourcePF2e>) {
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

        const html = $html[0];
        const titleElement = html
            .closest(".window-app")
            ?.querySelector(".window-header .window-title");
        if (!titleElement) return;

        const existing = titleElement.querySelector(".document-id-link.persistent");
        const btnElement = createHTMLElement("a", {
            classes: ["document-id-link", "persistent"],
            dataset: {
                tooltip: localize("persistent.portrait.selectActor"),
                tooltipDirection: "UP",
            },
            innerHTML: "<i class='fa-solid fa-user-vneck'></i>",
        });

        btnElement.addEventListener("click", () => this.setActor(actor));

        if (existing) existing.replaceWith(btnElement);
        else titleElement.append(btnElement);
    }

    #onRenderHotbar() {
        this.render({ parts: ["menu"] });
    }

    #setSelectedToken() {
        const tokens = canvas.tokens.controlled;
        const token = tokens[0];
        if (tokens.length !== 1 || !isValidActor(token.actor)) {
            return warn("persistent.error.selectOne");
        }
        this.setActor(token.actor, { token });
    }

    #prepareMenuContext(context: PersistentContext, options: PersistentRenderOptions): MenuContext {
        const setTooltipParts = [["setActor", "leftClick"]];
        if (options.hasSavedActor) setTooltipParts.push(["unsetActor", "rightClick"]);

        const setActorTooltip = setTooltipParts
            .map(([key, click]) => {
                let msg = localize("persistent.menu", key);
                if (options.hasSavedActor) msg = `${localize(click)} ${msg}`;
                return `<div>${msg}</div>`;
            })
            .join("");

        return {
            ...context,
            setActorTooltip,
            hotbarLocked: ui.hotbar.locked,
        };
    }

    #activateMenuListeners(html: HTMLElement) {
        const actor = this.actor;

        addListener(html, "[data-action='select-actor']", "contextmenu", () => {
            this.setActor(null);
        });

        addListenerAll(html, "[data-action]", (event, el) => {
            const action = el.dataset.action as MenuActionEvent;

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
                    this.setSetting("cleanPortrait", !this.getSetting("cleanPortrait"));
                    break;
                }
            }
        });
    }

    #preparePortraitContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): PortraitContext | PersistentContext {
        const actor = this.actor;
        if (!actor) return context;

        const data: PortraitContext = {
            ...context,
            ...getStatsHeader(actor),
            ...getStatsHeaderExtras(actor),
            avatar: actor.img,
            name: actor.name,
        };

        return data;
    }

    #activatePortraitListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addStatsHeaderListeners(this.actor, html);
    }

    #prepareMainContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): MainContext | PersistentContext {
        const actor = this.actor;
        if (!actor) return context;

        const data: MainContext = {
            ...context,
            ...getAdvancedStats(actor),
        };

        return data;
    }

    #activateMainListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addStatsAdvancedListeners(this.actor, html);
    }
}

function isValidActor(actor: ActorPF2e | null): actor is ActorPF2e {
    return isInstanceOf(actor, "ActorPF2e") && actor.isOfType("character", "npc") && actor.isOwner;
}

type MenuActionEvent =
    | "toggle-users"
    | "open-macros"
    | "toggle-hotbar-lock"
    | "open-sheet"
    | "select-actor"
    | "toggle-clean";

type MenuContext = PersistentContext & {
    hotbarLocked: boolean;
    setActorTooltip: string;
};

type PortraitContext = PersistentContext &
    StatsHeader &
    StatsHeaderExtras & {
        avatar: string;
        name: string;
    };

type MainContext = PersistentContext & StatsAdvanced;

type PersistentTemplates = { name: PartName; element: HTMLElement }[];

type PartName = "menu" | "main" | "portrait";

type PersistentHudActor = CharacterPF2e | NPCPF2e;

type PersistentRenderOptions = Omit<BaseActorRenderOptions, "parts"> & {
    parts: PartName[];
    hasSavedActor: boolean;
    cleaned: boolean;
};

type Part<TContext extends PersistentContext> = {
    tooltipDirection?: "UP" | "DOWN" | "LEFT" | "RIGHT";
    classes?: string[];
    prepareContext: (
        context: PersistentContext,
        options: PersistentRenderOptions
    ) => TContext | PersistentContext;
    activateListeners: (html: HTMLElement) => void;
};

type Parts = {
    menu: Part<MenuContext>;
    portrait: Part<PortraitContext>;
    main: Part<MainContext>;
};

type PersistentContext = Omit<BaseActorContext<PersistentHudActor>, "actor" | "hasActor"> & {
    hasActor: true;
    actor: PersistentHudActor;
    isCharacter: boolean;
    isNPC: boolean;
};

type PersistentSettings = BaseActorSettings &
    SidebarSettings &
    Record<CloseSetting, boolean> & {
        selected: string;
        cleanPortrait: boolean;
        noflash: boolean;
    };

export { PF2eHudPersistent };
