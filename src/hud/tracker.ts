import {
    R,
    addListener,
    addListenerAll,
    canObserveActor,
    createHook,
    elementDataset,
    getDispositionColor,
    hasRolledInitiative,
    htmlQueryAll,
    localize,
    render,
    templateLocalize,
} from "foundry-pf2e";
import { BaseRenderOptions, BaseSettings, PF2eHudBase } from "./base/base";
import { HealthData, getHealth } from "./shared/base";
import Sortable, { SortableEvent } from "sortablejs";

class PF2eHudTracker extends PF2eHudBase<TrackerSettings> {
    #hoverTokenHook = createHook("hoverToken", this.#onHoverToken.bind(this));
    #targetTokenHook = createHook("targetToken", this.#refreshTargetDisplay.bind(this));
    #renderEffectsHook = createHook("renderEffectsPanel", this.#onRenderEffectsPanel.bind(this));
    #combatTrackerHook = createHook("renderCombatTracker", this.#onRenderCombatTracker.bind(this));

    #toggled = false;
    #cancelScroll = false;
    #combatantElement: HTMLElement | null = null;
    #combatantsElement: HTMLElement | null = null;

    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        id: "pf2e-hud-tracker",
        classes: ["app"],
        window: {
            positioned: false,
        },
    };

    get SETTINGS_ORDER(): (keyof TrackerSettings)[] {
        return ["started", "enabled", "fontSize", "textureScaling"];
    }

    get SETTINGS() {
        return super.SETTINGS.concat([
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

    get templates() {
        return ["tracker", "metrics-tooltip"];
    }

    get key(): "tracker" {
        return "tracker";
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

    get keybinds(): KeybindingActionConfig[] {
        return [
            {
                name: "toggle",
                restricted: true,
                editable: [{ key: "ControlLeft", modifiers: [] }],
                onUp: () => this.#toggleMenu(false),
                onDown: () => this.#toggleMenu(true),
            },
        ];
    }

    _onClose(options: ApplicationClosingOptions) {
        this.#cancelScroll = false;
        this.#combatantElement = null;
        this.#combatantsElement = null;

        const effectsPanel = document.getElementById("effects-panel");
        if (effectsPanel) effectsPanel.style.removeProperty("max-height");

        super._onClose(options);
    }

    _onEnable(enabled = this.enabled) {
        this.#hoverTokenHook.toggle(enabled);
        this.#targetTokenHook.toggle(enabled);
        this.#combatTrackerHook.toggle(enabled);
        this.#renderEffectsHook.toggle(enabled);

        if (enabled && this.combat) this.render(true);
        else if (!enabled) this.close();

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

            const texture = (useTextureScaling ? combatant.token?.texture : undefined) ?? {
                scaleX: 1,
                scaleY: 1,
                src: await this.tracker._getCombatantThumbnail(combatant),
            };

            const toggleName = (() => {
                if (!isGM || !tokenSetsNameVisibility || actor?.alliance === "party") return;
                return {
                    active: playersCanSeeName,
                    tooltip: game.i18n.localize(
                        playersCanSeeName ? "PF2E.Encounter.HideName" : "PF2E.Encounter.RevealName"
                    ),
                };
            })();

            const css: string[] = [];
            const canRollThis = isOwner && !hasRolled;

            if (hidden) css.push("hidden");
            if (isCurrent) css.push("active");
            if (defeated) css.push("defeated");
            if (!combatant.visible) css.push("not-visible");
            if (!isGM && canRollThis) css.push("can-roll");

            const turn: TrackerTurn = {
                index: i,
                id: combatant.id,
                name: isGM || playersCanSeeName ? combatant.name : unknown,
                initiative: String(initiative),
                hasRolled,
                texture,
                toggleName,
                hidden,
                defeated,
                canPing: canPing && combatant.sceneId === canvas.scene?.id,
                css: css.join(" "),
                isOwner,
                health: actor && canObserveActor(actor) ? getHealth(actor) : undefined,
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

        const data: TrackerContext = {
            ...parentData,
            isGM,
            round: combat.round,
            turns,
            metrics,
            hasActive,
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
            i18n: templateLocalize("tracker"),
        };

        return data;
    }

    async _renderHTML(context: TrackerContext, options: TrackerRenderOptions): Promise<string> {
        return await this.renderTemplate("tracker", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: TrackerRenderOptions): void {
        content.innerHTML = result;

        content.style.setProperty(`--font-size`, `${options.fontSize}px`);
        content.classList.toggle("collapsed", options.collapsed);
        content.classList.toggle("textureScaling", options.textureScaling);
        content.classList.toggle("tall", content.offsetHeight > window.innerHeight / 2);

        this.#combatantsElement = content.querySelector(".combatants")!;
        this.#combatantElement = this.#combatantsElement.querySelector(".combatant.active");

        this.#refreshTargetDisplay();
        this.#activateListeners(content, options);
    }

    _insertElement(element: HTMLElement) {
        element.dataset.tooltipDirection = "UP";
        document.getElementById("ui-top")?.after(element);
    }

    _onRender(context: TrackerContext, options: TrackerRenderOptions) {
        this.#scrollToCurrent(options.collapsed);
        this.#updateEffectsPanel();
    }

    _onClickAction(event: PointerEvent, target: HTMLElement) {
        const action = target.dataset.action;

        if (action === "toggle-expand") {
            event.preventDefault();
            this.setSetting("collapsed", !this.getSetting("collapsed"));
        }
    }

    #onRenderCombatTracker(tracker: EncounterTrackerPF2e) {
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

    #toggleMenu(enabled: boolean) {
        this.#toggled = enabled;
        this.element?.classList.toggle("toggle-menu", enabled);
    }

    #updateEffectsPanel(effectsPanel = document.getElementById("effects-panel")) {
        const trackerElement = this.element;
        if (!effectsPanel || !trackerElement) return;

        const offsetHeight = trackerElement.offsetHeight;
        effectsPanel.style.setProperty("max-height", `calc(100% - ${offsetHeight}px - 2em)`);
    }

    #scrollToCurrent(collapsed = this.getSetting("collapsed")) {
        if (collapsed || this.#cancelScroll) {
            this.#cancelScroll = false;
            return;
        }

        const combatantsList = this.combatantsElement;
        const activeCombatant = this.combatantElement;
        if (!combatantsList || !activeCombatant) return;

        const clientHeight = combatantsList.clientHeight;
        const scrollHeight = combatantsList.scrollHeight;
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

    #onCombatantControlAlt(event: MouseEvent, el: HTMLElement) {
        event.preventDefault();
        event.stopPropagation();

        const tracker = this.tracker;
        const combat = tracker.viewed;
        if (!combat) return;

        const parent = el.closest<HTMLLIElement>(".combatant")!;
        const { control } = elementDataset(el);
        const { combatantId } = elementDataset(parent);

        switch (control) {
            case "editCombatant": {
                tracker._onConfigureCombatant($(parent));
                break;
            }
            case "resetCombatant": {
                combat.combatants.get(combatantId)?.update({ initiative: null });
                break;
            }
            case "rerollCombatant": {
                combat.rollInitiative([combatantId]);
                break;
            }
            case "removeCombatant": {
                combat.combatants.get(combatantId)?.delete();
                break;
            }
        }
    }

    #onSortableUpdate(event: SortableEvent) {
        const tracker = this.tracker;
        tracker.validateDrop(event);

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
            R.filter((combatant): combatant is RolledCombatant => hasRolledInitiative(combatant))
        );
        const oldOrder = encounter.turns.filter((Combatant) => Combatant.initiative !== null);
        const allOrdersChecks = newOrder.every(
            (combatant) => newOrder.indexOf(combatant) === oldOrder.indexOf(combatant)
        );
        if (allOrdersChecks) return;

        this.#cancelScroll = true;

        tracker.setInitiativeFromDrop(newOrder, dropped);
        return tracker.saveNewOrder(newOrder);
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
            const currenTurn = combat.turn!;
            const { combatantId } = elementDataset(el);
            const turn = combat.turns.findIndex((combatant) => combatant.id === combatantId);
            if (currenTurn === turn) return;

            const direction = turn < currenTurn ? -1 : 1;
            Hooks.callAll("combatTurn", combat, { turn }, { direction });
            combat.update({ turn }, { direction });
        } else {
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

    #activateListeners(html: HTMLElement, options: TrackerRenderOptions) {
        const tracker = this.tracker;

        addListenerAll(html, ".combat-control", (event) => {
            event.preventDefault();
            // @ts-ignore
            const jEvent = jQuery.Event(event) as JQuery.ClickEvent;
            tracker._onCombatControl(jEvent);
        });

        addListenerAll(html, ".combatant-control", (event) => {
            event.preventDefault();
            // @ts-ignore
            const jEvent = jQuery.Event(event) as JQuery.ClickEvent;
            tracker._onCombatantControl(jEvent);
        });

        addListenerAll(html, ".combatant", "mouseenter", (event) => {
            event.preventDefault();
            tracker._onCombatantHoverIn(event);
        });

        addListenerAll(html, ".combatant", "mouseleave", (event) => {
            event.preventDefault();
            tracker._onCombatantHoverOut(event);
        });

        /**
         * GM only from here on
         */

        if (!game.user.isGM) return;

        addListener(html, "[data-control='trackerSettings']", (event) => {
            event.preventDefault();
            new CombatTrackerConfig().render(true);
        });

        addListenerAll(html, ".combatant-control-alt", this.#onCombatantControlAlt.bind(this));

        addListenerAll(html, ".combatant", this.#onCombatantClick.bind(this));

        if (this.combatantsElement && !options.collapsed) {
            Sortable.create(this.combatantsElement, {
                animation: 200,
                dragClass: "drag",
                ghostClass: "ghost",
                direction: "vertical",
                draggable: ".combatant",
                dataIdAttr: "data-combatant-id",
                easing: "cubic-bezier(1, 0, 0, 1)",
                onEnd: (event) => this.#onSortableEnd(event),
                onUpdate: (event) => this.#onSortableUpdate(event),
            });
        }
    }
}

type TrackerTurn = {
    id: string;
    index: number;
    name: string;
    canPing: boolean;
    isOwner: boolean;
    hidden: boolean;
    defeated: boolean;
    initiative: string;
    hasRolled: boolean;
    health: HealthData | undefined;
    css: string;
    texture: { scaleX: number; scaleY: number; src: string };
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
    metrics?: {
        tooltip: string;
        threat: string;
    };
    expand: {
        tooltip: string;
        collapsed: boolean;
        icon: string;
    };
    linked: { icon: string; tooltip: string };
    i18n: ReturnType<typeof templateLocalize>;
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
