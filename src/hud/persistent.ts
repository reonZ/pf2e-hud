import {
    MODULE,
    R,
    addListener,
    addListenerAll,
    arrayIncludes,
    changeCarryType,
    confirmDialog,
    consumeItem,
    createHTMLElement,
    createHook,
    elementDataset,
    getActionAnnotation,
    getActionImg,
    getActiveModule,
    getEnrichedDescriptions,
    getFirstActiveToken,
    getFlag,
    getOwner,
    getRankLabel,
    getRemainingDurationLabel,
    hasItemWithSourceId,
    htmlClosest,
    imagePath,
    isInstanceOf,
    localize,
    objectHasKey,
    openAttackpopup,
    resolveMacroActor,
    setFlag,
    templateLocalize,
    unsetFlag,
    warn,
} from "foundry-pf2e";
import { PersistentDialog } from "foundry-pf2e/src/pf2e";
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
    CLOSE_SETTINGS,
    CloseSetting,
    addSidebarsListeners,
    makeAdvancedHUD,
} from "./base/advanced";
import { PF2eHudItemPopup } from "./popup/item";
import {
    StatsAdvanced,
    StatsHeaderExtras,
    getAdvancedStats,
    getStatsHeaderExtras,
} from "./shared/advanced";
import { StatsHeader, getStatsHeader } from "./shared/base";
import { addStatsAdvancedListeners, addStatsHeaderListeners } from "./shared/listeners";
import {
    ActionBlast,
    ActionStrike,
    getActionFrequency,
    getBlastData,
    getStrikeData,
    getStrikeVariant,
    useAction,
    variantLabel,
} from "./sidebar/actions";
import { SidebarMenu, SidebarSettings, getSidebars } from "./sidebar/base";
import {
    SkillVariantDataset,
    getMapLabel,
    getSkillVariantName,
    rollStatistic,
} from "./sidebar/skills";
import { getAnnotationTooltip } from "./sidebar/spells";

const ROMAN_RANKS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

class PF2eHudPersistent extends makeAdvancedHUD(
    PF2eHudBaseActor<PersistentSettings, PersistentHudActor, PersistentUserSetting>
) {
    #onControlTokenDebounce = foundry.utils.debounce(this.#onControlToken.bind(this), 1);

    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));
    #renderTokenHudHook = createHook("renderTokenHUD", () => this.closeSidebar());
    #controlTokenHook = createHook("controlToken", this.#onControlTokenDebounce.bind(this));
    #renderHotbarHook = createHook("renderHotbar", this.#onRenderHotbar.bind(this));
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteActor.bind(this));
    #deleteActorHook = createHook("deleteActor", this.#onDeleteActor.bind(this));
    #updateUserHook = createHook("updateUser", this.#onUpdateUser.bind(this));
    #combatDeleteHook = createHook("deleteCombat", this.#onDeleteCombat.bind(this));
    #combatTurnHook = createHook("combatTurnChange", this.#onCombatTurnChange.bind(this));

    #isVirtual: boolean = false;
    #isUserCharacter: boolean = false;
    #actor: PersistentHudActor | null = null;
    #shortcuts: Record<string, Shortcut | EmptyShortcut> = {};
    #shortcutData: UserShortcutsData = {};
    #effectsInstructions: Record<string, string> | null = null;
    #effectsShiftInstructions: Record<string, string> | null = null;

    #elements: Record<PartName, HTMLElement | null> = {
        menu: null,
        portrait: null,
        main: null,
        effects: null,
    };

    #hotbar: HTMLElement | null = null;

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
        effects: {
            tooltipDirection: "UP",
            prepareContext: this.#prepareEffectsContext.bind(this),
            activateListeners: this.#activateEffectsListeners.bind(this),
        },
    };

    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        window: {
            positioned: false,
        },
        id: "pf2e-hud-persistent",
    };

    get SETTINGS_ORDER(): (keyof PersistentSettings)[] {
        return [
            "enabled",
            "autoSet",
            "fontSize",
            "sidebarFontSize",
            "sidebarHeight",
            "multiColumns",
            "shortcutSlots",
            "ownerShortcuts",
            "autoFillNpc",
            "autoFillActions",
            "autoFillReactions",
            "autoFillType",
            "noflash",
            "confirmShortcut",
            "consumableShortcut",
            "closeOnSendToChat",
            "closeOnSpell",
            "closeOnSkill",
            "shiftEffects",
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
                requiresReload: true,
            },
            {
                key: "autoFillNpc",
                type: Boolean,
                default: true,
                scope: "client",
                gmOnly: true,
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "autoFillActions",
                type: Boolean,
                default: true,
                scope: "client",
                gmOnly: true,
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "autoFillReactions",
                type: Boolean,
                default: true,
                scope: "client",
                gmOnly: true,
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "autoFillType",
                type: String,
                choices: ["one", "two"],
                default: "one",
                scope: "client",
                gmOnly: true,
                onChange: () => {
                    this.render();
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
                    this.render();
                },
            },
            {
                key: "ownerShortcuts",
                type: Boolean,
                default: true,
                scope: "client",
                gmOnly: true,
                onChange: () => {
                    this.render();
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
                    this.element?.classList.toggle("show-users", value);
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
                    this.element?.classList.toggle("show-effects", value);
                },
            },
            {
                key: "shiftEffects",
                type: Boolean,
                default: true,
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
                    this.render();
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

    get hotbarElement() {
        return (this.#hotbar = document.getElementById("hotbar"));
    }

    get sidebars() {
        return this.mainElement?.querySelector<HTMLElement>(".sidebars") ?? null;
    }

    get isVirtual() {
        return this.#isVirtual;
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

    get savedActor() {
        const uuid = this.getUserSetting("selected") ?? "";
        const actor = fromUuidSync<ActorPF2e>(uuid);
        return this.isValidActor(actor) ? actor : null;
    }

    get effectsInstructions() {
        this.#effectsInstructions ??= R.pipe(
            {
                rollDamage: "PF2E.EffectPanel.RollDamageToolTip",
                increment: "PF2E.EffectPanel.IncrementToolTip",
                decrement: "PF2E.EffectPanel.DecrementToolTip",
                remove: "PF2E.EffectPanel.RemoveToolTip",
            },
            R.mapValues((value) => game.i18n.localize(value))
        );

        return this.#effectsInstructions;
    }

    get effectsShiftInstructions() {
        if (this.#effectsShiftInstructions) return this.#effectsShiftInstructions;

        const shiftLabel = localize("persistent.main.effects.shift");
        this.#effectsShiftInstructions ??= R.mapValues(this.effectsInstructions, (value) =>
            value.replace(/^\[/, `[${shiftLabel} + `)
        );

        return this.#effectsShiftInstructions;
    }

    _onEnable(enabled: boolean = this.enabled) {
        const autoSet = this.getSetting("autoSet");

        this.#renderActorSheetHook.toggle(enabled);
        this.#renderTokenHudHook.toggle(enabled);
        this.#renderHotbarHook.toggle(enabled);
        this.#deleteTokenHook.toggle(enabled);
        this.#deleteActorHook.toggle(enabled);
        this.#updateUserHook.toggle(enabled);

        this.#controlTokenHook.toggle(enabled && autoSet === "select");
        this.#combatDeleteHook.toggle(enabled && autoSet === "combat");
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

            actor = game.user.character;

            if (actor) {
                this.setActor(actor, { skipSave: true });
            } else {
                this.render(true);
            }
        } else {
            this.close({ forced: true });
        }
    }

    _configureRenderOptions(options: PersistentRenderOptions) {
        super._configureRenderOptions(options);

        options.cleaned = this.getSetting("cleanPortrait");
        options.showEffects = this.getSetting("showEffects");
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
        const parts = ["menu", "portrait", "main", "effects"] as const;

        return Promise.all(
            parts.map(async (partName) => {
                const part = this.#parts[partName];
                const tooltipDirection = part.tooltipDirection ?? "DOWN";
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
        const hotbar = this.hotbarElement;
        const fontSize = `${this.getSetting("fontSize")}px`;

        document.getElementById("ui-left")?.append(content);

        content.style.setProperty("--font-size", fontSize);
        content.classList.toggle("show-effects", this.getSetting("showEffects"));
        content.classList.toggle("show-users", this.getSetting("showUsers"));
        content.classList.toggle("cleaned", options.cleaned);

        for (let { name, element } of templates) {
            const oldElement = this.#elements[name];
            const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

            if (oldElement) {
                oldElement.replaceWith(element);
            } else {
                content.append(element);
            }

            if (focusName) {
                element.querySelector<HTMLInputElement>(`input[name="${focusName}"]`)?.focus();
            }

            this.#elements[name] = element;
            this.#parts[name].activateListeners(element);
        }

        if (hotbar) {
            this.mainElement?.appendChild(hotbar);
        }

        if (this.effectsElement) {
            this.mainElement?.append(this.effectsElement);
        }
    }

    _onRender(context: PersistentContext, options: PersistentRenderOptions) {
        this.sidebar?.render(true);
    }

    _actorCleanup() {
        this.toggleSidebar(null);

        this.#actor = null;
        this.#isUserCharacter = false;

        super._actorCleanup();
    }

    _onClose(options: ApplicationClosingOptions) {
        for (const key in this.#elements) {
            this.#elements[key as PartName]?.remove();
            this.#elements[key as PartName] = null;
        }

        super._onClose(options);
    }

    async close(options?: ApplicationClosingOptions & { forced?: boolean }): Promise<this> {
        if (!options?.forced) return this;

        const hotbar = document.getElementById("hotbar");
        if (hotbar) {
            document.getElementById("ui-bottom")?.prepend(hotbar);
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

    async setActor(
        actor: ActorPF2e | null,
        { token, skipSave, force }: { token?: Token; skipSave?: boolean; force?: boolean } = {}
    ) {
        if (actor && !this.isValidActor(actor)) return;

        const user = game.user;
        const userActor = user.character;
        const autoSet = this.getSetting("autoSet");
        if (!force && !actor && autoSet === "select" && !userActor) return;

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

            const tokens = token ? [token] : actor.getActiveTokens();

            for (const token of tokens) {
                if (hud.token.token === token) hud.token.close();
                if (hud.tooltip.token === token) hud.tooltip.close();
            }
        }

        this.#isUserCharacter = actor === game.user.character;
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

    getShortcut<T extends Shortcut>(
        groupIndex: Maybe<number | string>,
        index: Maybe<number | string>
    ) {
        return this.#shortcuts[`${groupIndex}-${index}`] as T | undefined;
    }

    getShortcutFromElement<T extends Shortcut>(el: HTMLElement) {
        const { groupIndex, index } = el.dataset;
        return this.getShortcut<T>(groupIndex, index);
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

    #onDeleteActor(doc: ActorPF2e | TokenDocumentPF2e) {
        const actor = doc instanceof Actor ? doc : doc.actor;
        if (this.isCurrentActor(actor)) {
            this.setActor(null, { skipSave: true, force: true });
        }
    }

    #onRenderActorSheet(sheet: ActorSheetPF2e, $html: JQuery) {
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

    #onDeleteCombat() {
        if (this.savedActor) return;

        this.setActor(null, { skipSave: true, force: true });
    }

    #onCombatTurnChange() {
        if (this.savedActor) return;

        const combatant = game.combat?.combatants.get(game.combat?.current.combatantId ?? "");
        const actor = this.isValidActor(combatant?.actor) ? combatant.actor : null;

        if (actor) {
            this.setActor(actor, { skipSave: true });
        }
    }

    #onControlToken() {
        if (this.savedActor) return;

        const token = R.only(canvas.tokens.controlled);

        if (this.isValidActor(token?.actor)) {
            this.setActor(token.actor, { token, skipSave: true });
        } else {
            this.setActor(null, { token, skipSave: true });
        }
    }

    #onRenderHotbar() {
        this.render();
    }

    setSelectedToken() {
        const tokens = canvas.tokens.controlled;
        const token = tokens[0];

        if (tokens.length !== 1 || !this.isValidActor(token.actor)) {
            return warn("persistent.error.selectOne");
        }

        this.setActor(token.actor, { token });
    }

    #prepareMenuContext(context: PersistentContext, options: PersistentRenderOptions): MenuContext {
        const setTooltipParts = [["setActor", "leftClick"]];
        const hasSavedActor = !!this.savedActor;
        if (hasSavedActor) setTooltipParts.push(["unsetActor", "rightClick"]);

        const setActorTooltip = setTooltipParts
            .map(([key, click]) => {
                let msg = localize("persistent.menu", key);
                if (hasSavedActor) msg = `${localize(click)} ${msg}`;
                return `<div>${msg}</div>`;
            })
            .join("");

        return {
            ...context,
            hasSavedActor,
            setActorTooltip,
            hotbarLocked: ui.hotbar.locked,
        };
    }

    #activateMenuListeners(html: HTMLElement) {
        const actor = this.actor;

        addListener(html, "[data-action='select-actor']", "contextmenu", () => {
            this.setActor(null, { force: true });
        });

        addListenerAll(html, "[data-action]", (event, el) => {
            const action = el.dataset.action as MenuActionEvent;

            switch (action) {
                case "toggle-users": {
                    this.setSetting("showUsers", !this.getSetting("showUsers"));
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
                    this.setSelectedToken();
                    break;
                }
                case "toggle-clean": {
                    this.setSetting("cleanPortrait", !this.getSetting("cleanPortrait"));
                    break;
                }
            }
        });
    }

    async #prepareEffectsContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<PersistentContext | EffectsContext> {
        const actor = this.actor;
        if (!actor) return context;

        const expiredLabel = game.i18n.localize("PF2E.EffectPanel.Expired");
        const untileEndLabel = game.i18n.localize("PF2E.EffectPanel.UntilEncounterEnds");
        const unlimitedLabel = game.i18n.localize("PF2E.EffectPanel.UnlimitedDuration");

        const effects = actor.itemTypes.effect.map((effect) => {
            const duration = effect.totalDuration;
            const { system } = effect;
            if (duration === Infinity) {
                if (system.duration.unit === "encounter") {
                    system.remaining = system.expired ? expiredLabel : untileEndLabel;
                } else {
                    system.remaining = unlimitedLabel;
                }
            } else {
                const duration = effect.remainingDuration;
                system.remaining = system.expired
                    ? expiredLabel
                    : getRemainingDurationLabel(
                          duration.remaining,
                          system.start.initiative ?? 0,
                          system.duration.expiry
                      );
            }
            return effect;
        });

        const conditions = actor.conditions.active;
        const afflictions = actor.itemTypes.affliction ?? [];

        const descriptions = {
            afflictions: await getEnrichedDescriptions(afflictions),
            conditions: await getEnrichedDescriptions(conditions),
            effects: await getEnrichedDescriptions(effects),
        };

        const instructions = this.getSetting("shiftEffects")
            ? this.effectsShiftInstructions
            : this.effectsInstructions;

        const data: EffectsContext = {
            ...context,
            afflictions,
            conditions,
            descriptions,
            effects,
            actor,
            instructions,
            user: { isGM: context.isGM },
        };

        return data;
    }

    #activateEffectsListeners(html: HTMLElement) {
        const actor = this.actor as ActorPF2e;
        if (!actor) return;

        const getEffect = (el: HTMLElement) => {
            const itemId = htmlClosest(el, "[data-item-id]")!.dataset.itemId ?? "";
            return actor.conditions.get(itemId) ?? actor?.items.get(itemId);
        };

        addListenerAll(html, ".effect-item[data-item-id] .icon", "mousedown", (event, el) => {
            if (!event.shiftKey && this.getSetting("shiftEffects")) return;

            const effect = getEffect(el);
            if (!effect) return;

            const isAbstract = isInstanceOf(effect, "AbstractEffectPF2e");

            if (event.button === 0) {
                if (effect.isOfType("condition") && effect.slug === "persistent-damage") {
                    const token = getFirstActiveToken(actor, false, true);
                    effect.onEndTurn({ token });
                } else if (isAbstract) {
                    effect.increase();
                }
            } else if (event.button === 2) {
                if (isAbstract) {
                    effect.decrease();
                } else {
                    // Failover in case of a stale effect
                    this.render();
                }
            }
        });

        addListenerAll(html, "[data-action=recover-persistent-damage]", (event, el) => {
            const effect = getEffect(el);
            if (effect?.isOfType("condition")) {
                effect.rollRecovery();
            }
        });

        addListenerAll(html, "[data-action=edit]", (event, el) => {
            const effect = getEffect(el);
            if (!effect) return;

            if (effect.isOfType("condition") && effect.slug === "persistent-damage") {
                new PersistentDialog(actor, { editing: effect.id }).render(true);
            } else {
                effect.sheet.render(true);
            }
        });

        addListenerAll(html, "[data-action=send-to-chat]", (event, el) => {
            const effect = getEffect(el);
            effect?.toMessage();
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

    async #prepareMainContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<MainContext | PersistentContext> {
        const isGM = game.user.isGM;
        const actor = this.actor;
        if (!actor) return context;

        const isNPC = actor.isOfType("npc");
        const noShortcuts = !getFlag(actor, "persistent.shortcuts", game.user.id);
        const autoFill = isGM && isNPC && noShortcuts && this.getSetting("autoFillNpc");
        const shortcutsOwner = (() => {
            if (!isGM || isNPC || !noShortcuts || !this.getSetting("ownerShortcuts")) return;
            const owner = getOwner(actor, false)?.id;
            return owner && getFlag(actor, "persistent.shortcuts", owner) ? owner : undefined;
        })();

        this.#shortcuts = {};
        this.#shortcutData = {};
        this.#isVirtual = !!shortcutsOwner || autoFill;

        const cached: ShortcutCache = {};
        const shortcutGroups: ShortcutGroup[] = [];
        const nbSlots = this.getSetting("shortcutSlots");

        for (const groupIndex of R.range(0, nbSlots)) {
            let isAttack = false;
            const shortcuts: (Shortcut | EmptyShortcut)[] = [];

            for (const index of R.range(0, 4)) {
                const shortcut: Shortcut | EmptyShortcut = isAttack
                    ? { index: String(index), groupIndex: String(groupIndex), isEmpty: true }
                    : autoFill
                    ? await this.#fillShortcut(groupIndex, index, cached)
                    : await this.#createShortcutFromFlag(groupIndex, index, cached, shortcutsOwner);

                shortcuts.push(shortcut);
                this.#shortcuts[`${groupIndex}-${index}`] = shortcut;

                if (index === 0 && !shortcut.isEmpty && shortcut.type === "attack") {
                    isAttack = true;
                }
            }

            const firstShortcut = shortcuts.find(
                (shortcut): shortcut is Shortcut => "type" in shortcut
            );
            const split = !!firstShortcut && firstShortcut.type !== "attack";

            shortcutGroups.push({
                split,
                shortcuts: split ? shortcuts : [firstShortcut ?? shortcuts[0]],
            });
        }

        const data: MainContext = {
            ...context,
            ...getAdvancedStats(actor),
            sidebars: getSidebars(actor, this.sidebar?.key),
            shortcutGroups,
            noShortcuts,
            isVirtual: this.isVirtual,
            isAutoFill: autoFill,
            isOwnerShortcuts: !!shortcutsOwner,
            showEffects: options.showEffects,
            variantLabel,
        };

        return data;
    }

    #activateMainListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addStatsAdvancedListeners(this.actor, html);
        addSidebarsListeners(this, html);

        addListener(html, "[data-action='toggle-effects']", () => {
            this.setSetting("showEffects", !this.getSetting("showEffects"));
        });

        addListenerAll(html, ".stretch .shotcut-menus [data-action]", async (event, el) => {
            const action = el.dataset.action as ShortcutMenusAction;

            const confirmAction = (key: string) => {
                const name = actor.name;
                const title = localize("persistent.main.shortcut", key, "title");

                return confirmDialog({
                    title: `${name} - ${title}`,
                    content: localize("persistent.main.shortcut", key, "message", { name }),
                });
            };

            switch (action) {
                case "delete-shortcuts": {
                    const confirm = await confirmAction("delete");
                    if (!confirm) return;

                    return unsetFlag(actor, "persistent.shortcuts", game.user.id);
                }

                case "fill-shortcuts": {
                    const confirm = await confirmAction("fill");
                    if (!confirm) return;

                    this.#shortcutData = {};
                    const cached: ShortcutCache = {};
                    const nbSlots = this.getSetting("shortcutSlots");

                    for (const groupIndex of R.range(0, nbSlots)) {
                        let isAttack = false;

                        for (const index of R.range(0, 4)) {
                            const shortcut: Shortcut | EmptyShortcut = isAttack
                                ? {
                                      index: String(index),
                                      groupIndex: String(groupIndex),
                                      isEmpty: true,
                                  }
                                : await this.#fillShortcut(groupIndex, index, cached);

                            if (index === 0 && !shortcut.isEmpty && shortcut.type === "attack") {
                                isAttack = true;
                            }
                        }
                    }

                    return this.#overrideShortcutData();
                }

                case "copy-owner-shortcuts": {
                    const owner = getOwner(actor, false)?.id;
                    const userShortcuts = owner
                        ? getFlag<UserShortcutsData>(actor, "persistent.shortcuts", owner)
                        : undefined;

                    if (!userShortcuts || foundry.utils.isEmpty(userShortcuts)) {
                        return warn("persistent.main.shortcut.owner.none");
                    }

                    const confirm = await confirmAction("owner");
                    if (!confirm) return;

                    return setFlag(
                        actor,
                        "persistent.shortcuts",
                        game.user.id,
                        foundry.utils.deepClone(userShortcuts)
                    );
                }
            }
        });

        const shortcutElements = html.querySelectorAll<HTMLElement>(
            ".stretch .shortcuts .shortcut"
        );
        for (const shortcutElement of shortcutElements) {
            const classList = [...shortcutElement.classList];

            shortcutElement.addEventListener("drop", (event) => {
                this.#onShortcutDrop(event, shortcutElement);
            });

            shortcutElement.addEventListener("mouseleave", () => {
                shortcutElement.classList.remove("show-damage");
                shortcutElement.classList.remove("use-variant");
            });

            shortcutElement.addEventListener("contextmenu", () => {
                this.#onDeleteShortcut(shortcutElement);
            });

            if (!arrayIncludes(["empty", "disabled", "attack"], classList)) {
                shortcutElement.addEventListener("click", async (event) => {
                    this.#onShortcutClick(event, shortcutElement);
                });
            }

            addListenerAll(shortcutElement, "[data-action]", (event, el) =>
                this.#onShortcutAction(event, shortcutElement, el)
            );

            addListenerAll(shortcutElement, ".variants .category > *", () => {
                shortcutElement.classList.toggle("use-variant");
            });

            const auxilaryElements = shortcutElement.querySelectorAll<HTMLElement>(
                "[data-action='auxiliary-action']"
            );
            for (const auxilaryElement of auxilaryElements) {
                auxilaryElement.dataset.tooltip = auxilaryElement.innerHTML.trim();
            }
        }
    }

    #onDeleteShortcut(shortcutElement: HTMLElement) {
        const actor = this.actor!;
        const { groupIndex, index } = elementDataset(shortcutElement);

        if (this.isVirtual) {
            if (this.#shortcutData[groupIndex]?.[index]) {
                delete this.#shortcutData[groupIndex][index];
            }
            this.#overrideShortcutData();
        } else {
            unsetFlag(actor, "persistent.shortcuts", game.user.id, groupIndex, index);
        }
    }

    async #onShortcutClick(event: MouseEvent, shortcutElement: HTMLElement) {
        const shortcut =
            this.getShortcutFromElement<Exclude<Shortcut, AttackShortcut>>(shortcutElement);
        if (!shortcut || shortcut.isEmpty || shortcut.isDisabled) return;

        const actor = this.actor!;

        function confirmUse(item: ItemPF2e) {
            return confirmShortcut("confirm", { name: item.name });
        }

        switch (shortcut.type) {
            case "skill": {
                if (!shortcut.item) return;
                rollStatistic(actor, event, shortcut);
                break;
            }

            case "consumable": {
                const item = shortcut.item;
                if (!item) return;

                const setting = this.getSetting("consumableShortcut");

                if (setting === "chat") {
                    return item.toMessage(event);
                }

                if (setting === "confirm" && !(await confirmUse(item))) return;

                return consumeItem(event, item);
            }

            case "toggle": {
                const { domain, itemId, option } = shortcut;
                return actor.toggleRollOption(domain, option, itemId ?? null);
            }

            case "action": {
                const item = shortcut.item;
                if (!item) return;

                if (!isUsableAction(item)) {
                    return new PF2eHudItemPopup({ actor, item, event }).render(true);
                }

                if (this.getSetting("confirmShortcut") && !(await confirmUse(item))) return;

                const toolbelt = getActiveModule("pf2e-toolbelt");
                if (!shortcut.effectUuid || !toolbelt?.api.stances.isValidStance(item)) {
                    return useAction(event, item);
                }

                return toolbelt.api.stances.toggleStance(
                    actor as CharacterPF2e,
                    shortcut.effectUuid
                );
            }

            case "spell": {
                const {
                    castRank: rank,
                    slotId,
                    collection,
                    item: spell,
                    notCarried,
                    annotation,
                    parentItem,
                } = shortcut;

                if (!spell) return;

                const setting = this.getSetting("confirmShortcut");

                if (notCarried) {
                    if (!annotation || !parentItem) return;

                    if (setting) {
                        const type = localize("sidebars.spells.action", annotation);
                        const name = parentItem.name;
                        const confirm = await confirmShortcut("draw", { type, name });

                        if (!confirm) return;
                    }

                    return changeCarryType(actor, parentItem, 1, annotation);
                }

                if (setting && !(await confirmUse(spell))) return;

                return (
                    spell.parentItem?.consume() ?? collection.entry.cast(spell, { rank, slotId })
                );
            }
        }
    }

    async #onShortcutAction(event: MouseEvent, shortcutElement: HTMLElement, el: HTMLElement) {
        const actor = this.actor!;
        const action = el.dataset.action as ShortcutActionEvent;

        const getStrike = async <T extends StrikeData>(el: HTMLElement, readyOnly = false) => {
            const shortcut = this.getShortcutFromElement<StrikeShortcut>(shortcutElement);
            if (!shortcut?.strike || shortcut.isEmpty) return null;
            return getStrikeVariant<T>(shortcut.strike, el, readyOnly);
        };

        switch (action) {
            case "toggle-damage": {
                shortcutElement?.classList.toggle("show-damage");
                break;
            }

            case "open-attack-popup": {
                if (actor.isOfType("character")) {
                    const { left, top, height } = this.mainElement!.getBoundingClientRect();
                    openAttackpopup(actor, el.dataset, { left, top: top - height - 100 });
                }
                break;
            }

            case "blast-attack": {
                const shortcut = this.getShortcutFromElement<BlastShortcut>(shortcutElement);
                if (!shortcut?.blast || shortcut.isEmpty) return;

                const mapIncreases = Math.clamp(Number(el.dataset.mapIncreases), 0, 2);
                return shortcut.blast.attack(event, mapIncreases, el);
            }

            case "blast-damage": {
                const shortcut = this.getShortcutFromElement<BlastShortcut>(shortcutElement);
                if (!shortcut?.blast || shortcut.isEmpty) return;
                return shortcut.blast.damage(event, el);
            }

            case "strike-attack": {
                const strike = await getStrike(el, true);
                const variantIndex = Number(el.dataset.variantIndex);
                return strike?.variants[variantIndex]?.roll({ event });
            }

            case "strike-damage":
            case "strike-critical": {
                const strike = await getStrike(el);
                const method = el.dataset.action === "strike-damage" ? "damage" : "critical";
                return strike?.[method]?.({ event });
            }

            case "auxiliary-action": {
                const strike = await getStrike<CharacterStrike>(el);
                const auxiliaryActionIndex = Number(el.dataset.auxiliaryActionIndex ?? NaN);
                strike?.auxiliaryActions?.at(auxiliaryActionIndex)?.execute();
                break;
            }

            case "channel-elements": {
                const action = actor.itemTypes.action.find((x) => x.slug === "channel-elements");

                if (!action) {
                    warn("persistent.main.shortcut.noChannelElements");
                    return;
                }

                return useAction(event, action);
            }
        }
    }

    async #onShortcutDrop(event: DragEvent, el: HTMLElement) {
        const dropData: DropData = TextEditor.getDragEventData(event);
        const wrongType = () => warn("persistent.main.shortcut.wrongType");
        const wrongActor = () => warn("persistent.main.shortcut.wrongActor");
        const wrongOrigin = () => warn("persistent.main.shortcut.wrongOrigin");

        if (!["Item", "RollOption", "Action"].includes(dropData.type ?? "")) {
            return wrongType();
        }

        if (
            dropData.type === "Item" &&
            dropData.itemType === "melee" &&
            typeof dropData.index === "number"
        ) {
            dropData.type = "Action";
        }

        const actor = this.actor!;

        let { index, groupIndex } = elementDataset(el);
        const shortcut = this.getShortcut(groupIndex, index);

        let newShortcut: ShortcutData | undefined;

        switch (dropData.type) {
            case "RollOption": {
                const { label, domain, option } = dropData as RollOptionData;
                if (
                    typeof label !== "string" ||
                    !label.length ||
                    typeof domain !== "string" ||
                    !domain.length ||
                    typeof option !== "string" ||
                    !option.length
                )
                    return wrongType();

                const item = fromUuidSync(dropData.uuid ?? "");
                if (!(isInstanceOf(item, "ItemPF2e") && item.isEmbedded)) return wrongType();
                if (!this.isCurrentActor(item.actor)) return wrongActor();

                newShortcut = {
                    type: "toggle",
                    index,
                    groupIndex,
                    domain,
                    option,
                    img: item.img,
                    itemId: item.id,
                    name: label,
                } satisfies ToggleShortcutData;

                break;
            }

            case "Item": {
                if ((!dropData.uuid && !dropData.entryId) || !dropData.itemType) {
                    return wrongType();
                }

                const item: Maybe<ItemPF2e> = dropData.entryId
                    ? (actor as CreaturePF2e).spellcasting.collections
                          .get(dropData.entryId)
                          ?.get(dropData.itemId as string)
                    : await fromUuid<ItemPF2e>(dropData.uuid as string);

                if (!item?.isOfType("consumable", "spell", "action", "feat")) return wrongType();

                if (
                    (dropData.actorLess && dropData.actorUUID !== actor.uuid) ||
                    (!dropData.actorLess && !this.isCurrentActor(item.actor))
                )
                    return wrongActor();

                if (item.isOfType("consumable")) {
                    if (event.ctrlKey && item.system.uses.autoDestroy) {
                        newShortcut = {
                            type: "consumable",
                            index,
                            groupIndex,
                            img: item.system.spell?.img ?? item.img,
                            name: item.name,
                            slug: itemSlug(item),
                        } satisfies GenericConsumableShortcutData;
                    } else {
                        newShortcut = {
                            type: "consumable",
                            itemId: item.id,
                            index,
                            groupIndex,
                        } satisfies TemporaryConsumableShortcutData;
                    }
                } else if (
                    item.isOfType("action") &&
                    dropData.actorLess &&
                    typeof dropData.uuid === "string" &&
                    typeof dropData.isStatistic &&
                    typeof dropData.actionId === "string"
                ) {
                    newShortcut = {
                        type: "skill",
                        index,
                        groupIndex,
                        itemUuid: dropData.uuid,
                        actionId: dropData.actionId,
                        statistic: dropData.statistic,
                        map: dropData.map ? (Number(dropData.map) as 1 | 2) : undefined,
                        agile: dropData.agile === "true",
                        variant: dropData.variant ?? undefined,
                        option: dropData.option,
                    } satisfies SkillShortcutData;
                } else if (item.isOfType("action", "feat")) {
                    newShortcut = {
                        type: "action",
                        index,
                        groupIndex,
                        itemId: item.id,
                        name: item.name,
                        img: getActionImg(item),
                        effectUuid: dropData.effectUuid,
                    } satisfies ActionShortcutData;
                } else if (item.isOfType("spell")) {
                    const { fromSidebar, itemType, entryId, slotId } = dropData;
                    const castRank = Number(dropData.castRank);
                    const groupId =
                        dropData.groupId === "cantrips" ? "cantrips" : Number(dropData.groupId);

                    if (!fromSidebar) return wrongOrigin();
                    if (!entryId || (groupId !== "cantrips" && isNaN(groupId)) || isNaN(castRank)) {
                        return wrongType();
                    }

                    newShortcut = {
                        type: "spell",
                        index,
                        groupIndex,
                        itemType,
                        itemId: item.id,
                        castRank,
                        entryId,
                        slotId: Number(slotId),
                        groupId,
                    } satisfies SpellShortcutData;
                }

                break;
            }

            case "Action": {
                if (typeof dropData.index !== "number" && !dropData.elementTrait)
                    return wrongType();

                const itemActor = resolveMacroActor(dropData.actorUUID);
                if (!this.isCurrentActor(itemActor)) return wrongActor();

                const { elementTrait, index: actionIndex } = dropData;

                index = "0";

                if (
                    actor.isOfType("character") &&
                    objectHasKey(CONFIG.PF2E.elementTraits, elementTrait)
                ) {
                    const blast = new game.pf2e.ElementalBlast(actor);
                    const config = blast.configs.find((c) => c.element === elementTrait);
                    if (!config) return wrongType();

                    newShortcut = {
                        type: "attack",
                        index,
                        groupIndex,
                        elementTrait,
                        img: config.img,
                        name: game.i18n.localize(config.label),
                    } satisfies BlastShortcutData;
                } else if (actionIndex !== undefined) {
                    const action = actor.system.actions[actionIndex];
                    if (!action) return wrongType();

                    newShortcut = createStrikeShortcutData(groupIndex, index, action);
                }

                break;
            }
        }

        if (!newShortcut) return;

        const group = this.isVirtual
            ? this.#shortcutData[groupIndex] ?? {}
            : foundry.utils.deepClone(
                  getFlag<Record<string, any>>(
                      actor,
                      "persistent.shortcuts",
                      game.user.id,
                      groupIndex
                  )
              ) ?? {};

        if (newShortcut.type === "attack") {
            const wasSplit =
                (shortcut && !shortcut.isEmpty && shortcut.type !== "attack") ||
                Object.values(group).some((x) => "type" in x && x.type !== "attack");

            if (wasSplit) {
                for (const key of Object.keys(group)) {
                    if (key === index) continue;
                    delete group[key];
                    group[`-=${key}`] = true;
                }
            }
        }

        if (group[index]) {
            const removedKeys: Record<string, any> = {};

            for (const key in group[index]) {
                if (key in newShortcut) continue;
                removedKeys[`-=${key}`] = true;
            }

            foundry.utils.mergeObject(newShortcut, removedKeys);
        }

        group[index] = newShortcut;

        if (this.isVirtual) {
            this.#overrideShortcutData();
        } else {
            setFlag(actor, "persistent.shortcuts", game.user.id, groupIndex, group);
        }
    }

    async #overrideShortcutData() {
        const userId = game.user.id;
        const actor = this.actor!;
        const shortcutData = foundry.utils.deepClone(this.#shortcutData);
        await unsetFlag(actor, "persistent.shortcuts", userId);
        await setFlag(actor, "persistent.shortcuts", userId, shortcutData);
    }

    async #fillShortcut(
        groupIndex: Maybe<number | string>,
        index: Maybe<number | string>,
        cached: ShortcutCache
    ): Promise<Shortcut | EmptyShortcut> {
        index = String(index);
        groupIndex = String(groupIndex);

        const emptyData: EmptyShortcut = {
            index,
            groupIndex,
            isEmpty: true,
        };

        const actor = this.actor as NPCPF2e;

        const returnShortcut = async (shortcutData: ShortcutData) => {
            const shortcut = await this.#createShortcut(shortcutData, cached);

            if (!shortcut.isEmpty) {
                foundry.utils.setProperty(
                    this.#shortcutData,
                    `${groupIndex}.${index}`,
                    shortcutData
                );
            }

            return shortcut;
        };

        const strike = actor.system.actions[Number(groupIndex)];
        if (strike) {
            const shortcutData = createStrikeShortcutData(groupIndex, index, strike);
            return returnShortcut(shortcutData);
        }

        const actions = [
            ["action", "autoFillActions"],
            ["reaction", "autoFillReactions"],
        ] as const;
        for (const [type, setting] of actions) {
            cached.fillActions ??= {};
            cached.fillActions[type] ??= { setting: this.getSetting(setting), index: 0 };
            if (!cached.fillActions[type]!.setting) continue;

            const action = actor.itemTypes.action
                .filter((x) => x.system.actionType.value === type)
                .at(cached.fillActions[type]!.index++);

            if (action) {
                const shortcutData: ActionShortcutData = {
                    type: "action",
                    index,
                    groupIndex,
                    itemId: action.id,
                    name: action.name,
                    img: getActionImg(action),
                    effectUuid: undefined,
                };

                return returnShortcut(shortcutData);
            }
        }

        const checkSpells = async () => {
            const entryData = await actor.spellcasting.regular.at(0)?.getSheetData();
            if (!entryData) return emptyData;

            cached.spells ??= { groupIndex: 0, index: 0 };

            let spellGroup = entryData.groups.at(cached.spells.groupIndex);

            while (spellGroup && cached.spells.index >= spellGroup.active.length) {
                cached.spells.index = 0;
                spellGroup = entryData.groups.at(++cached.spells.groupIndex);
            }

            if (spellGroup) {
                const slotIndex = cached.spells.index++;
                const active = spellGroup.active[slotIndex]!;

                const shortcutData: SpellShortcutData = {
                    type: "spell",
                    index,
                    groupIndex,
                    itemType: "spell",
                    entryId: entryData.id,
                    groupId: spellGroup.id,
                    itemId: active.spell.id,
                    slotId: entryData.isPrepared ? slotIndex : undefined,
                    castRank:
                        active.castRank ??
                        active.spell.system.location.heightenedLevel ??
                        active.spell.rank,
                };

                return returnShortcut(shortcutData);
            }
        };

        const checkConsumables = () => {
            cached.consumable ??= 0;

            const consumable = actor.itemTypes.consumable.at(cached.consumable++);
            if (!consumable) return emptyData;

            const shortcutData: TemporaryConsumableShortcutData = {
                type: "consumable",
                itemId: consumable.id,
                index,
                groupIndex,
            };

            return returnShortcut(shortcutData);
        };

        cached.autoFillType ??= this.getSetting("autoFillType");

        const checks =
            cached.autoFillType === "one"
                ? [checkSpells, checkConsumables]
                : [checkConsumables, checkSpells];

        for (const checkFn of checks) {
            const result = await checkFn();
            if (result && "type" in result) return result;
        }

        return emptyData;
    }

    async #createShortcutFromFlag<T extends Shortcut>(
        groupIndex: number,
        index: number,
        cached: CreateShortcutCache,
        owner?: string
    ) {
        const flag = getFlag<ShortcutData>(
            this.actor!,
            "persistent.shortcuts",
            owner ?? game.user.id,
            String(groupIndex),
            String(index)
        );

        return this.#createShortcut<T>(
            flag ?? { groupIndex: String(groupIndex), index: String(index) },
            cached
        );
    }

    async #createShortcut<T extends Shortcut>(
        shortcutData: ShortcutData | { groupIndex: string; index: string },
        cached: CreateShortcutCache
    ): Promise<T | EmptyShortcut> {
        const throwError = () => {
            MODULE.throwError("an error occured while trying to access the shortcut");
        };

        const { groupIndex, index } = shortcutData;
        const actor = this.actor as ActorPF2e;
        if (!actor || !groupIndex || isNaN(Number(groupIndex)) || !index || isNaN(Number(index))) {
            return throwError();
        }

        const emptyData: EmptyShortcut = {
            index,
            groupIndex,
            isEmpty: true,
        };

        if (!("type" in shortcutData)) return emptyData;

        const returnShortcut = async (shortcut: Shortcut) => {
            if (!shortcut.isEmpty) {
                foundry.utils.setProperty(
                    this.#shortcutData,
                    `${groupIndex}.${index}`,
                    shortcutData
                );
            }

            return shortcut as T;
        };

        switch (shortcutData.type) {
            case "skill": {
                const item = await fromUuid(shortcutData.itemUuid);
                if (!item || !isInstanceOf(item, "ItemPF2e") || !item.isOfType("action")) {
                    return throwError();
                }

                let name = (() => {
                    if (!shortcutData.statistic) return "";

                    const statisticLabel = game.i18n.localize(
                        shortcutData.statistic === "perception"
                            ? "PF2E.PerceptionLabel"
                            : CONFIG.PF2E.skillList[shortcutData.statistic]
                    );

                    return `${statisticLabel}: `;
                })();

                if (shortcutData.variant) {
                    const variant = getSkillVariantName(
                        shortcutData.actionId,
                        shortcutData.variant
                    );
                    name += `${variant} (${item.name})`;
                } else {
                    name += item.name;
                }

                if (shortcutData.map) {
                    const mapLabel = getMapLabel(shortcutData.map, shortcutData.agile);
                    name += ` (${mapLabel})`;
                }

                return {
                    ...shortcutData,
                    isDisabled: false,
                    isFadedOut: false,
                    item,
                    name,
                    img: getActionImg(item),
                    cost: getCost(item?.actionCost),
                } satisfies SkillShortcut as T;
            }

            case "action": {
                const item = actor.items.get(shortcutData.itemId);
                if (item && !item.isOfType("action", "feat")) return throwError();

                const name = item?.name ?? shortcutData.name;
                const frequency = item ? getActionFrequency(item) : undefined;
                const disabled = !item || frequency?.value === 0;

                const isActive = (() => {
                    const effectUUID = shortcutData.effectUuid;
                    if (!item || !effectUUID) return null;

                    const toolbelt = getActiveModule("pf2e-toolbelt");
                    if (!toolbelt?.api.stances.isValidStance(item)) return null;

                    return hasItemWithSourceId(actor, effectUUID, "effect");
                })();

                const hasEffect = (() => {
                    if (!item || isActive !== null || !item.system.selfEffect) return false;
                    return hasItemWithSourceId(actor, item.system.selfEffect.uuid, "effect");
                })();

                return returnShortcut({
                    ...shortcutData,
                    isDisabled: disabled,
                    isFadedOut: disabled,
                    item,
                    isActive,
                    img: item ? getActionImg(item) : shortcutData.img,
                    name: frequency ? `${name} - ${frequency.label}` : name,
                    frequency,
                    hasEffect,
                    cost: getCost(item?.actionCost),
                } satisfies ActionShortcut as T);
            }

            case "spell": {
                const { itemId, entryId, groupId, slotId } = shortcutData;
                const collection = (actor as CreaturePF2e).spellcasting.collections.get(entryId);
                const spell = collection?.get(itemId);
                const entry = collection?.entry;

                if (
                    !spell ||
                    !entry ||
                    !collection ||
                    isNaN(shortcutData.castRank) ||
                    !shortcutData.castRank.between(1, 10)
                ) {
                    return emptyData;
                }

                const castRank = shortcutData.castRank as OneToTen;

                cached.rankLabel ??= {};
                cached.rankLabel[castRank] ??= getRankLabel(castRank);
                const name = `${spell.name} - ${cached.rankLabel[castRank]}`;

                cached.spellcasting ??= {};
                cached.spellcasting[entryId] ??= await entry.getSheetData();
                const entrySheetData = cached.spellcasting[entryId] as SpellcastingSheetData;

                cached.dailiesModule ??= getActiveModule("pf2e-dailies");
                const dailiesModule = cached.dailiesModule as Maybe<PF2eDailiesModule>;

                cached.entryLabel ??= {};
                cached.entryLabel[entryId] ??= entrySheetData.statistic?.dc.value
                    ? `${entry.name} - ${game.i18n.format("PF2E.DCWithValue", {
                          dc: entrySheetData.statistic?.dc.value,
                          text: "",
                      })}`
                    : entry.name;
                const entryLabel = cached.entryLabel[entryId] as string;

                const isCantrip = spell.isCantrip;
                const isFocus = entrySheetData.isFocusPool;
                const isConsumable = entrySheetData.category === "items";
                const isPrepared = !!entrySheetData.isPrepared;
                const isFlexible = entrySheetData.isFlexible;
                const isCharges = entrySheetData.category === "charges";
                const isStaff = !!entrySheetData.isStaff;
                const isBroken = !isCantrip && isCharges && !dailiesModule;
                const isInnate = entrySheetData.isInnate;

                const canCastRank = (() => {
                    if (!isStaff || !dailiesModule) return false;

                    cached.canCastRank ??= {};
                    cached.canCastRank[castRank] ??= !!dailiesModule.api.canCastRank(
                        actor as CharacterPF2e,
                        castRank
                    );

                    return !!cached.canCastRank[castRank];
                })();

                const group = entrySheetData.groups.find((x) => x.id === groupId);
                const groupUses =
                    typeof group?.uses?.value === "number"
                        ? (group.uses as ValueAndMax)
                        : undefined;

                const active = slotId ? group?.active[slotId] : undefined;

                const uses =
                    isCantrip || isConsumable || (isPrepared && !isFlexible)
                        ? undefined
                        : isFocus
                        ? (actor as CreaturePF2e).system.resources?.focus
                        : isCharges && !isBroken
                        ? entrySheetData.uses
                        : isInnate && !spell.atWill
                        ? spell.system.location.uses
                        : groupUses;

                const parentType = isConsumable
                    ? (spell.parentItem?.category as Maybe<"wand" | "scroll">)
                    : undefined;

                const categoryIcon = isStaff
                    ? "fa-solid fa-staff"
                    : isCharges
                    ? "fa-solid fa-bolt"
                    : parentType === "wand"
                    ? "fa-solid fa-wand-magic-sparkles"
                    : parentType === "scroll"
                    ? "fa-solid fa-scroll"
                    : undefined;

                const expended =
                    isCantrip || isConsumable
                        ? false
                        : isStaff
                        ? !canCastRank
                        : uses
                        ? isCharges
                            ? uses.value < castRank
                            : uses.value === 0
                        : !!active?.expended;

                const notCarried = isConsumable
                    ? spell.parentItem?.carryType !== "held"
                    : isStaff
                    ? (entry as dailies.StaffSpellcasting).staff.carryType !== "held"
                    : false;

                const parentItem = isStaff
                    ? dailiesModule?.api.getStaffItem(actor as CharacterPF2e)
                    : spell.parentItem;

                const annotation =
                    notCarried && parentItem ? getActionAnnotation(parentItem) : undefined;

                return returnShortcut({
                    ...shortcutData,
                    isDisabled: expended || isBroken,
                    isFadedOut: expended || isBroken || notCarried,
                    rank: ROMAN_RANKS[castRank],
                    img: spell.img,
                    categoryIcon,
                    collection,
                    item: spell,
                    name: annotation ? `${getAnnotationTooltip(annotation)} - ${name}` : name,
                    uses,
                    entryLabel,
                    isBroken,
                    castRank: castRank,
                    isPrepared: isPrepared && !isFlexible && !isCantrip,
                    cost: getCost(spell.system.time),
                    notCarried,
                    isStaff,
                    parentItem,
                    annotation,
                } satisfies SpellShortcut as T);
            }

            case "consumable": {
                const isGeneric = "slug" in shortcutData;
                const item = isGeneric
                    ? actor.itemTypes.consumable.find(
                          (item) => itemSlug(item) === shortcutData.slug
                      )
                    : actor.items.get<ConsumablePF2e<CreaturePF2e>>(shortcutData.itemId);

                if (item && !item.isOfType("consumable")) return throwError();

                if (!isGeneric && !item) return emptyData;

                const quantity = item?.quantity ?? 0;
                const uses =
                    item?.uses.max && (item.uses.max > 1 || item.category === "wand")
                        ? item.uses.value
                        : undefined;
                const isOutOfStock = quantity === 0 || uses === 0;
                const categoryIcon =
                    item?.category === "scroll"
                        ? "fa-solid fa-scroll"
                        : item?.category === "wand"
                        ? "fa-solid fa-wand-magic-sparkles"
                        : undefined;

                const img =
                    item?.system.spell?.img ?? item?.img ?? (shortcutData as { img: string }).img;

                let name = item?.name ?? (shortcutData as { name: string }).name;
                if (uses !== undefined && quantity > 1) name += ` x ${quantity}`;

                return returnShortcut({
                    ...shortcutData,
                    isDisabled: item?.isAmmo || isOutOfStock,
                    rank: consumableRank(item, true),
                    quantity: uses ?? quantity,
                    categoryIcon,
                    isFadedOut: isOutOfStock,
                    isGeneric,
                    uses,
                    item,
                    name,
                    img,
                    cost: getCost(item?.system.spell?.system.time),
                } satisfies ConsumableShortcut as T);
            }

            case "attack": {
                const isBlast = "elementTrait" in shortcutData;

                if (isBlast) {
                    if (!actor.isOfType("character")) return throwError();

                    const blast = await getBlastData(actor, shortcutData.elementTrait);
                    const disabled = !blast;

                    const versatile = blast?.damageTypes.find((x) => x.selected)?.icon;

                    return returnShortcut({
                        ...shortcutData,
                        isDisabled: disabled,
                        isFadedOut: disabled,
                        isBlast: true,
                        versatile,
                        blast,
                    } satisfies AttackShortcut as T);
                } else {
                    const { itemId, slug } = shortcutData;
                    const strike = await getStrikeData(actor, { id: itemId, slug });
                    const disabled = !strike;
                    const isNPC = actor.isOfType("npc");

                    const img =
                        isNPC && strike?.item.range
                            ? imagePath("npc-range", "svg")
                            : strike?.item.img;

                    const additionalEffects =
                        strike && isNPC
                            ? (strike as ActionStrike<NPCStrike>).additionalEffects
                            : [];

                    const nameExtra = additionalEffects
                        .map((x) => game.i18n.localize(x.label))
                        .join(", ");

                    const name = strike
                        ? `${game.i18n.localize("PF2E.WeaponStrikeLabel")}: ${strike.label}`
                        : shortcutData.name;

                    const traits =
                        strike && isNPC
                            ? strike.traits.filter((x) => x.name !== "attack").map((x) => x.label)
                            : [];

                    const versatile =
                        strike && !isNPC
                            ? (strike as ActionStrike<CharacterStrike>).versatileOptions
                            : undefined;

                    return returnShortcut({
                        ...shortcutData,
                        isDisabled: disabled,
                        isFadedOut: disabled || !strike.ready || strike.quantity === 0,
                        strike,
                        versatile: versatile?.find((x) => x.selected)?.glyph,
                        img: img ?? shortcutData.img,
                        name: nameExtra ? `${name} (${nameExtra})` : name,
                        subtitle: traits.length ? traits.join(", ") : undefined,
                    } satisfies AttackShortcut as T);
                }
            }

            case "toggle": {
                const { domain, option } = shortcutData;
                const item = actor.items.get(shortcutData.itemId);
                const toggle = foundry.utils.getProperty<RollOptionToggle>(
                    actor,
                    `synthetics.toggles.${domain}.${option}`
                );
                const disabled = !item || !toggle?.enabled;
                const checked = !!toggle?.checked;
                const label = game.i18n.localize(
                    `PF2E.SETTINGS.EnabledDisabled.${checked ? "Enabled" : "Disabled"}`
                );

                return returnShortcut({
                    ...shortcutData,
                    isDisabled: disabled,
                    isFadedOut: disabled,
                    checked,
                    item,
                    img: item?.img ?? shortcutData.img,
                    name: item ? `${item.name} (${label})` : shortcutData.name,
                } satisfies ToggleShortcut as T);
            }
        }

        return emptyData;
    }
}

function isUsableAction(item: FeatPF2e | AbilityItemPF2e) {
    return (
        item.system.selfEffect ||
        item.frequency?.max ||
        foundry.utils.getProperty(item, "flags.pf2e-toolbelt.actionable.macro")
    );
}

function createStrikeShortcutData(
    groupIndex: string,
    index: string,
    strike: NPCStrike | CharacterStrike
): StrikeShortcutData {
    return {
        type: "attack",
        index,
        groupIndex,
        itemId: strike.item.id,
        slug: strike.slug,
        img: strike.item.img,
        name: `${game.i18n.localize("PF2E.WeaponStrikeLabel")}: ${strike.label}`,
    };
}

function getCost(costAction: { value: string | number } | ActionCost | undefined | null) {
    if (costAction == null) return undefined;

    const value = costAction.value;
    const type = "type" in costAction ? costAction.type : undefined;
    const cost = type && type !== "action" ? type : value;

    if (cost === null) return;
    if (typeof cost === "number") return cost;
    if (["reaction", "free"].includes(cost)) return cost;

    const costValue = Number(cost);
    return isNaN(costValue) ? (cost ? "extra" : undefined) : costValue;
}

function consumableRank(item: Maybe<ConsumablePF2e>, roman: true): RomanRank | undefined;
function consumableRank(item: Maybe<ConsumablePF2e>, roman?: false): OneToTen | undefined;
function consumableRank(
    item: Maybe<ConsumablePF2e>,
    roman?: boolean
): RomanRank | OneToTen | undefined {
    const rank = item?.system.spell
        ? item.system.spell.system.location.heightenedLevel ?? item.system.spell.system.level.value
        : undefined;
    return rank && roman ? ROMAN_RANKS[rank] : rank;
}

function itemSlug(item: ItemPF2e) {
    if (item.isOfType("consumable") && item.system.spell) {
        const spell = item.system.spell;
        const baseSlug = spell.system.slug ?? game.pf2e.system.sluggify(spell.name);
        const rank = consumableRank(item);
        return `${baseSlug}-rank-${rank}`;
    }
    return item.slug ?? game.pf2e.system.sluggify(item.name);
}

function confirmShortcut(key: string, titleData: object, contentData: object = titleData) {
    return confirmDialog({
        title: localize("persistent.main.shortcut", key, "title", titleData),
        content: localize("persistent.main.shortcut", key, "message", contentData),
    });
}

type ShortcutActionEvent =
    | "toggle-damage"
    | "open-attack-popup"
    | "blast-attack"
    | "blast-damage"
    | "strike-attack"
    | "strike-damage"
    | "strike-critical"
    | "auxiliary-action"
    | "channel-elements";

type ShortcutMenusAction = "delete-shortcuts" | "fill-shortcuts" | "copy-owner-shortcuts";

type ShortcutType = "action" | "attack" | "consumable" | "spell" | "toggle" | "skill";

type CreateShortcutCache = {
    rankLabel?: Partial<Record<OneToTen, string>>;
    spellcasting?: Record<string, SpellcastingSheetData>;
    dailiesModule?: Maybe<PF2eDailiesModule>;
    entryLabel?: Record<string, string>;
    canCastRank?: Partial<Record<OneToTen, boolean>>;
};

type FillShortcutCache = {
    spells?: { groupIndex: number; index: number };
    consumable?: number;
    autoFillType?: AutoFillSetting;
    fillActions?: Record<string, Maybe<{ index: number; setting: boolean }>>;
};

type ShortcutCache = CreateShortcutCache & FillShortcutCache;

type UserShortcutsData = Record<string, Record<string, ShortcutData>>;

type ShortcutDataBase<T extends ShortcutType> = {
    type: T;
    index: string;
    groupIndex: string;
};

type SpellShortcutData = ShortcutDataBase<"spell"> & {
    itemType: string;
    itemId: string;
    castRank: number;
    entryId: string;
    slotId: number | undefined;
    groupId: "cantrips" | number;
};

type ToggleShortcutData = ShortcutDataBase<"toggle"> & {
    itemId: string;
    domain: string;
    option: string;
    name: string;
    img: string;
};

type AttackShortcutDataBase = ShortcutDataBase<"attack"> & { img: string; name: string };

type StrikeShortcutData = AttackShortcutDataBase & {
    itemId: string;
    slug: string;
};

type BlastShortcutData = AttackShortcutDataBase & {
    elementTrait: ElementTrait;
};

type AttackShortcutData = BlastShortcutData | StrikeShortcutData;

type SkillShortcutData = ShortcutDataBase<"skill"> & {
    type: "skill";
    actionId: string;
    statistic?: SkillSlug | "perception";
    itemUuid: string;
    variant: string | undefined;
    map: 1 | 2 | undefined;
    agile: boolean;
    option: string | undefined;
};

type ActionShortcutData = ShortcutDataBase<"action"> & {
    itemId: string;
    name: string;
    img: string;
    effectUuid: string | undefined;
};

type ConsumableShortcutDataBase = ShortcutDataBase<"consumable">;

type GenericConsumableShortcutData = ConsumableShortcutDataBase & {
    slug: string;
    img: string;
    name: string;
};

type TemporaryConsumableShortcutData = ConsumableShortcutDataBase & {
    itemId: string;
};

type ConsumableShortcutData = GenericConsumableShortcutData | TemporaryConsumableShortcutData;

type ShortcutData =
    | ConsumableShortcutData
    | AttackShortcutData
    | ToggleShortcutData
    | ActionShortcutData
    | SpellShortcutData
    | SkillShortcutData;

type BaseShortCut<T extends ShortcutType> = ShortcutDataBase<T> & {
    name: string;
    isEmpty?: false;
    img: string;
    isDisabled: boolean;
    isFadedOut: boolean;
};

type SpellShortcut = BaseShortCut<"spell"> &
    SpellShortcutData & {
        categoryIcon: string | undefined;
        collection: SpellCollection<CreaturePF2e>;
        item: SpellPF2e<CreaturePF2e>;
        rank: string;
        uses: ValueAndMax | undefined;
        entryLabel: string;
        isBroken: boolean;
        isPrepared: boolean;
        cost: CostValue;
        castRank: OneToTen;
        notCarried: boolean;
        isStaff: boolean;
        parentItem: Maybe<ConsumablePF2e<CreaturePF2e> | PhysicalItemPF2e<CreaturePF2e>>;
        annotation: AuxiliaryActionPurpose;
    };

type CostValue = number | string | undefined;

type SkillShortcut = BaseShortCut<"skill"> &
    SkillShortcutData & {
        item: AbilityItemPF2e;
        cost: CostValue;
    };

type ActionShortcut = BaseShortCut<"action"> &
    ActionShortcutData & {
        item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e> | undefined;
        cost: CostValue;
        isActive: boolean | null;
        hasEffect: boolean;
        frequency: Maybe<{
            max: number;
            value: number;
            label: string;
        }>;
    };

type ToggleShortcut = BaseShortCut<"toggle"> &
    ToggleShortcutData & {
        item: ItemPF2e | undefined;
        checked: boolean;
    };

type ConsumableShortcut = BaseShortCut<"consumable"> &
    ConsumableShortcutData & {
        item: ConsumablePF2e<ActorPF2e> | undefined;
        cost: CostValue;
        quantity: number;
        uses: number | undefined;
        isGeneric: boolean;
        rank: RomanRank | undefined;
        categoryIcon: string | undefined;
    };

type BaseAttackShortcut = BaseShortCut<"attack"> &
    AttackShortcutData & {
        img: string;
        name: string;
        versatile: Maybe<string>;
    };

type BlastShortcut = BaseAttackShortcut & {
    isBlast: true;
    blast: ActionBlast | undefined;
};

type StrikeShortcut = BaseAttackShortcut & {
    strike: ActionStrike | undefined;
    subtitle: string | undefined;
};

type AttackShortcut = BlastShortcut | StrikeShortcut;

type Shortcut =
    | ConsumableShortcut
    | AttackShortcut
    | ToggleShortcut
    | ActionShortcut
    | SpellShortcut
    | SkillShortcut;

type EmptyShortcut = { index: string; groupIndex: string; isEmpty: true };

type ShortcutGroup = {
    split: boolean;
    shortcuts: (Shortcut | { index: string; groupIndex: string })[];
};

type RomanRank = (typeof ROMAN_RANKS)[number];

type EffectsContext = PersistentContext & {
    afflictions: AfflictionPF2e[];
    conditions: ConditionPF2e[];
    effects: EffectPF2e[];
    descriptions: {
        afflictions: string[];
        conditions: string[];
        effects: string[];
    };
    instructions: Record<string, string>;
    user: { isGM: boolean };
};

type MenuActionEvent =
    | "toggle-users"
    | "open-macros"
    | "toggle-hotbar-lock"
    | "open-sheet"
    | "select-actor"
    | "toggle-clean";

type MenuContext = PersistentContext & {
    hotbarLocked: boolean;
    hasSavedActor: boolean;
    setActorTooltip: string;
};

type PortraitContext = PersistentContext &
    StatsHeader &
    StatsHeaderExtras & {
        avatar: string;
        name: string;
    };

type MainContext = PersistentContext &
    StatsAdvanced & {
        sidebars: SidebarMenu[];
        shortcutGroups: ShortcutGroup[];
        noShortcuts: boolean;
        isVirtual: boolean;
        isAutoFill: boolean;
        isOwnerShortcuts: boolean;
        showEffects: boolean;
        variantLabel: typeof variantLabel;
    };

type PersistentTemplates = { name: PartName; element: HTMLElement }[];

type PartName = "menu" | "main" | "portrait" | "effects";

type PersistentHudActor = CharacterPF2e | NPCPF2e;

type PersistentRenderOptions = BaseActorRenderOptions & {
    cleaned: boolean;
    showEffects: boolean;
};

type Part<TContext extends PersistentContext> = {
    tooltipDirection?: "UP" | "DOWN" | "LEFT" | "RIGHT";
    classes?: string[];
    prepareContext: (
        context: PersistentContext,
        options: PersistentRenderOptions
    ) => Promise<TContext | PersistentContext> | TContext | PersistentContext;
    activateListeners: (html: HTMLElement) => void;
};

type Parts = {
    menu: Part<MenuContext>;
    portrait: Part<PortraitContext>;
    main: Part<MainContext>;
    effects: Part<EffectsContext>;
};

type PersistentContext = Omit<BaseActorContext<PersistentHudActor>, "actor" | "hasActor"> & {
    hasActor: true;
    actor: PersistentHudActor;
    isCharacter: boolean;
    isNPC: boolean;
    isGM: boolean;
};

type DropData = HotbarDropData & {
    fromSidebar?: boolean;
    entryId?: string;
    castRank?: StringNumber;
    slotId?: StringNumber;
    groupId?: StringNumber | "cantrips";
    itemId?: string;
    effectUuid?: string;
} & SkillDropData;

type SkillDropData = Partial<SkillVariantDataset> & {
    actionId?: string;
    statistic?: SkillSlug | "perception";
    isStatistic?: true;
    actorLess?: StringBoolean;
    option?: string;
};

type AutoSetSetting = "disabled" | "select" | "combat";
type AutoFillSetting = "one" | "two";

type PersistentUserSetting = {
    selected: string;
};

type PersistentSettings = BaseActorSettings &
    SidebarSettings &
    Record<CloseSetting, boolean> & {
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
    };

export { PF2eHudPersistent };
export type { AutoSetSetting };
