import {
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderContext,
    EffectsPanel,
    EncounterPF2e,
    EncounterTrackerPF2e,
    ErrorPF2e,
    R,
    RolledCombatant,
    TokenPF2e,
    UserPF2e,
    addListener,
    addListenerAll,
    createHook,
    createTemporaryStyles,
    elementDataset,
    getDispositionColor,
    getFlag,
    getSetting,
    hasRolledInitiative,
    htmlClosest,
    htmlQueryAll,
    localize,
    render,
    rollInitiative,
    saveNewOrder,
    setFlag,
    setInitiativeFromDrop,
    templateLocalize,
    unsetFlag,
} from "module-helpers";
import Sortable, { SortableEvent } from "sortablejs";
import { getHealthStatus } from "../utils/health-status";
import { BaseRenderOptions, BaseSettings, PF2eHudBase } from "./base/base";
import { getHealth, userCanObserveActor } from "./shared/base";
import { getStatisticVariants } from "./sidebar/skills";

// Hooks.on("getSceneControlButtons", (controls) => {
//     controls[0].tools.push({
//         title: settingPath("tracker.title"),
//         name: "pf2e-hud-tracker",
//         icon: "fa-solid fa-swords",
//         toggle: true,
//         visible: true,
//         active: hud.tracker.enabled,
//         onClick: (active) => {
//             hud.tracker.setSetting("enabled", active);
//         },
//     });
// });

class PF2eHudTracker extends PF2eHudBase<TrackerSettings, any, TrackerRenderOptions> {
    #sortable: Sortable | null = null;

    #hoverTokenHook = createHook("hoverToken", this.#onHoverToken.bind(this));
    #targetTokenHook = createHook("targetToken", this.#refreshTargetDisplay.bind(this));
    #renderEffectsHook = createHook("renderEffectsPanel", this.#onRenderEffectsPanel.bind(this));
    #combatTrackerHook = createHook("renderCombatTracker", this.#onRenderCombatTracker.bind(this));

    #temporaryStyles = createTemporaryStyles();

    #combatTrackerHeightObserver = new ResizeObserver((entries) => {
        const trackerEvent = entries.find((e) => e.target === this.element);
        if (!trackerEvent) return;

        this.#trackerHeight = {
            offsetHeight: trackerEvent.contentRect.height,
            clientHeight: this.combatantsElement?.clientHeight ?? 0,
            scrollHeight: this.combatantsElement?.scrollHeight ?? 0,
        };

        this.#temporaryStyles.toggle(
            "#interface",
            "hud-tracker-tall",
            this.#trackerHeight.offsetHeight > window.innerHeight / 2
        );

        this.#updateEffectsPanel();
        this.#scrollToCurrent();
    });

    #toggled = false;
    #cancelScroll = false;
    #trackerHeight = {
        offsetHeight: 0,
        clientHeight: 0,
        scrollHeight: 0,
    };
    #combatantElement: HTMLElement | null = null;
    #combatantsElement: HTMLElement | null = null;
    #contextMenus: EntryContextOption[] = [];

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-tracker",
        classes: ["app"],
        window: {
            positioned: false,
        },
    };

    get SETTINGS_ORDER(): (keyof TrackerSettings)[] {
        return ["started", "enabled", "fontSize", "textureScaling"];
    }

    getSettings() {
        return super.getSettings().concat([
            {
                key: "started",
                type: Boolean,
                default: false,
                onChange: () => {
                    this.#onRenderCombatTracker(this.tracker);
                },
            },
            {
                key: "textureScaling",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: () => this.render(),
            },
            {
                key: "collapsed",
                type: Boolean,
                default: false,
                scope: "client",
                config: false,
                onChange: () => this.render(),
            },
        ]);
    }

    get key(): "tracker" {
        return "tracker";
    }

    get templates() {
        return ["tracker", "metrics-tooltip"];
    }

    get tracker() {
        return ui.combat;
    }

    get combat() {
        return this.tracker.viewed;
    }

    get combatantElement() {
        return this.#combatantElement;
    }

    get combatantsElement() {
        return this.#combatantsElement;
    }

    get contextMenus() {
        if (this.#contextMenus.length) return this.#contextMenus;

        // @ts-expect-error
        const menuItems = ui.combat._getEntryContextOptions();
        // @ts-expect-error
        ui.combat._callHooks((className: string) => `get${className}EntryContext`, menuItems);

        return (this.#contextMenus = menuItems);
    }

    _onClose(options: ApplicationClosingOptions) {
        this.#cancelScroll = false;
        this.#combatantElement = null;
        this.#combatantsElement = null;

        this.#combatTrackerHeightObserver.disconnect();

        const effectsPanel = document.getElementById("effects-panel");
        effectsPanel?.style.removeProperty("max-height");

        this.#temporaryStyles.clear();

        this.#clearSortable();

        super._onClose(options);
    }

    _onEnable(enabled = this.enabled) {
        this.#hoverTokenHook.toggle(enabled);
        this.#targetTokenHook.toggle(enabled);
        this.#combatTrackerHook.toggle(enabled);
        this.#renderEffectsHook.toggle(enabled);

        if (enabled && this.combat) {
            this.render(true);
        } else if (!enabled && this.rendered) {
            this.close();
        }

        // toggleControlTool("pf2e-hud-tracker", enabled);

        if (!canvas.ready) {
            Hooks.once("canvasReady", () => this.#refreshTargetDisplay());
        }
    }

    _configureRenderOptions(options: TrackerRenderOptions) {
        super._configureRenderOptions(options);

        options.collapsed = this.getSetting("collapsed");
        options.textureScaling = this.getSetting("textureScaling");
    }

    async _prepareContext(options: TrackerRenderOptions): Promise<TrackerContext> {
        const isGM = game.user.isGM;
        const unknown = localize("tracker.unknown");
        const parentData = await super._prepareContext(options);
        const combat = this.combat!;
        const combatant = combat.combatant;
        const turns: TrackerTurn[] = [];
        const canPing = game.user.hasPermission("PING_CANVAS");
        const useTextureScaling = options.textureScaling;
        const tokenSetsNameVisibility = game.pf2e.settings.tokens.nameVisibility;

        let canRoll = false;
        let canRollNPCs = false;

        const status = getSetting("healthStatusEnabled") ? getHealthStatus() : undefined;
        const hideNameLabel = game.i18n.localize("PF2E.Encounter.HideName");
        const revealNameLabel = game.i18n.localize("PF2E.Encounter.RevealName");

        for (let [i, combatant] of combat.turns.entries()) {
            const actor = combatant.actor;
            const hidden = combatant.hidden;
            const isOwner = combatant.isOwner;
            const isCurrent = i === combat.turn;
            const defeated = combatant.isDefeated;
            const initiative = combatant.initiative;
            const hasRolled = initiative !== null;
            const hasPlayerOwner = !!actor?.hasPlayerOwner;
            const playersCanSeeName = !tokenSetsNameVisibility || combatant.playersCanSeeName;
            const dispositionColor = getDispositionColor(actor);
            const canObserve = !!actor && userCanObserveActor(actor);

            const texture: TrackerTexture = {
                ...((useTextureScaling && combatant.token?.texture) || { scaleX: 1, scaleY: 1 }),
                // @ts-expect-error
                img: await this.tracker._getCombatantThumbnail(combatant),
            };

            if (texture.scaleX >= 1.2 || texture.scaleY >= 1.2) {
                const scale = texture.scaleX > texture.scaleY ? texture.scaleX : texture.scaleY;
                const ringPercent = 100 - Math.floor(((scale - 0.7) / scale) * 100);
                const limitPercent = 100 - Math.floor(((scale - 0.8) / scale) * 100);
                texture.mask = `radial-gradient(circle at center, black ${ringPercent}%, rgba(0, 0, 0, 0.2) ${limitPercent}%)`;
            }

            const toggleName = (() => {
                if (!isGM || !tokenSetsNameVisibility || actor?.alliance === "party") return;
                return {
                    active: playersCanSeeName,
                    tooltip: playersCanSeeName ? hideNameLabel : revealNameLabel,
                };
            })();

            const css: string[] = [];
            const canRollThis = isOwner && !hasRolled;

            if (hidden) css.push("hidden");
            if (isCurrent) css.push("active");
            if (defeated) css.push("defeated");
            if (!combatant.visible) css.push("not-visible");
            if (!isGM && canRollThis) css.push("can-roll");

            const health: TrackerHealth | undefined = (() => {
                if (!actor || (!canObserve && !status)) return;

                const health = getHealth(actor);
                if (!health) return;

                return {
                    hue: health.totalTemp.hue,
                    value: canObserve ? health.totalTemp.value : "???",
                    sp: health.useStamina
                        ? { hue: health.sp.hue, value: canObserve ? health.sp.value : "???" }
                        : undefined,
                    tooltip: canObserve
                        ? game.i18n.localize("PF2E.HitPointsHeader")
                        : this.getSelectedHealthStatusEntry(health, status),
                };
            })();

            const turn: TrackerTurn = {
                index: i,
                id: combatant.id,
                name: isGM || playersCanSeeName ? combatant.name : unknown,
                initiative: initiative ? Math.floor(initiative) : undefined,
                isDelayed: getFlag(combatant, "delayed") ?? false,
                hasRolled,
                texture,
                toggleName,
                hidden,
                defeated,
                canPing: canPing && combatant.sceneId === canvas.scene?.id,
                css: css.join(" "),
                isOwner,
                canObserve,
                health,
                color: dispositionColor.rgb.map((x) => x * 255).join(", "),
            };

            canRoll ||= canRollThis;
            canRollNPCs ||= canRoll && !hasPlayerOwner;

            turns.push(turn);
        }

        const metrics = await (async () => {
            const metrics = combat.metrics;
            if (!metrics) return;
            return {
                threat: metrics.threat,
                tooltip: await render("tracker/metrics-tooltip", metrics),
            };
        })();

        const hasActive = !!combatant && (isGM || !combatant.hidden);

        const nextCombatant = (() => {
            if (!options.collapsed || (!isGM && canRoll) || turns.length < 2) return;

            const combatantId = combatant?.id;
            const list = isGM
                ? turns
                : turns.filter(({ hidden, id }) => !hidden || id === combatantId);
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

        const combatScene = combat?.scene;
        const deathImg = game.settings.get("pf2e", "deathIcon");

        const data: TrackerContext = {
            ...parentData,
            isGM,
            round: combat.round,
            turns,
            metrics,
            hasActive,
            deathImg: !deathImg || deathImg === "icons/svg/skull.svg" ? undefined : deathImg,
            hasStarted: combat.started,
            canRoll,
            canRollNPCs,
            isOwner: !!combatant?.isOwner,
            expand: {
                tooltip: options.collapsed ? "collapsed" : "expanded",
                collapsed: options.collapsed,
                icon: options.collapsed ? "fa-solid fa-compress" : "fa-solid fa-expand",
            },
            linked: {
                icon: combatScene !== null ? "fa-solid fa-link" : "fa-solid fa-link-slash",
                tooltip: combatScene !== null ? "COMBAT.Linked" : "COMBAT.Unlinked",
            },
            contextMenus: this.contextMenus,
            i18n: templateLocalize("tracker"),
        };

        return data;
    }

    async _renderHTML(context: TrackerContext, options: TrackerRenderOptions): Promise<string> {
        return await this.renderTemplate("tracker", context);
    }

    _onFirstRender(context: ApplicationRenderContext, options: TrackerRenderOptions): void {
        this.#combatTrackerHeightObserver.observe(this.element);
        this.#temporaryStyles.add("#interface", "has-hud-tracker");
    }

    _replaceHTML(result: string, content: HTMLElement, options: TrackerRenderOptions): void {
        content.innerHTML = result;

        content.style.setProperty(`--font-size`, `${options.fontSize}px`);
        content.classList.toggle("collapsed", options.collapsed);
        content.classList.toggle("textureScaling", options.textureScaling);

        this.#combatantsElement = content.querySelector(".combatants")!;
        this.#combatantElement = this.#combatantsElement.querySelector(".combatant.active");

        this.#refreshTargetDisplay();
        this.#activateListeners(content, options);
    }

    _insertElement(element: HTMLElement) {
        element.dataset.tooltipDirection = "UP";
        document.getElementById("ui-top")?.after(element);
        return element;
    }

    _onRender(context: TrackerContext, options: TrackerRenderOptions) {
        this.#scrollToCurrent(options.collapsed);
        this.#updateEffectsPanel();
    }

    async #onDelayAction(el: HTMLElement) {
        const combat = this.combat;
        const combatantElement = htmlClosest(el, ".combatant")!;
        const combatant = combat?.combatants.get(combatantElement.dataset.combatantId, {
            strict: true,
        });
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
            combatant
        );
    }

    #onRenderCombatTracker(tracker: EncounterTrackerPF2e<EncounterPF2e | null>) {
        const combat = tracker.viewed;
        if (
            combat &&
            (game.user.isGM || !this.getSetting("started") || combat.started) &&
            combat.turns.some((combatant) => combatant.isOwner)
        ) {
            this.render(true);
        } else {
            this.close();
        }
    }

    toggleMenu(enabled: boolean) {
        if (enabled && this.combatantsElement) {
            const menus = this.contextMenus;
            const combatantElements =
                this.combatantsElement.querySelectorAll<HTMLElement>(".combatant");

            for (const combatantElement of combatantElements) {
                const target = $(combatantElement);
                const menuElements =
                    combatantElement.querySelectorAll<HTMLElement>(".combatant-control-alt");

                for (const menuElement of menuElements) {
                    const index = Number(menuElement.dataset.index);
                    const menu = menus.at(index);

                    const display =
                        menu?.condition !== undefined
                            ? typeof menu.condition === "function"
                                ? menu.condition(target)
                                : menu.condition
                            : true;

                    menuElement.classList.toggle("hidden", !display);
                }
            }
        }

        this.#toggled = enabled;
        this.element?.classList.toggle("toggle-menu", enabled);
    }

    #updateEffectsPanel(effectsPanel = document.getElementById("effects-panel")) {
        const trackerElement = this.element;
        if (!effectsPanel || !trackerElement) return;

        const offsetHeight = this.#trackerHeight.offsetHeight;
        effectsPanel.style.setProperty(
            "max-height",
            `calc(100% - ${offsetHeight}px - (var(--pf2e-hud-panel-gap) * 3) - 4px)`
        );
    }

    #scrollToCurrent(collapsed = this.getSetting("collapsed")) {
        if (collapsed || this.#cancelScroll) {
            this.#cancelScroll = false;
            return;
        }

        const combatantsList = this.combatantsElement;
        const activeCombatant = this.combatantElement;
        if (!combatantsList || !activeCombatant) return;

        const clientHeight = this.#trackerHeight.clientHeight;
        const scrollHeight = this.#trackerHeight.scrollHeight;
        if (clientHeight === scrollHeight) return;

        combatantsList.scrollTop = activeCombatant.offsetTop - clientHeight / 2;
    }

    #refreshTargetDisplay(_user?: UserPF2e, token?: TokenPF2e): void {
        const combat = this.combat;
        const combatantsElement = this.combatantsElement;
        const tokenCombatant = token?.combatant;
        if (
            !combatantsElement ||
            !combat ||
            !canvas.ready ||
            (tokenCombatant && tokenCombatant.encounter !== combat)
        )
            return;

        const user = game.user as UserPF2e;
        const targetsIds = user.targets.ids;
        const combatants = token?.combatant ? [token.combatant] : combat.turns;

        for (const combatant of combatants) {
            const token = combatant.token;
            if (!token) continue;

            const combatantElement = combatantsElement.querySelector(
                `[data-combatant-id="${combatant.id}"]`
            );
            if (!combatantElement) continue;

            const selfTargetIcon = combatantElement.querySelector(
                "[data-control='toggleTarget']"
            ) as HTMLElement;
            selfTargetIcon.classList.toggle("active", targetsIds.includes(token.id));

            const targetsElement = combatantElement.querySelector(
                ".avatar .targets"
            ) as HTMLElement;
            const targets = R.pipe(
                token.object?.targeted.toObject() ?? [],
                R.filter((u) => u !== user),
                R.map((u) => `<div class="target" style="--user-color: ${u.color};"></div>`)
            );

            targetsElement.innerHTML = targets.join("");
        }
    }

    #onSortableUpdate(event: SortableEvent) {
        const tracker = this.tracker;
        this.#validateDrop(event);

        const encounter = tracker.viewed;
        if (!encounter) return;

        const droppedId = event.item.getAttribute("data-combatant-id") ?? "";
        const dropped = encounter.combatants.get(droppedId, { strict: true });
        if (!hasRolledInitiative(dropped)) {
            ui.notifications.error(
                game.i18n.format("PF2E.Encounter.HasNoInitiativeScore", { actor: dropped.name })
            );
            return;
        }

        const newOrder = R.pipe(
            htmlQueryAll(event.target, "li.combatant"),
            R.map((row) => row.getAttribute("data-combatant-id") ?? ""),
            R.map((id) => encounter.combatants.get(id, { strict: true })),
            R.filter((combatant): combatant is RolledCombatant<EncounterPF2e> =>
                hasRolledInitiative(combatant)
            )
        );

        this.#newInitiativeOrder(newOrder, dropped);
    }

    #validateDrop(event: SortableEvent) {
        const { combat } = game;
        if (!combat) throw ErrorPF2e("Unexpected error retrieving combat");

        const { oldIndex, newIndex } = event;
        if (!(typeof oldIndex === "number" && typeof newIndex === "number")) {
            throw ErrorPF2e("Unexpected error retrieving new index");
        }
    }

    async #newInitiativeOrder(
        newOrder: RolledCombatant<EncounterPF2e>[],
        combatant: RolledCombatant<EncounterPF2e>
    ) {
        const tracker = this.tracker;
        const encounter = tracker.viewed;
        if (!encounter) return;

        const oldOrder = encounter.turns.filter((c) => c.initiative !== null);
        const allOrdersChecks = newOrder.every((c) => newOrder.indexOf(c) === oldOrder.indexOf(c));
        if (allOrdersChecks) return;

        this.#cancelScroll = true;

        setInitiativeFromDrop(encounter, newOrder, combatant);
        await saveNewOrder(encounter, newOrder);
        await encounter.nextTurn();
    }

    #onSortableEnd(event: SortableEvent) {
        const movedRow = event.item;
        const combatantsList = event.target;
        const rows = htmlQueryAll(combatantsList, ".combatant");
        const [oldIndex, newIndex] = [event.oldIndex ?? 0, event.newIndex ?? 0];
        const firstRowWithNoRoll = rows.find((row) => row.dataset.initiative === "null");

        if (movedRow.dataset.initiative === "null") {
            if (newIndex > oldIndex) {
                combatantsList.insertBefore(movedRow, rows[oldIndex]);
            } else {
                combatantsList.insertBefore(movedRow, rows[oldIndex + 1]);
            }
        } else if (firstRowWithNoRoll && rows.indexOf(firstRowWithNoRoll) < newIndex) {
            combatantsList.insertBefore(movedRow, firstRowWithNoRoll);
        }
    }

    #onCombatantClick(event: MouseEvent, el: HTMLElement) {
        event.preventDefault();

        const combat = this.combat;

        if (this.#toggled && combat?.started) {
            const currentTurn = combat.turn!;
            const { combatantId } = elementDataset(el);
            const turn = combat.turns.findIndex((combatant) => combatant.id === combatantId);
            if (currentTurn === turn) return;

            const direction = turn < currentTurn ? -1 : 1;
            Hooks.callAll("combatTurn", combat, { turn }, { direction });
            combat.update({ turn }, { direction });
        } else {
            // @ts-expect-error
            this.tracker._onCombatantMouseDown(event);
        }
    }

    #onHoverToken(token: TokenPF2e, hovered: boolean) {
        const combatant = token.combatant;
        const id = combatant?.id;
        const combatantElements = this.element?.querySelectorAll<HTMLLIElement>(".combatant") ?? [];

        for (const combatantElement of combatantElements) {
            const { combatantId } = elementDataset(combatantElement);
            combatantElement.classList.toggle("hovered", hovered && combatantId === id);
        }
    }

    #onRenderEffectsPanel(panel: EffectsPanel, $html: JQuery) {
        const html = $html[0];
        this.#updateEffectsPanel(html);
    }

    #clearSortable() {
        this.#sortable?.destroy();
        this.#sortable = null;
    }

    #activateListeners(html: HTMLElement, options: TrackerRenderOptions) {
        const tracker = this.tracker;

        this.#clearSortable();

        addListenerAll(html, ".combat-control", (event) => {
            event.preventDefault();
            // @ts-ignore
            const jEvent = jQuery.Event(event) as JQuery.ClickEvent;
            // @ts-expect-error
            tracker._onCombatControl(jEvent);
        });

        addListenerAll(html, ".combatant-control", (event) => {
            event.preventDefault();
            // @ts-ignore
            const jEvent = jQuery.Event(event) as JQuery.ClickEvent;
            // @ts-expect-error
            tracker._onCombatantControl(jEvent);
        });

        addListenerAll(
            html,
            ".combatant-control[data-control='rollInitiative']",
            "contextmenu",
            async (event, el) => {
                event.preventDefault();

                const combatantId = htmlClosest(el, "[data-combatant-id]")?.dataset.combatantId;
                const actor = this.combat?.combatants.get(combatantId ?? "")?.actor;
                if (!actor) return;

                const variants = await getStatisticVariants(actor, "initiative", {
                    statistic: actor.system.initiative?.statistic ?? "perception",
                });

                if (variants) {
                    rollInitiative(actor, variants.statistic, variants.event ?? event);
                }
            }
        );

        addListenerAll(html, ".combatant", "mouseenter", (event) => {
            event.preventDefault();
            // @ts-expect-error
            tracker._onCombatantHoverIn(event);
        });

        addListenerAll(html, ".combatant", "mouseleave", (event) => {
            event.preventDefault();
            // @ts-expect-error
            tracker._onCombatantHoverOut(event);
        });

        addListenerAll(html, "[data-action]", (event, el) => {
            const action = el.dataset.action as EventAction;

            switch (action) {
                case "toggle-expand": {
                    event.preventDefault();
                    this.setSetting("collapsed", !this.getSetting("collapsed"));
                    break;
                }

                case "delay-turn": {
                    event.preventDefault();
                    event.stopPropagation();
                    this.#onDelayAction(el);
                    break;
                }
            }
        });

        /**
         * GM only from here on
         */

        if (!game.user.isGM) return;

        addListener(html, "[data-control='trackerSettings']", (event) => {
            event.preventDefault();
            new CombatTrackerConfig().render(true);
        });

        addListenerAll(html, ".combatant-control-alt", (event, el) => {
            event.preventDefault();
            event.stopPropagation();

            const index = Number(el.dataset.index);
            const menu = this.contextMenus.at(index);
            const target = $(htmlClosest(el, "[data-combatant-id]")!);

            menu?.callback(target);
        });

        addListenerAll(html, ".combatant", this.#onCombatantClick.bind(this));

        if (this.combatantsElement && !options.collapsed) {
            this.#sortable = Sortable.create(this.combatantsElement, {
                animation: 200,
                dragClass: "drag",
                ghostClass: "ghost",
                direction: "vertical",
                draggable: ".combatant",
                dataIdAttr: "data-combatant-id",
                easing: "cubic-bezier(1, 0, 0, 1)",
                revertOnSpill: true,
                onEnd: (event) => this.#onSortableEnd(event),
                onUpdate: (event) => this.#onSortableUpdate(event),
            });
        }
    }
}

type EventAction = "toggle-expand" | "delay-turn";

type TrackerTexture = {
    scaleX: number;
    scaleY: number;
    img: string;
    mask?: string;
};

type TrackerHealth = {
    value: number | "???";
    hue: number;
    tooltip: string;
    sp: { value: number | "???"; hue: number } | undefined;
};

type TrackerTurn = {
    id: string;
    index: number;
    name: string;
    canPing: boolean;
    isOwner: boolean;
    hidden: boolean;
    defeated: boolean;
    initiative: number | undefined;
    isDelayed: boolean;
    hasRolled: boolean;
    health: TrackerHealth | undefined;
    canObserve: boolean;
    css: string;
    texture: TrackerTexture;
    toggleName: Maybe<{
        tooltip: string;
        active: boolean;
    }>;
    color: string;
};

type TrackerContext = {
    isGM: boolean;
    turns: TrackerTurn[];
    round: number;
    isOwner: boolean;
    hasActive: boolean;
    hasStarted: boolean;
    canRoll: boolean;
    canRollNPCs: boolean;
    metrics: Maybe<{
        tooltip: string;
        threat: string;
    }>;
    deathImg: string | undefined;
    expand: {
        tooltip: string;
        collapsed: boolean;
        icon: string;
    };
    linked: { icon: string; tooltip: string };
    i18n: ReturnType<typeof templateLocalize>;
    contextMenus: EntryContextOption[];
};

type TrackerRenderOptions = BaseRenderOptions & {
    collapsed: boolean;
    textureScaling: boolean;
};

type TrackerSettings = BaseSettings & {
    started: boolean;
    textureScaling: boolean;
    collapsed: boolean;
};

export { PF2eHudTracker };
