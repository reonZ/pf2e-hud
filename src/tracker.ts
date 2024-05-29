import {
    R,
    addListener,
    addListenerAll,
    createHook,
    elementData,
    getDispositionColor,
    htmlElement,
    localize,
    querySelectorArray,
    render,
    templateLocalize,
} from "pf2e-api";
import Sortable, { type SortableEvent } from "sortablejs";
import { BaseContext, PF2eHudBaseMain, RenderOptionsHUD } from "./hud";
import { HealthData, canObserve, getHealth } from "./shared";

class PF2eHudTracker extends PF2eHudBaseMain<TrackerSettings> {
    #hoverTokenHook = createHook("hoverToken", this.#onHoverToken.bind(this));
    #targetTokenHook = createHook("targetToken", this.#refreshTargetDisplay.bind(this));
    #renderEffectsHook = createHook("renderEffectsPanel", this.#onRenderEffectsPanel.bind(this));
    #combatTrackerHook = createHook("renderCombatTracker", this.#onRenderCombatTracker.bind(this));

    #toggled = false;
    #cancelScroll = false;
    #combatantElement: HTMLElement | null = null;
    #combatantsElement: HTMLElement | null = null;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-tracker",
        classes: ["app"],
        window: {
            positioned: false,
        },
    };

    get templates(): ["tracker", "metrics-tooltip"] {
        return ["tracker", "metrics-tooltip"];
    }

    get hudKey(): string {
        return "tracker";
    }

    get enabled(): boolean {
        return this.setting("enabled");
    }

    get fontSize() {
        return this.setting("fontSize");
    }

    get tracker() {
        return ui.combat as EncounterTrackerPF2e;
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
                editable: [{ key: "ControlLeft" }],
                onUp: () => this.#toggleMenu(false),
                onDown: () => this.#toggleMenu(true),
            },
        ];
    }

    get settings(): SettingOptions[] {
        return [
            {
                key: "started",
                type: Boolean,
                default: false,
                onChange: () => {
                    this.#onRenderCombatTracker(this.tracker);
                },
            },
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
                key: "fontSize",
                type: Number,
                range: {
                    min: 10,
                    max: 30,
                    step: 1,
                },
                default: 14,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "textureScaling",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "expanded",
                type: String,
                default: "true",
                scope: "client",
                config: false,
                onChange: () => {
                    this.render();
                },
            },
        ];
    }

    _onEnable(enabled: boolean = this.enabled): void {
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

        options.expanded = this.setting("expanded");
        options.collapsed = options.expanded === "false";
        options.textureScaling = this.setting("textureScaling");
    }

    async _prepareContext(options: TrackerRenderOptions): Promise<TrackerContext | BaseContext> {
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
            const dispositionColor = isCurrent ? getDispositionColor(actor) : new Color("black");

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
                health: actor && canObserve(actor) ? getHealth(actor) : undefined,
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

    async _renderHTML(
        context: TrackerContext | BaseContext,
        options: TrackerRenderOptions
    ): Promise<string> {
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
        this.#activateListeners(content);
    }

    _insertElement(element: HTMLElement) {
        element.dataset.tooltipDirection = "UP";
        document.getElementById("ui-top")?.after(element);
    }

    _onRender(context: TrackerContext | BaseContext, options: TrackerRenderOptions) {
        this.#scrollToCurrent(options.collapsed);
        this.#updateEffectsPanel();
    }

    close(options?: ApplicationClosingOptions) {
        this.#cancelScroll = false;
        this.#combatantElement = null;
        this.#combatantsElement = null;

        const effectsPanel = document.getElementById("effects-panel");
        if (effectsPanel) effectsPanel.style.removeProperty("max-height");

        return super.close(options);
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

    #scrollToCurrent(collapsed = this.setting("expanded") === "false") {
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

    #activateListeners(html: HTMLElement) {
        const tracker = this.tracker;

        addListener(html, "[data-action='toggle-expand']", (event) => {
            event.preventDefault();
            const newValue = this.setting("expanded") === "false" ? "true" : "false";
            this.setSetting("expanded", newValue);
        });

        addListenerAll(html, ".combat-control", (event) => {
            event.preventDefault();
            tracker._onCombatControl(event);
        });

        addListenerAll(html, ".combatant-control", (event) => {
            event.preventDefault();
            // @ts-ignore
            const jEvent = jQuery.Event(event);
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

        if (this.combatantsElement) {
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

        const parent = el.closest<HTMLElement>(".combatant")!;
        const { control } = elementData<CombatantControlDataset>(el);
        const { combatantId } = elementData(parent);

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
        const dropped = encounter.combatants.get(droppedId, { strict: true }) as CombatantPF2e;
        if (typeof dropped.initiative !== "number") {
            ui.notifications.error(
                game.i18n.format("PF2E.Encounter.HasNoInitiativeScore", { actor: dropped.name })
            );
            return;
        }

        const newOrder = R.pipe(
            querySelectorArray(event.target, ".combatant"),
            R.map((row) => row.getAttribute("data-combatant-id") ?? ""),
            R.map((id) => encounter.combatants.get(id, { strict: true }) as CombatantPF2e),
            R.filter((combatant) => typeof combatant.initiative === "number")
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
        const rows = querySelectorArray(combatantsList, ".combatant");
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
            const { combatantId } = elementData<CombatantDataset>(el);
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
        const combatantElements = this.element?.querySelectorAll(".combatant") ?? [];

        for (const combatantElement of combatantElements) {
            const { combatantId } = elementData<CombatantDataset>(combatantElement);
            combatantElement.classList.toggle("hovered", hovered && combatantId === id);
        }
    }

    #onRenderEffectsPanel(panel: EffectsPanel, $html: JQuery) {
        const html = htmlElement($html);
        this.#updateEffectsPanel(html);
    }

    #onRenderCombatTracker(tracker: EncounterTrackerPF2e) {
        const combat = tracker.viewed;
        if (
            combat &&
            (game.user.isGM || !this.setting("started") || combat.started) &&
            combat.turns.some((combatant) => combatant.isOwner)
        ) {
            this.render(true);
        } else {
            this.close();
        }
    }
}

type TrackerRenderOptions = RenderOptionsHUD & {
    collapsed: boolean;
    expanded: ExpandedSetting;
    fontSize: number;
    textureScaling: boolean;
};

type CombatantDataset = { combatantId: string };
type CombatantControlDataset = {
    control: "editCombatant" | "resetCombatant" | "rerollCombatant" | "removeCombatant";
};

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

type TrackerContext = BaseContext & {
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

type ExpandedSetting = `true` | "false" | `${number}`;

type TrackerSettings = {
    started: boolean;
    enabled: boolean;
    fontSize: number;
    textureScaling: boolean;
    expanded: ExpandedSetting;
};

export { PF2eHudTracker };
