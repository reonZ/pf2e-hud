import {
    ActorPF2e,
    ActorSheetPF2e,
    ActorType,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    CharacterPF2e,
    CombatantPF2e,
    NPCPF2e,
    R,
    TokenDocumentPF2e,
    UserPF2e,
    UserSourcePF2e,
    createHTMLElement,
    createHook,
    createTemporaryStyles,
    getWorldActor,
    htmlQuery,
    localize,
    templateLocalize,
    warn,
} from "module-helpers";
import { hud } from "../main";
import {
    BaseActorContext,
    BaseActorRenderOptions,
    BaseActorSettings,
    PF2eHudBaseActor,
} from "./base/actor";
import {
    AdvancedHudAnchor,
    AdvancedHudEvent,
    AdvancedHudSettings,
    CLOSE_SETTINGS,
    makeAdvancedHUD,
} from "./base/advanced";
import { PersistentEffects } from "./persistent/effects";
import { PersistentMain } from "./persistent/main";
import { PersistentMenu } from "./persistent/menu";
import { PersistentPortrait } from "./persistent/portrait";
import { AutoFillSetting, PersistentShortcuts } from "./persistent/shortcuts";

const PARTS_WITHOUT_EFFECT = ["menu", "portrait", "main", "shortcuts"] as const;
const PARTS = [...PARTS_WITHOUT_EFFECT, "effects"] as const;

class PF2eHudPersistent extends makeAdvancedHUD(
    PF2eHudBaseActor<
        PersistentSettings,
        PersistentHudActor,
        PersistentUserSetting,
        PersistentRenderOptions
    >
) {
    #onControlTokenDebounce = foundry.utils.debounce(this.#onControlToken.bind(this), 1);

    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));
    #renderTokenHudHook = createHook("renderTokenHUD", () => this.closeSidebar());
    #controlTokenHook = createHook("controlToken", this.#onControlTokenDebounce.bind(this));
    #renderHotbarHook = createHook("renderHotbar", this.#onRenderHotbar.bind(this));
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteToken.bind(this));
    #deleteActorHook = createHook("deleteActor", this.#onDeleteActor.bind(this));
    #updateUserHook = createHook("updateUser", this.#onUpdateUser.bind(this));
    #deleteCombatHook = createHook("deleteCombat", this.#onDeleteCombat.bind(this));
    #deleteCombatantHook = createHook("deleteCombatant", this.#onChangeCombatant.bind(this));
    #createCombatantHook = createHook("createCombatant", this.#onChangeCombatant.bind(this));
    #combatTurnHook = createHook("combatTurnChange", this.#onCombatTurnChange.bind(this));

    #temporaryStyles = createTemporaryStyles();

    #isUserCharacter: boolean = false;
    #actor: PersistentHudActor | null = null;

    #elements: Record<PartName, HTMLElement | null> = {
        menu: null,
        portrait: null,
        main: null,
        effects: null,
        shortcuts: null,
    };

    #parts: Parts = {
        main: new PersistentMain(this),
        menu: new PersistentMenu(this),
        portrait: new PersistentPortrait(this),
        effects: new PersistentEffects(this),
        shortcuts: new PersistentShortcuts(this),
    };

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        window: {
            positioned: false,
        },
        id: "pf2e-hud-persistent",
    };

    get SETTINGS_ORDER(): (keyof PersistentSettings)[] {
        return [
            "enabled",
            "autoSet",
            "keepLast",
            "fontSize",
            "noflash",
            "closeOnSendToChat",
            "closeOnSpell",
            "closeOnSkill",
            "showAlliance",
            "shiftEffects",
        ];
    }

    get SUB_SETTINGS_ORDER(): (keyof PersistentSettings)[] {
        return [
            "shortcutSlots",
            "ownerShortcuts",
            "autoFillNpc",
            "autoFillActions",
            "autoFillReactions",
            "autoFillType",
            "confirmShortcut",
            "consumableShortcut",
            "drawConsumables",
        ];
    }

    getSettings(): SettingOptions[] {
        return super.getSettings().concat([
            {
                key: "autoSet",
                type: String,
                choices: ["disabled", "select", "combat"],
                default: "disabled",
                scope: "client",
                onChange: () => {
                    this.enable();
                },
            },
            {
                key: "keepLast",
                type: Boolean,
                default: true,
                scope: "client",
            },
            {
                key: "autoFillNpc",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: () => {
                    this.render({ parts: ["shortcuts"] });
                },
            },
            {
                key: "autoFillActions",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: () => {
                    this.render({ parts: ["shortcuts"] });
                },
            },
            {
                key: "autoFillReactions",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: () => {
                    this.render({ parts: ["shortcuts"] });
                },
            },
            {
                key: "autoFillType",
                type: String,
                choices: ["one", "two"],
                default: "one",
                scope: "client",
                onChange: () => {
                    this.render({ parts: ["shortcuts"] });
                },
            },
            {
                key: "shortcutSlots",
                type: Number,
                default: 4,
                scope: "client",
                range: {
                    min: 0,
                    max: 10,
                    step: 1,
                },
                onChange: () => {
                    this.render({ parts: ["shortcuts"] });
                },
            },
            {
                key: "ownerShortcuts",
                type: Boolean,
                default: true,
                scope: "client",
                gmOnly: true,
                onChange: () => {
                    this.render({ parts: ["shortcuts"] });
                },
            },
            {
                key: "drawConsumables",
                type: Boolean,
                default: false,
                scope: "client",
                onChange: () => {
                    this.render({ parts: ["shortcuts"] });
                },
            },
            {
                key: "noflash",
                type: Boolean,
                default: false,
                scope: "client",
            },
            {
                key: "showUsers",
                type: Boolean,
                default: true,
                scope: "client",
                config: false,
                onChange: (value) => {
                    this.#temporaryStyles.toggle("#interface", "show-users", value);
                },
            },
            {
                key: "confirmShortcut",
                type: Boolean,
                default: true,
                scope: "client",
            },
            {
                key: "consumableShortcut",
                type: String,
                choices: ["use", "confirm", "chat"],
                default: "confirm",
                scope: "client",
            },
            {
                key: "showEffects",
                type: Boolean,
                default: true,
                scope: "client",
                config: false,
                onChange: (value) => {
                    this.element.classList.toggle("show-effects", value);

                    if (value) {
                        this.render({ parts: ["effects"] });
                    } else {
                        this.#elements.effects?.remove();
                        this.#elements.effects = null;
                    }
                },
            },
            {
                key: "shiftEffects",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: () => {
                    this.render({ parts: ["effects"] });
                },
            },
            {
                key: "cleanPortrait",
                type: Boolean,
                default: false,
                scope: "client",
                config: false,
                onChange: (value) => {
                    this.element?.classList.toggle("cleaned", value);
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

    get partials(): string[] {
        return super.partials.concat([
            "strike_versatiles",
            "strike_auxiliaries",
            "strike_category",
            "action_blast-row",
            "action_strike-row",
        ]);
    }

    get templates(): PartName[] {
        return ["portrait", "main", "menu", "effects"];
    }

    get key(): "persistent" {
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

    get portraitElement() {
        return this.#elements.portrait;
    }

    get menuElement() {
        return this.#elements.menu;
    }

    get effectsElement() {
        return this.#elements.effects;
    }

    get shortcutsElement() {
        return this.#elements.shortcuts;
    }

    get hotbarElement() {
        return document.getElementById("hotbar");
    }

    get sidebars() {
        return this.mainElement?.querySelector<HTMLElement>(".sidebars") ?? null;
    }

    get shortcuts() {
        return this.#parts.shortcuts;
    }

    get anchor(): AdvancedHudAnchor {
        const sidebars = this.mainElement?.querySelector(".sidebars");
        if (!sidebars) return { x: 100, y: 100 };

        const { left, top, width } = sidebars.getBoundingClientRect();

        return {
            x: left + width / 2,
            y: top,
            limits: {
                bottom: top,
            },
        };
    }

    get worldActor() {
        return getWorldActor(this.actor);
    }

    get savedActor() {
        const uuid = this.getUserSetting("selected") ?? "";
        const actor = fromUuidSync<ActorPF2e>(uuid);
        return this.isValidActor(actor) ? actor : null;
    }

    _onEnable(enabled: boolean = this.enabled) {
        const autoSet = this.getSetting("autoSet");

        this.#renderActorSheetHook.toggle(enabled);
        this.#renderTokenHudHook.toggle(enabled);
        this.#renderHotbarHook.toggle(enabled);
        this.#deleteTokenHook.toggle(enabled);
        this.#deleteActorHook.toggle(enabled);
        this.#updateUserHook.toggle(enabled);

        this.#deleteCombatHook.toggle(enabled);
        this.#deleteCombatantHook.toggle(enabled);
        this.#createCombatantHook.toggle(enabled);

        this.#controlTokenHook.toggle(enabled && autoSet === "select");
        this.#combatTurnHook.toggle(enabled && autoSet === "combat");

        if (enabled) {
            let actor = this.savedActor;
            if (actor) {
                return this.setActor(actor, { skipSave: true });
            }

            if (autoSet === "combat") {
                const combatant = game.combat?.combatants.get(
                    game.combat?.current.combatantId ?? ""
                );

                if (this.isValidActor(combatant?.actor)) {
                    this.setActor(combatant.actor, { skipSave: true });
                    return;
                }
            }

            actor = this.getAssignedActor();

            if (actor) {
                this.setActor(actor, { skipSave: true });
            } else {
                this.render(true);
            }
        } else if (this.rendered) {
            this.close({ forced: true });
        }
    }

    _configureRenderOptions(options: PersistentRenderOptions) {
        super._configureRenderOptions(options);

        options.cleaned = this.getSetting("cleanPortrait");
        options.showUsers = this.getSetting("showUsers");
        options.showEffects = this.getSetting("showEffects");

        if (options.parts?.length) {
            options.renderMain = options.parts.includes("main");
            options.renderShortcuts = !!options.parts.findSplice((part) => part === "shortcuts");

            if (options.renderShortcuts || options.renderMain) {
                options.parts.push("shortcuts");
            }

            if (!options.showEffects) {
                options.parts.findSplice((x) => x === "effects");
            }
        } else {
            options.renderShortcuts = true;
            options.renderMain = true;
            options.parts = options.showEffects ? PARTS.slice() : PARTS_WITHOUT_EFFECT.slice();
        }
    }

    async _prepareContext(
        options: PersistentRenderOptions
    ): Promise<PersistentContext | BaseActorContext<PersistentHudActor>> {
        const parentData = await super._prepareContext(options);
        if (!parentData.hasActor) return parentData;

        const actor = parentData.actor;

        const data: PersistentContext = {
            ...parentData,
            isGM: game.user.isGM,
            isNPC: actor.isOfType("npc"),
            isCharacter: actor.isOfType("character"),
        };

        return data;
    }

    async _renderHTML(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<PersistentTemplates> {
        return Promise.all(
            options.parts.map(async (partName) => {
                const part = this.#parts[partName];
                const tooltipDirection = part.tooltipDirection ?? "UP";
                const partContext = await part.prepareContext(context, options);
                const template = await this.renderTemplate(partName, {
                    i18n: templateLocalize(`persistent.${partName}`),
                    ...partContext,
                });

                const classes = part.classes?.slice() ?? [];
                const element = createHTMLElement("div", {
                    id: `pf2e-hud-persistent-${partName}`,
                    dataset: { tooltipDirection },
                    innerHTML: template,
                    classes: classes.concat("pf2e-hud"),
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
        const actor = this.actor;
        const hotbar = this.hotbarElement;
        const fontSize = `${this.getSetting("fontSize")}px`;

        content.style.setProperty("--font-size", fontSize);
        content.classList.toggle("show-effects", options.showEffects);
        content.classList.toggle("cleaned", options.cleaned);

        for (let { name, element } of templates) {
            const oldElement = this.#elements[name];
            const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

            if (name === "shortcuts") {
                htmlQuery(this.mainElement, "#pf2e-hud-persistent-shortcuts")?.replaceWith(element);
            } else if (oldElement) {
                oldElement.replaceWith(element);
            } else {
                content.append(element);
            }

            if (hotbar && name === "main") {
                element.appendChild(hotbar);
            }

            if (focusName) {
                element.querySelector<HTMLInputElement>(`input[name="${focusName}"]`)?.focus();
            }

            this.#elements[name] = element;
            this.#parts[name].activateListeners(element);
        }

        if (actor && options.renderShortcuts) {
            const selectedSet = this.shortcuts.shortcutSetIndex + 1;
            const navigation = htmlQuery(this.mainElement, ".shortcuts-navigation");

            htmlQuery(navigation, ".previous")?.classList.toggle("disabled", selectedSet === 1);
            htmlQuery(navigation, ".next")?.classList.toggle(
                "disabled",
                selectedSet === this.shortcuts.SHORTCUTS_LIST_LIMIT
            );

            const valueElement = htmlQuery(navigation, ".value");
            if (valueElement) {
                valueElement.innerText = String(selectedSet);
            }
        }

        if (options.showEffects && options.parts.includes("effects") && this.effectsElement) {
            this.mainElement?.append(this.effectsElement);
        }
    }

    _onFirstRender(context: PersistentContext, options: PersistentRenderOptions) {
        document.getElementById("ui-left")?.append(this.element);
        this.#temporaryStyles.add("#interface", "has-hud-persistent");
        this.#temporaryStyles.toggle("#interface", "show-users", options.showUsers);
    }

    _onRender(context: PersistentContext, options: PersistentRenderOptions) {
        if (options.renderMain) {
            this.sidebar?.render(true);
        }
    }

    _actorCleanup() {
        this.toggleSidebar(null);

        super._actorCleanup();

        this.#actor = null;
        this.#isUserCharacter = false;
    }

    _onClose(options: ApplicationClosingOptions) {
        for (const key in this.#elements) {
            this.#elements[key as PartName]?.remove();
            this.#elements[key as PartName] = null;
        }

        this.#temporaryStyles.clear();

        super._onClose(options);
    }

    async close(options?: ApplicationClosingOptions & { forced?: boolean }): Promise<this> {
        if (!options?.forced) return this;

        const hotbar = this.hotbarElement;
        if (hotbar) {
            document.querySelector("#ui-bottom > div")?.prepend(hotbar);
        }

        return super.close(options);
    }

    closeIf(event: AdvancedHudEvent) {
        const settingKey = this.eventToSetting(event);
        const setting = this.getSetting(settingKey);

        if (setting) {
            this.closeSidebar();
            return true;
        }

        return false;
    }

    getAssignedActor() {
        const assigned = game.user.character;
        return this.isValidActor(assigned) ? assigned : null;
    }

    async setActor(
        actor: ActorPF2e | null,
        { token, skipSave, force }: { token?: Token; skipSave?: boolean; force?: boolean } = {}
    ) {
        if (!this.isValidActor(actor)) {
            actor = null;
        }

        const user = game.user;
        const userActor = user.character;
        const autoSet = this.getSetting("autoSet");
        const keepLast = autoSet !== "disabled" && this.getSetting("keepLast");
        if (!force && keepLast && !actor && (autoSet !== "select" || !userActor)) return;

        const savedActor = actor;
        this._actorCleanup();

        if (!actor) {
            let potentialActor = null;

            if (autoSet === "combat") {
                const combatantId = game.combat?.current.combatantId ?? "";
                potentialActor = game.combat?.combatants.get(combatantId)?.actor;
            } else if (autoSet === "select") {
                potentialActor = R.only(canvas.tokens.controlled)?.actor;
            }

            if (!this.isValidActor(potentialActor)) {
                potentialActor = userActor;
            }

            if (this.isValidActor(potentialActor)) {
                actor = potentialActor;
            }
        }

        if (actor) {
            actor.apps[this.id] = this;

            if (actor.token) {
                actor.token.baseActor.apps[this.id] = this;
            }

            const tokens = token ? [token] : actor.getActiveTokens();

            for (const token of tokens) {
                if (hud.token.token === token) hud.token.close();
                if (hud.tooltip.token === token) hud.tooltip.close();
            }
        }

        this.#isUserCharacter = actor === this.getAssignedActor();
        this.#actor = actor as PersistentHudActor;

        if (!skipSave) await this.setUserSetting("selected", savedActor?.uuid ?? "");
        this.render(!!actor);
    }

    isCurrentActor(actor: Maybe<ActorPF2e>, flash = false): actor is PersistentHudActor {
        const isCurrentActor = super.isCurrentActor(actor);
        if (isCurrentActor && flash) this.flash();
        return isCurrentActor;
    }

    isValidActor(actor: Maybe<ActorPF2e>): actor is ActorPF2e {
        return super.isValidActor(actor) && actor.isOwner;
    }

    acceptsActor(actor: Maybe<ActorPF2e>) {
        return this.enabled && !hud.persistent.savedActor && this.isValidActor(actor);
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

    async changeShortcutsSet(direction: 1 | -1) {
        if (await this.shortcuts.changeShortcutsSet(direction, false)) {
            this.render({ parts: ["shortcuts"] });
        }
    }

    async setShortcutSet(value: number) {
        if (await this.shortcuts.setShortcutSet(value, false)) {
            this.render({ parts: ["shortcuts"] });
        }
    }

    #onUpdateUser(user: UserPF2e, updates: Partial<UserSourcePF2e>) {
        if (
            user === game.user &&
            "character" in updates &&
            (!this.actor || this.#isUserCharacter)
        ) {
            this.setActor(user.character, { skipSave: true });
        }
    }

    #onDeleteActor(actor: ActorPF2e) {
        if (this.isCurrentActor(actor)) {
            this.setActor(null, { skipSave: true, force: true });
        }
    }

    #onDeleteToken(token: TokenDocumentPF2e) {
        const actor = token.actor;
        if (actor?.isToken) {
            this.#onDeleteActor(actor);
        }
    }

    #onRenderActorSheet(sheet: ActorSheetPF2e<ActorPF2e>, $html: JQuery) {
        const actor = sheet.actor;
        if (!this.isValidActor(actor)) return;

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

    #onChangeCombatant(combatant: CombatantPF2e) {
        if (this.shortcuts.hasStances && this.isCurrentActor(combatant.actor)) {
            this.render({ parts: ["shortcuts"] });
        }
    }

    #onDeleteCombat() {
        if (!this.savedActor && this.getSetting("autoSet") === "combat") {
            this.setActor(null, { skipSave: true, force: true });
        } else if (this.shortcuts.hasStances) {
            this.render({ parts: ["shortcuts"] });
        }
    }

    #onCombatTurnChange() {
        if (this.savedActor) return;

        const combatant = game.combat?.combatants.get(game.combat?.current.combatantId ?? "");
        const actor = this.isValidActor(combatant?.actor) ? combatant.actor : null;

        this.setActor(actor, { skipSave: true });
    }

    #onControlToken() {
        if (this.savedActor) return;

        const token = R.only(canvas.tokens.controlled);

        this.setActor(token?.actor ?? null, { token, skipSave: true });
    }

    #onRenderHotbar() {
        this.render({ parts: ["menu"] });
    }

    setSelectedToken() {
        const tokens = canvas.tokens.controlled;
        const token = tokens[0];

        if (tokens.length !== 1 || !this.isValidActor(token.actor)) {
            return warn("persistent.error.selectOne");
        }

        this.setActor(token.actor, { token });
    }
}

type PersistentTemplates = { name: PartName; element: HTMLElement }[];

type PartName = (typeof PARTS)[number];

type PersistentHudActor = CharacterPF2e | NPCPF2e;

type PersistentRenderOptions = Omit<BaseActorRenderOptions, "parts"> & {
    parts: PartName[];
    cleaned: boolean;
    showUsers: boolean;
    showEffects: boolean;
    renderMain: boolean;
    renderShortcuts: boolean;
};

type Parts = {
    main: PersistentMain;
    menu: PersistentMenu;
    portrait: PersistentPortrait;
    effects: PersistentEffects;
    shortcuts: PersistentShortcuts;
};

type PersistentContext = Omit<BaseActorContext<PersistentHudActor>, "actor" | "hasActor"> & {
    hasActor: true;
    actor: PersistentHudActor;
    isCharacter: boolean;
    isNPC: boolean;
    isGM: boolean;
};

type PersistentUserSetting = {
    selected: string;
};

type AutoSetSetting = "disabled" | "select" | "combat";

type PersistentSettings = BaseActorSettings &
    AdvancedHudSettings<boolean> & {
        cleanPortrait: boolean;
        noflash: boolean;
        confirmShortcut: boolean;
        consumableShortcut: "use" | "confirm" | "chat";
        showUsers: boolean;
        autoSet: AutoSetSetting;
        autoFillNpc: boolean;
        autoFillType: AutoFillSetting;
        ownerShortcuts: boolean;
        showEffects: boolean;
        shiftEffects: boolean;
        autoFillActions: boolean;
        autoFillReactions: boolean;
        shortcutSlots: number;
        keepLast: boolean;
        drawConsumables: boolean;
    };

export { PF2eHudPersistent };

export type {
    AutoSetSetting,
    PersistentContext,
    PersistentHudActor,
    PersistentRenderOptions,
    PersistentSettings,
};
