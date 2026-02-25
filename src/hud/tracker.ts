import {
    ActorPF2e,
    addListener,
    belongToPartyAlliance,
    canObserveActor,
    ContextMenuEntry,
    createToggleHook,
    createToggleKeybind,
    createToggleWrapper,
    EffectsPanel,
    EncounterPF2e,
    EncounterTracker,
    ErrorPF2e,
    getDispositionColor,
    getFlag,
    hasRolledInitiative,
    htmlClosest,
    htmlQuery,
    htmlQueryAll,
    ImageFilePath,
    KeybindingActionConfig,
    localize,
    R,
    render,
    RolledCombatant,
    setFlag,
    settingPath,
    SYSTEM,
    toggleHooksAndWrappers,
    TokenPF2e,
    unsetFlag,
    waitDialog,
} from "foundry-helpers";
import { getEntryFromHealthData } from "health-status";
import { getHealthStatusData } from "settings";
import Sortable, { SortableEvent } from "sortablejs";
import {
    BasePF2eHUD,
    calculateActorHealth,
    getStatistics,
    getTextureMask,
    HealthData,
    HealthSection,
    HUDSettingsList,
    rollInitiative,
    StatisticType,
} from ".";

class TrackerPF2eHUD extends BasePF2eHUD<TrackerSettings> {
    #alternate: boolean = false;
    #cancelScroll: boolean = false;
    #combatantsWrapper: Maybe<HTMLElement>;
    #activeCombatant: Maybe<HTMLElement>;
    #contextMenus: ContextMenuEntry[] = [];
    #sortable: Sortable | null = null;
    #trackerHeight = {
        offsetHeight: 0,
        clientHeight: 0,
        scrollHeight: 0,
    };

    #altKeybind = createToggleKeybind({
        name: "alternate",
        restricted: true,
        editable: [{ key: "ControlLeft", modifiers: [] }],
        onDown: () => {
            this.alternateControls(true);
        },
        onUp: () => {
            this.alternateControls(false);
        },
    });

    #notifyWrapper = createToggleWrapper(
        "OVERRIDE",
        "foundry.applications.sidebar.tabs.ChatLog.prototype._shouldShowNotifications",
        this.#shouldShowNotifications,
        { context: this },
    );

    #activeHooks = [
        createToggleHook("hoverToken", this.#onHoverToken.bind(this)),
        createToggleHook("renderEffectsPanel", (_panel: EffectsPanel, html: HTMLElement) => {
            this.#updateEffectsPanel(html);
        }),
        createToggleHook("targetToken", (_user, token) => {
            this.#refreshTargetDisplay(token);
        }),
    ];
    #combatHook = createToggleHook("renderCombatTracker", this.#onRenderCombatTracker.bind(this));

    #combatTrackerHeightObserver = new ResizeObserver((entries) => {
        const trackerEvent = entries.find((entry) => entry.target === this.element);
        if (!trackerEvent) return;

        this.#trackerHeight = {
            offsetHeight: trackerEvent.contentRect.height,
            clientHeight: this.combatantsWrapper?.clientHeight ?? 0,
            scrollHeight: this.combatantsWrapper?.scrollHeight ?? 0,
        };

        this.interfaceElement?.classList.toggle(
            "pf2e-hud-tracker-tall",
            this.#trackerHeight.offsetHeight > window.innerHeight / 2,
        );

        this.#updateEffectsPanel();
        this.#scrollToCurrent();
    });

    static DEFAULT_OPTIONS: DeepPartial<fa.ApplicationConfiguration> = {
        id: "pf2e-hud-tracker",
        window: {
            positioned: false,
        },
    };

    get keybindsSchema(): KeybindingActionConfig[] {
        return [this.#altKeybind.configs];
    }

    get settingsSchema(): HUDSettingsList<TrackerSettings> {
        return [
            {
                key: "started",
                type: Boolean,
                default: false,
                scope: "world",
                onChange: () => {
                    this.#onRenderCombatTracker();
                },
            },
            {
                key: "partyAsObserved",
                type: Boolean,
                default: false,
                scope: "world",
                onChange: () => {
                    this.#onRenderCombatTracker();
                },
            },
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "user",
                hint: settingPath("enabled.hint"),
                name: settingPath("enabled.name"),
                onChange: () => {
                    this._configurate();
                },
            },
            {
                key: "textureScaling",
                type: Boolean,
                default: true,
                scope: "user",
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "collapsed",
                type: Boolean,
                default: false,
                scope: "user",
                config: false,
                onChange: () => {
                    this.render();
                },
            },
        ];
    }

    get key(): "tracker" {
        return "tracker";
    }

    get tracker(): EncounterTracker<EncounterPF2e | null> | null {
        return ui.combat;
    }

    get viewed(): Maybe<EncounterPF2e> {
        return this.tracker?.viewed;
    }

    get combatantsWrapper(): Maybe<HTMLElement> {
        return this.#combatantsWrapper;
    }

    get combatantsElements(): NodeListOf<HTMLElement> | HTMLElement[] {
        return this.combatantsWrapper?.querySelectorAll<HTMLElement>(".combatant") ?? [];
    }

    get activeCombatant(): Maybe<HTMLElement> {
        return this.#activeCombatant;
    }

    get interfaceElement(): Maybe<HTMLElement> {
        return document.getElementById("interface");
    }

    get effectsPanel(): HTMLElement | null {
        return document.getElementById("effects-panel");
    }

    get parentElement(): Maybe<HTMLElement> {
        return document.getElementById("ui-right-column-1");
    }

    get contextMenus(): ContextMenuEntry[] {
        if (this.#contextMenus.length) {
            return this.#contextMenus;
        }

        const menuItems = ui.combat._doEvent(ui.combat["_getEntryContextOptions"], {
            hookName: "get{}ContextOptions",
        });

        return (this.#contextMenus = menuItems as any);
    }

    protected _configurate(): void {
        const enabled = this.settings.enabled;

        this.#combatHook.toggle(enabled);

        if (enabled && this.shouldDisplay()) {
            this.render(true);
        } else {
            this.close();
        }
    }

    init(): void {
        this._configurate();
    }

    alternateControls(alternate: boolean) {
        if (alternate && this.combatantsWrapper) {
            const menus = this.contextMenus;

            for (const target of this.combatantsElements) {
                const controls = target.querySelectorAll<HTMLElement>(".combatant-control-alt");

                for (const control of controls) {
                    const index = Number(control.dataset.index);
                    const menu = menus.at(index);
                    const display = R.isFunction(menu?.condition) ? menu.condition(target) : !!menu;

                    control.classList.toggle("hidden", !display);
                }
            }
        }

        this.#alternate = alternate;
        this.element?.classList.toggle("alternate-controls", alternate);
    }

    shouldDisplay(combat: Maybe<EncounterPF2e> = this.viewed): boolean {
        if (!combat?.turns.length) return false;
        if (game.user.isGM) return true;

        const started = combat.started;
        if (!started && this.settings.started) return false;

        // we only show if they own an actor when the encounter hasn't started yet so they can roll init
        if (!started) {
            return combat.turns.some((combatant) => combatant.isOwner);
        }

        const partyAsObserved = this.settings.partyAsObserved;

        return combat.turns.some((combatant) => {
            const actor = combatant.actor;
            return actor && this.canObserveActor(actor, partyAsObserved);
        });
    }

    canObserveActor(actor: ActorPF2e, partyAsObserved: boolean = this.settings.partyAsObserved) {
        return canObserveActor(actor, true) || (partyAsObserved && belongToPartyAlliance(actor));
    }

    _configureRenderOptions(options: TrackerRenderOptions) {
        super._configureRenderOptions(options);

        options.collapsed = this.settings.collapsed;
        options.partyAsObserved = this.settings.partyAsObserved;
        options.textureScaling = this.settings.textureScaling;
    }

    async _prepareContext(options: TrackerRenderOptions): Promise<TrackerContext> {
        const isGM = game.user.isGM;
        const combat = this.viewed!;
        const combatant = combat.combatant;
        const tracker = this.tracker!;
        const combatScene = combat.scene;
        const canPing = game.user.hasPermission("PING_CANVAS");
        const tokenSetsNameVisibility = game.pf2e.settings.tokens.nameVisibility;
        const { partyAsObserved, textureScaling } = options;

        let canRoll = false;
        let canRollNPCs = false;

        const healthStatus = getHealthStatusData();
        const defaultLabels = getDefaultLabels();

        const tempHeader = game.i18n.localize("PF2E.TempHitPointsShortLabel");
        const healthHeader = game.i18n.localize("PF2E.HitPointsHeader");
        const createHealthTooltip = (canObserve: boolean, health: HealthData) => {
            if (!canObserve) {
                return getEntryFromHealthData(health, healthStatus);
            }

            let tooltip = `${healthHeader}: ${health.value}/${health.max}`;

            if (health.temp > 0) {
                tooltip = `${tempHeader}: ${health.temp}<br>${tooltip}`;
            }

            return tooltip;
        };

        const turns: TrackerTurn[] = [];

        for (let [index, combatant] of combat.turns.entries()) {
            const actor = combatant.actor;
            const hidden = combatant.hidden;
            const isOwner = combatant.isOwner;
            const isCurrent = index === combat.turn;
            const defeated = combatant.isDefeated;
            const initiative = combatant.initiative;
            const hasRolled = initiative !== null;
            const hasPlayerOwner = !!actor?.hasPlayerOwner;
            const playersCanSeeName = !tokenSetsNameVisibility || combatant.playersCanSeeName;
            const canObserve = !!actor && this.canObserveActor(actor, partyAsObserved);
            const canRollThis = isOwner && !hasRolled;

            const texture: TrackerTexture = {
                ...((textureScaling && combatant.token?.texture) || { scaleX: 1, scaleY: 1 }),
                img: await tracker["_getCombatantThumbnail"](combatant),
            };
            texture.mask = getTextureMask(texture);

            const toggleName: TrackerTurn["toggleName"] | false = isGM &&
                tokenSetsNameVisibility &&
                actor?.alliance !== "party" && {
                    active: playersCanSeeName,
                    tooltip: playersCanSeeName ? defaultLabels.hideName : defaultLabels.revealName,
                };

            const cssList = [
                hidden && "hide",
                isCurrent && "active",
                defeated && "defeated",
                !combatant.visible && "not-visible",
                !isGM && canRollThis && "can-roll",
            ];

            const color: string = R.pipe(
                getDispositionColor(actor).rgb,
                R.map((x) => x * 255),
                R.join(", "),
            );

            const health: TrackerHealth | undefined = (() => {
                if (!actor || (!canObserve && !healthStatus.enabled)) return;

                const health = calculateActorHealth(actor);
                if (!health) return;

                return {
                    hue: health.totalTemp.hue,
                    value: canObserve ? health.totalTemp.value : "???",
                    sp: health.sp,
                    tooltip: createHealthTooltip(canObserve, health),
                };
            })();

            turns.push({
                canObserve,
                canPing: canPing && combatant.sceneId === canvas.scene?.id,
                color,
                css: cssList.filter(R.isTruthy).join(" "),
                defeated,
                hasRolled,
                health,
                hidden,
                id: combatant.id,
                index,
                initiative: initiative ? Math.floor(initiative) : undefined,
                isDelayed: getFlag(combatant, "delayed") ?? false,
                isOwner,
                name: isGM || playersCanSeeName ? combatant.name : defaultLabels.unknown,
                texture,
                toggleName: toggleName || undefined,
            });

            canRoll ||= canRollThis;
            canRollNPCs ||= canRoll && !hasPlayerOwner;
        }

        const deathImg = game.settings.get(SYSTEM.id, "deathIcon") as ImageFilePath;

        const expand = {
            tooltip: options.collapsed ? "collapsed" : "expanded",
            collapsed: options.collapsed,
            icon: options.collapsed ? "fa-solid fa-compress" : "fa-solid fa-expand",
        };

        const linked = {
            icon: combatScene !== null ? "fa-solid fa-link" : "fa-solid fa-link-slash",
            tooltip: `COMBAT.ACTIONS.${combatScene !== null ? "LinkToScene" : "UnlinkFromScene"}`,
        };

        const nextCombatant = (() => {
            if (!options.collapsed || (!isGM && canRoll) || turns.length < 2) return;

            const combatantId = combatant?.id;
            const list = isGM ? turns : turns.filter(({ hidden, id }) => !hidden || id === combatantId);
            if (list.length < 2) return;

            const combatantIndex = list.findIndex(({ id }) => id === combatantId);
            if (combatantIndex === -1) return;

            let nextIndex = combatantIndex + 1;
            if (nextIndex >= list.length) nextIndex = 0;

            const nextCombatant = list[nextIndex];
            return foundry.utils.deepClone(turns[nextCombatant.index]);
        })();

        if (nextCombatant) {
            nextCombatant.css += " next";
            turns.push(nextCombatant);
        }

        return {
            canRoll,
            canRollNPCs,
            contextMenus: this.contextMenus,
            deathImg: deathImg && deathImg !== "icons/svg/skull.svg" ? deathImg : undefined,
            expand,
            hasActive: !!combatant && (isGM || !combatant.hidden),
            hasStarted: combat.started,
            isGM,
            isOwner: !!combatant?.isOwner,
            linked,
            metrics: buildMetrics(combat.metrics),
            round: combat.round,
            turns,
        };
    }

    protected _renderHTML(context: fa.ApplicationRenderContext, _options: TrackerRenderOptions): Promise<string> {
        return render("tracker", context);
    }

    protected _replaceHTML(result: string, content: HTMLElement, options: TrackerRenderOptions): void {
        content.innerHTML = result;
        content.dataset.tooltipClass = "pf2e-hud-element";
        content.dataset.tooltipDirection = "UP";
        content.classList.toggle("collapsed", options.collapsed);

        this.#combatantsWrapper = htmlQuery(content, ".combatants");
        this.#activeCombatant = htmlQuery(content, ".combatant.active");

        this.#refreshTargetDisplay();
        this.#activateListeners(content, options);
    }

    protected _insertElement(element: HTMLElement): HTMLElement {
        this.interfaceElement?.classList.add(this.id);
        this.parentElement?.appendChild(element);

        this.#notifyWrapper.activate();
        this.#combatTrackerHeightObserver.observe(element);

        return element;
    }

    protected async _onFirstRender(_context: object, _options: fa.ApplicationRenderOptions) {
        this.#altKeybind.activate();
        toggleHooksAndWrappers(this.#activeHooks, true);
    }

    protected async _onRender(_context: object, _options: fa.ApplicationRenderOptions) {
        this.#updateEffectsPanel();
        this.#scrollToCurrent();

        if (this.#alternate) {
            this.alternateControls(true);
        }
    }

    protected _onClose(_options: fa.ApplicationClosingOptions): void {
        this.#cancelScroll = false;
        this.#activeCombatant = null;
        this.#combatantsWrapper = null;

        this.#altKeybind.disable();
        toggleHooksAndWrappers(this.#activeHooks, false);

        this.effectsPanel?.style.removeProperty("max-height");
        this.interfaceElement?.classList.remove("pf2e-hud-tracker-tall");

        this.#notifyWrapper.disable();
        this.#combatTrackerHeightObserver.disconnect();
        this.interfaceElement?.classList.remove(this.id);

        this.#clearSortable();
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement) {
        event.preventDefault();
        event.stopPropagation();

        type EventAction =
            | "delay-turn"
            | "rollInitiative"
            | "toggle-expand"
            | "toggleNameVisibility"
            | "toggleTarget"
            | "trackerSettings";

        const action = target.dataset.action as EventAction;

        if (event.button === 2 && action === "rollInitiative") {
            return this.#onVariantInitiative(target, event);
        }

        if (event.button !== 0) return;

        if (action === "delay-turn") {
            return this.#delayAction(target);
        }

        if (action === "toggle-expand") {
            return (this.settings.collapsed = !this.settings.collapsed);
        }

        if (action === "toggleNameVisibility") {
            return this.#toggleNameVisibility(target);
        }

        if (action === "toggleTarget") {
            return this.#onClickToggleTarget(event, target);
        }

        if (action === "trackerSettings") {
            return new foundry.applications.apps.CombatTrackerConfig().render(true);
        }

        if (target.classList.contains("combatant-control")) {
            return this.tracker?.["_onCombatantControl"](event, target);
        }

        if (target.classList.contains("combatant-control-alt")) {
            return this.#onCombatantAltControl(target, event);
        }

        if (target.classList.contains("combat-control")) {
            return this.tracker?.["_onClickAction"](event, target);
        }
    }

    #toggleNameVisibility(target: HTMLElement) {
        const combatantId = target?.closest("li")?.dataset.combatantId;
        const combatant = this.viewed?.combatants.get(combatantId, { strict: true });
        combatant?.toggleNameVisibility();
    }

    #scrollToCurrent() {
        if (this.settings.collapsed || this.#cancelScroll) {
            this.#cancelScroll = false;
            return;
        }

        const clientHeight = this.#trackerHeight.clientHeight;
        const scrollHeight = this.#trackerHeight.scrollHeight;
        if (clientHeight === scrollHeight) return;

        const combatantsList = this.combatantsWrapper;
        const activeCombatant = this.activeCombatant;
        if (!combatantsList || !activeCombatant) return;

        combatantsList.scrollTop = activeCombatant.offsetTop - clientHeight / 2;
    }

    #updateEffectsPanel(effectsPanel = this.effectsPanel) {
        if (!effectsPanel) return;

        const offsetHeight = this.#trackerHeight.offsetHeight;
        effectsPanel.style.setProperty("max-height", `calc(100% - ${offsetHeight}px - 30px)`);
    }

    async #delayAction(target: HTMLElement) {
        const combat = this.viewed;
        const combatantId = htmlClosest(target, "[data-combatant-id]")?.dataset.combatantId ?? "";
        const combatant = combat?.combatants.get(combatantId);
        if (!combat || !combatant || !hasRolledInitiative(combatant)) return;

        const isDelayed = getFlag<boolean>(combatant, "delayed");

        if (!isDelayed) {
            return setFlag(combatant, "delayed", true);
        }

        await unsetFlag(combatant, "delayed");

        const currentCombatant = combat.combatant;

        if (!currentCombatant || currentCombatant === combatant) return;

        const newOrder = combat.turns.filter((c) => c !== combatant);
        const currentIndex = newOrder.indexOf(currentCombatant);

        newOrder.splice(currentIndex + 1, 0, combatant);

        return this.#newInitiativeOrder(
            newOrder.filter((c): c is RolledCombatant<EncounterPF2e> => hasRolledInitiative(c)),
            combatant,
            true,
        );
    }

    #onHoverToken(token: TokenPF2e, hovered: boolean) {
        const combatantId = token.combatant?.id;
        if (!combatantId) return;

        for (const el of this.combatantsElements) {
            el.classList.toggle("hovered", hovered && el.dataset.combatantId === combatantId);
        }
    }

    #refreshTargetDisplay(token?: TokenPF2e) {
        const combat = this.viewed;
        const combatantsWrapper = this.combatantsWrapper;
        const tokenCombatant = token?.combatant;

        if (!combatantsWrapper || !combat || !canvas.ready || (tokenCombatant && tokenCombatant.encounter !== combat))
            return;

        const user = game.user;
        const targetsIds = user.targets.ids;
        const combatants = tokenCombatant ? [tokenCombatant] : combat.turns;

        for (const combatant of combatants) {
            const token = combatant.token;
            if (!token) continue;

            const combatantElement = combatantsWrapper.querySelector(`[data-combatant-id="${combatant.id}"]`);
            if (!combatantElement) continue;

            const selfTargetIcon = htmlQuery(combatantElement, `[data-action="toggleTarget"]`);
            selfTargetIcon?.classList.toggle("active", targetsIds.includes(token.id));

            const targetsElement = htmlQuery(combatantElement, ".avatar .targets");
            if (!targetsElement) continue;

            targetsElement.innerHTML = R.pipe(
                token.object?.targeted.toObject() ?? [],
                R.filter((u) => u !== user),
                R.map((u) => `<div class="target" style="--user-color: ${u.color};"></div>`),
                R.join(""),
            );
        }
    }

    #onRenderCombatTracker(tracker: EncounterTracker<EncounterPF2e | null> | null = this.tracker) {
        if (tracker && this.shouldDisplay(tracker.viewed)) {
            this.render(true);
        } else {
            this.close();
        }
    }

    #clearSortable() {
        this.#sortable?.destroy();
        this.#sortable = null;
    }

    #selectCombatant(target: HTMLElement, event: MouseEvent) {
        event.preventDefault();

        const combatantId = htmlClosest(target, "[data-combatant-id]")?.dataset.combatantId ?? "";
        const combatant = this.viewed?.combatants.get(combatantId);
        if (!combatant) return;

        if (event.type === "dblclick") {
            combatant.actor?.sheet.render(true);
        } else {
            const token = combatant.token?.object;
            const controlled = token?.control({ releaseOthers: true });

            if (token && controlled) {
                canvas.animatePan(token.center);
            }
        }
    }

    #forceCombatantTurn(target: HTMLElement, event: MouseEvent) {
        event.preventDefault();

        const combat = this.viewed;
        if (!this.#alternate || !combat?.started) return;

        const combatantId = htmlClosest(target, "[data-combatant-id]")?.dataset.combatantId ?? "";
        const combatant = combat.combatants.get(combatantId);
        if (!combatant) return;

        const currentTurn = combat.turn ?? 0;
        const turn = combat.turns.findIndex((combatant) => combatant.id === combatantId);
        if (currentTurn === turn) return;

        const direction = turn < currentTurn ? -1 : 1;
        Hooks.callAll("combatTurn", combat, { turn }, { direction });
        combat.update({ turn }, { direction } as any);
    }

    #onCombatantAltControl(el: HTMLElement, _event: MouseEvent) {
        const index = Number(el.dataset.index);
        const menu = this.contextMenus.at(index);
        const target = htmlClosest(el, "[data-combatant-id]");

        if (target) {
            menu?.callback(target);
        }
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/a3856b6ae9c0427267b410bb81ff8d4cfefbeab4/src/module/apps/sidebar/encounter-tracker.ts#L267C18-L284C6
     */
    async #onClickToggleTarget(event: MouseEvent, target: HTMLElement): Promise<void> {
        const combatantId = target.closest("li")?.dataset.combatantId;
        const combatant = this.viewed?.combatants.get(combatantId, { strict: true });
        const tokenDoc = combatant?.token;
        if (!tokenDoc) return;

        const isTargeted = game.user.targets.values().some((t) => t.document === tokenDoc);
        if (!tokenDoc.object?.visible) {
            ui.notifications.warn("COMBAT.PingInvisibleToken", { localize: true });
            return;
        }

        tokenDoc.object.setTarget(!isTargeted, { releaseOthers: !event?.shiftKey });
    }

    async #onVariantInitiative(el: HTMLElement, event: Event) {
        const combatantId = htmlClosest(el, "[data-combatant-id]")?.dataset.combatantId;
        const actor = this.viewed?.combatants.get(combatantId ?? "")?.actor;
        if (!actor) return;

        const result = await waitDialog<{ statistic: StatisticType }>({
            classes: ["skills"],
            content: "dialogs/action-alternates",
            i18n: "dialogs.alternates",
            data: {
                label: game.i18n.localize("PF2E.InitiativeLabel"),
                statistic: actor.system.initiative?.statistic,
                statistics: getStatistics(actor),
            },
        });

        if (!result) return;

        rollInitiative(event, actor, result.statistic);
    }

    #shouldShowNotifications(): boolean {
        return false;
    }

    #activateListeners(_html: HTMLElement, options: TrackerRenderOptions) {
        const isGM = game.user.isGM;

        for (const combatantElement of this.combatantsElements) {
            combatantElement.addEventListener("pointerenter", (event) => {
                this.tracker?.["_onCombatantHoverIn"](event);
            });

            combatantElement.addEventListener("pointerleave", (event) => {
                this.tracker?.["_onCombatantHoverOut"](event);
            });

            if (!isGM) continue;

            addListener(combatantElement, ".name", this.#selectCombatant.bind(this));
            addListener(combatantElement, ".name", "dblclick", this.#selectCombatant.bind(this));
            addListener(combatantElement, ".avatar", this.#forceCombatantTurn.bind(this));
        }

        /**
         * GM only from here on
         */

        if (!isGM) return;

        this.#clearSortable();

        if (this.combatantsWrapper && !options.collapsed) {
            /**
             * updated version of
             * https://github.com/foundryvtt/pf2e/blob/a3856b6ae9c0427267b410bb81ff8d4cfefbeab4/src/module/apps/sidebar/encounter-tracker.ts#L301
             */
            this.#sortable = Sortable.create(this.combatantsWrapper, {
                animation: 200,
                dataIdAttr: "data-combatant-id",
                direction: "vertical",
                draggable: ".combatant",
                dragClass: "drag-preview",
                dragoverBubble: true,
                easing: "cubic-bezier(1, 0, 0, 1)",
                ghostClass: "drag-gap",
                onEnd: this.#adjustFinalOrder.bind(this),
                onUpdate: this.#onDropCombatant.bind(this),
                revertOnSpill: true,
            });
        }
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/a3856b6ae9c0427267b410bb81ff8d4cfefbeab4/src/module/apps/sidebar/encounter-tracker.ts#L408C1-L415C6
     */
    #validateDrop(event: SortableEvent): void {
        const encounter = this.viewed;
        if (!encounter) throw ErrorPF2e("Unexpected error retrieving combat");
        const { oldIndex, newIndex } = event;
        if (!(typeof oldIndex === "number" && typeof newIndex === "number")) {
            throw ErrorPF2e("Unexpected error retrieving new index");
        }
    }

    /**
     * converted version of
     * https://github.com/foundryvtt/pf2e/blob/a3856b6ae9c0427267b410bb81ff8d4cfefbeab4/src/module/apps/sidebar/encounter-tracker.ts#L315
     */
    async #onDropCombatant(event: Sortable.SortableEvent): Promise<void> {
        this.#validateDrop(event);

        const encounter = this.viewed;
        if (!encounter) return;

        const droppedId = event.item.getAttribute("data-combatant-id") ?? "";
        const dropped = encounter.combatants.get(droppedId, { strict: true });
        if (!hasRolledInitiative(dropped)) {
            ui.notifications.error("PF2E.Encounter.HasNoInitiativeScore", {
                format: { actor: dropped.name },
            });
            return;
        }

        const newOrder = R.pipe(
            htmlQueryAll(event.target, "li.combatant"),
            R.map((row) => row.getAttribute("data-combatant-id") ?? ""),
            R.map((id) => encounter.combatants.get(id, { strict: true })),
            R.filter((combatant): combatant is RolledCombatant<EncounterPF2e> => hasRolledInitiative(combatant)),
        );

        this.#newInitiativeOrder(newOrder, dropped);
    }

    /**
     * updated version of remaining code from split at
     * https://github.com/foundryvtt/pf2e/blob/a3856b6ae9c0427267b410bb81ff8d4cfefbeab4/src/module/apps/sidebar/encounter-tracker.ts#L330
     */
    async #newInitiativeOrder(
        newOrder: RolledCombatant<EncounterPF2e>[],
        dropped: RolledCombatant<EncounterPF2e>,
        nextTurn?: boolean,
    ) {
        const encounter = this.viewed;
        if (!encounter) return;

        const oldOrder = encounter.turns.filter((c) => c.initiative !== null);
        // Exit early if the order wasn't changed
        if (newOrder.every((c) => newOrder.indexOf(c) === oldOrder.indexOf(c))) return;

        this.#cancelScroll = true;

        this.#setInitiativeFromDrop(newOrder, dropped);
        await this.#saveNewOrder(newOrder);

        if (nextTurn) {
            await encounter.nextTurn();
        }
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/a3856b6ae9c0427267b410bb81ff8d4cfefbeab4/src/module/apps/sidebar/encounter-tracker.ts#L376
     */
    async #saveNewOrder(newOrder: RolledCombatant<EncounterPF2e>[]): Promise<void> {
        await this.viewed?.setMultipleInitiatives(
            newOrder.map((c) => ({
                id: c.id,
                value: c.initiative,
                overridePriority: c.overridePriority(c.initiative),
            })),
        );
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/a3856b6ae9c0427267b410bb81ff8d4cfefbeab4/src/module/apps/sidebar/encounter-tracker.ts#L341
     */
    #setInitiativeFromDrop(newOrder: RolledCombatant<EncounterPF2e>[], dropped: RolledCombatant<EncounterPF2e>): void {
        const aboveDropped = newOrder.find((c) => newOrder.indexOf(c) === newOrder.indexOf(dropped) - 1);
        const belowDropped = newOrder.find((c) => newOrder.indexOf(c) === newOrder.indexOf(dropped) + 1);

        const hasAboveAndBelow = !!aboveDropped && !!belowDropped;
        const hasAboveAndNoBelow = !!aboveDropped && !belowDropped;
        const hasBelowAndNoAbove = !aboveDropped && !!belowDropped;
        const aboveIsHigherThanBelow = hasAboveAndBelow && belowDropped.initiative < aboveDropped.initiative;
        const belowIsHigherThanAbove = hasAboveAndBelow && belowDropped.initiative < aboveDropped.initiative;
        const wasDraggedUp =
            !!belowDropped && this.viewed?.getCombatantWithHigherInit(dropped, belowDropped) === belowDropped;
        const wasDraggedDown = !!aboveDropped && !wasDraggedUp;

        // Set a new initiative intuitively, according to allegedly commonplace intuitions
        dropped.initiative =
            hasBelowAndNoAbove || (aboveIsHigherThanBelow && wasDraggedUp)
                ? belowDropped.initiative + 1
                : hasAboveAndNoBelow || (belowIsHigherThanAbove && wasDraggedDown)
                  ? aboveDropped.initiative - 1
                  : hasAboveAndBelow
                    ? belowDropped.initiative
                    : dropped.initiative;

        const withSameInitiative = newOrder.filter((c) => c.initiative === dropped.initiative);
        if (withSameInitiative.length > 1) {
            for (let priority = 0; priority < withSameInitiative.length; priority++) {
                const flag = withSameInitiative[priority].flags[SYSTEM.id];
                flag.overridePriority[dropped.initiative] = priority;
            }
        }
    }

    /**
     * updated version of
     * https://github.com/foundryvtt/pf2e/blob/a3856b6ae9c0427267b410bb81ff8d4cfefbeab4/src/module/apps/sidebar/encounter-tracker.ts#L387
     */
    #adjustFinalOrder(event: SortableEvent): void {
        const tracker = this.combatantsWrapper;
        if (!tracker) return;

        const row = event.item;
        const rows = htmlQueryAll(tracker, ".combatant");
        const [oldIndex, newIndex] = [event.oldIndex ?? 0, event.newIndex ?? 0];
        const firstRowWithNoRoll = rows.find((r) => !r.dataset.initiative);

        if (!row.dataset.initiative) {
            // Undo drag/drop of unrolled combatant
            if (newIndex > oldIndex) {
                tracker.insertBefore(row, rows[oldIndex]);
            } else {
                tracker.insertBefore(row, rows[oldIndex + 1]);
            }
        } else if (firstRowWithNoRoll && Array.from(rows).indexOf(firstRowWithNoRoll) < newIndex) {
            // Always place a rolled combatant before all other unrolled combatants
            tracker.insertBefore(row, firstRowWithNoRoll);
        }
    }
}

const _cached: {
    metricsTemplate?: HandlebarsTemplateDelegate;
    defaultLabels?: { hideName: string; revealName: string; unknown: string };
} = {};

function buildMetrics(metrics: EncounterPF2e["metrics"] | null): TrackerContext["metrics"] {
    if (!metrics) return;

    const metricsTemplate = (_cached.metricsTemplate ??= (() => {
        const template = `<div>
            {{localize 'PF2E.Encounter.Budget.Threat'}}:
            <span class="threat {{threat}}">{{localize (concat 'PF2E.Encounter.Budget.Threats.'
                threat)}}</span>
        </div>
        <div>
            {{@root.i18n 'award' xp=award.xp}} *
        </div>
        <div>
            {{localize 'PF2E.Encounter.Metrics.Budget' spent=budget.spent max=budget.max
            partyLevel=budget.partyLevel}}
        </div>
        <div class="small">
            *{{#if (eq award.recipients.length 1)}}
            {{localize 'PF2E.Encounter.Metrics.Award.Tooltip.Singular'}}
            {{else if (eq award.recipients.length 4)}}
            {{localize 'PF2E.Encounter.Metrics.Award.Tooltip.Four'}}
            {{else}}
            {{localize 'PF2E.Encounter.Metrics.Award.Tooltip.Plural' xpPerFour=budget.spent
            recipients=award.recipients.length}}
            {{/if}}
        </div>`;

        return Handlebars.compile(template);
    })());

    const tooltip = metricsTemplate(
        {
            ...metrics,
            i18n: localize.i18n("tracker"),
        },
        {
            allowProtoMethodsByDefault: true,
            allowProtoPropertiesByDefault: true,
        },
    );

    return {
        threat: metrics.threat,
        tooltip,
    };
}

function getDefaultLabels() {
    return (_cached.defaultLabels ??= {
        hideName: game.i18n.localize("PF2E.Encounter.HideName"),
        revealName: game.i18n.localize("PF2E.Encounter.RevealName"),
        unknown: localize("tracker.unknown"),
    });
}

type TrackerTexture = {
    img: string;
    mask?: string;
    scaleX: number;
    scaleY: number;
};

type TrackerHealth = {
    hue: number;
    sp: HealthSection | undefined;
    tooltip: string;
    value: number | "???";
};

type TrackerTurn = {
    canObserve: boolean;
    canPing: boolean;
    color: string;
    css: string;
    defeated: boolean;
    hasRolled: boolean;
    health: TrackerHealth | undefined;
    hidden: boolean;
    id: string;
    index: number;
    initiative: number | undefined;
    isDelayed: boolean;
    isOwner: boolean;
    name: string;
    texture: TrackerTexture;
    toggleName: Maybe<{ tooltip: string; active: boolean }>;
};

type TrackerContext = fa.ApplicationRenderContext & {
    canRoll: boolean;
    canRollNPCs: boolean;
    contextMenus: ContextMenuEntry[];
    deathImg: string | undefined;
    expand: { tooltip: string; collapsed: boolean; icon: string };
    hasActive: boolean;
    hasStarted: boolean;
    isGM: boolean;
    isOwner: boolean;
    linked: { icon: string; tooltip: string };
    metrics: Maybe<{ tooltip: string; threat: string }>;
    round: number;
    turns: TrackerTurn[];
};

type TrackerSettings = {
    collapsed: boolean;
    enabled: boolean;
    partyAsObserved: boolean;
    started: boolean;
    textureScaling: boolean;
};

type TrackerRenderOptions = fa.ApplicationRenderOptions & {
    collapsed: boolean;
    partyAsObserved: boolean;
    textureScaling: boolean;
};

export { TrackerPF2eHUD };
