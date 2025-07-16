import {
    ActorPF2e,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    canObserveActor,
    createHook,
    EncounterPF2e,
    EncounterTrackerPF2e,
    getDispositionColor,
    getFlag,
    htmlQuery,
    localize,
    R,
    render,
    settingPath,
    toggleHooksAndWrappers,
} from "module-helpers";
import { getHealthStatusData } from "settings";
import { BasePF2eHUD, calculateActorHealth, HUDSettingsList } from ".";

class TrackerPF2eHUD extends BasePF2eHUD<TrackerSettings> {
    #combatantsElement: Maybe<HTMLElement>;
    #combatantElement: Maybe<HTMLElement>;
    #contextMenus: EntryContextOption[] = [];
    #trackerHeight = {
        offsetHeight: 0,
        clientHeight: 0,
        scrollHeight: 0,
    };

    #activeHooks = [];
    #combatHook = createHook("renderCombatTracker", this.#onRenderCombatTracker.bind(this));

    #combatTrackerHeightObserver = new ResizeObserver((entries) => {
        const trackerEvent = entries.find((entry) => entry.target === this.element);
        if (!trackerEvent) return;

        this.#trackerHeight = {
            offsetHeight: trackerEvent.contentRect.height,
            clientHeight: this.combatantsElement?.clientHeight ?? 0,
            scrollHeight: this.combatantsElement?.scrollHeight ?? 0,
        };

        this.interfaceElement?.classList.toggle(
            "pf2e-hud-tracker-tall",
            this.#trackerHeight.offsetHeight > window.innerHeight / 2
        );

        // this.#updateEffectsPanel();
        // this.#scrollToCurrent();
    });

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-tracker",
        window: {
            positioned: false,
        },
    };

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

    get tracker(): EncounterTrackerPF2e<EncounterPF2e | null> | null {
        return ui.combat;
    }

    get combat(): Maybe<EncounterPF2e> {
        return this.tracker?.viewed;
    }

    get combatantsElement(): Maybe<HTMLElement> {
        return this.#combatantsElement;
    }

    get interfaceElement(): Maybe<HTMLElement> {
        return document.getElementById("interface");
    }

    get parentElement(): Maybe<HTMLElement> {
        return document.getElementById("ui-right-column-1");
    }

    get contextMenus() {
        if (this.#contextMenus.length) {
            return this.#contextMenus;
        }

        const menuItems = ui.combat._doEvent(ui.combat["_getEntryContextOptions"], {
            hookName: "get{}ContextOptions",
        });

        return (this.#contextMenus = menuItems);
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

    init(isGM: boolean): void {
        this._configurate();
    }

    _configureRenderOptions(options: TrackerRenderOptions) {
        super._configureRenderOptions(options);

        options.collapsed = this.settings.collapsed;
        options.partyAsObserved = this.settings.partyAsObserved;
        options.textureScaling = this.settings.textureScaling;
    }

    async _prepareContext(options: TrackerRenderOptions): Promise<TrackerContext> {
        const isGM = game.user.isGM;
        const combat = this.combat!;
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

        const userCanObserveActor = (actor: ActorPF2e) => {
            return (
                canObserveActor(actor, true) ||
                (partyAsObserved && actor?.system.details.alliance === "party")
            );
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
            const canObserve = !!actor && userCanObserveActor(actor);
            const canRollThis = isOwner && !hasRolled;

            const texture: TrackerTexture = {
                ...((textureScaling && combatant.token?.texture) || { scaleX: 1, scaleY: 1 }),
                img: await tracker._getCombatantThumbnail(combatant),
            };

            if (texture.scaleX >= 1.2 || texture.scaleY >= 1.2) {
                const scale = texture.scaleX > texture.scaleY ? texture.scaleX : texture.scaleY;
                const ringPercent = 100 - Math.floor(((scale - 0.7) / scale) * 100);
                const limitPercent = 100 - Math.floor(((scale - 0.8) / scale) * 100);

                texture.mask = `radial-gradient(circle at center, black ${ringPercent}%, rgba(0, 0, 0, 0.2) ${limitPercent}%)`;
            }

            const toggleName: TrackerTurn["toggleName"] | false = isGM &&
                tokenSetsNameVisibility &&
                actor?.alliance !== "party" && {
                    active: playersCanSeeName,
                    tooltip: playersCanSeeName ? defaultLabels.hideName : defaultLabels.revealName,
                };

            const cssList = [
                hidden && "hidden",
                isCurrent && "active",
                defeated && "defeated",
                !combatant.visible && "not-visible",
                !isGM && canRollThis && "can-roll",
            ];

            const color: string = R.pipe(
                getDispositionColor(actor).rgb,
                R.map((x) => x * 255),
                R.join(" ")
            );

            const health: TrackerHealth | undefined = (() => {
                if (!actor || (!canObserve && !healthStatus)) return;

                const health = calculateActorHealth(actor);
                if (!health) return;

                return {
                    hue: health.totalTemp.hue,
                    value: canObserve ? health.totalTemp.value : "???",
                    sp: health.sp
                        ? { hue: health.sp.hue, value: canObserve ? health.sp.value : "???" }
                        : undefined,
                    tooltip: canObserve
                        ? game.i18n.localize("PF2E.HitPointsHeader")
                        : healthStatus.getEntryFromHealthData(health),
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

        const deathImg = game.settings.get("pf2e", "deathIcon");

        const expand = {
            tooltip: options.collapsed ? "collapsed" : "expanded",
            collapsed: options.collapsed,
            icon: options.collapsed ? "fa-solid fa-compress" : "fa-solid fa-expand",
        };

        const linked = {
            icon: combatScene !== null ? "fa-solid fa-link" : "fa-solid fa-link-slash",
            tooltip: combatScene !== null ? "COMBAT.Linked" : "COMBAT.Unlinked",
        };

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
            round: combat.round,
            turns,
        };
    }

    protected _renderHTML(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<string> {
        return render("tracker", context);
    }

    protected _replaceHTML(
        result: string,
        content: HTMLElement,
        options: ApplicationRenderOptions
    ): void {
        content.innerHTML = result;

        this.#combatantsElement = htmlQuery(content, ".combatants");
        this.#combatantElement = htmlQuery(content, ".combatant.active");
    }

    protected _insertElement(element: HTMLElement): HTMLElement {
        this.interfaceElement?.classList.add(this.id);
        this.parentElement?.appendChild(element);

        this.#combatTrackerHeightObserver.observe(element);

        return element;
    }

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        toggleHooksAndWrappers(this.#activeHooks, true);
    }

    protected _onClose(options: ApplicationClosingOptions): void {
        toggleHooksAndWrappers(this.#activeHooks, false);
        this.#combatTrackerHeightObserver.disconnect();
        this.interfaceElement?.classList.remove(this.id);
    }

    shouldDisplay(combat: Maybe<EncounterPF2e> = this.combat): boolean {
        return (
            !!combat &&
            (game.user.isGM || combat.started || !this.settings.started) &&
            combat.turns.some((combatant) => combatant.isOwner)
        );
    }

    #onRenderCombatTracker(
        tracker: EncounterTrackerPF2e<EncounterPF2e | null> | null = this.tracker
    ) {
        if (tracker && this.shouldDisplay(tracker.viewed)) {
            this.render(true);
        } else {
            this.close();
        }
    }
}

let _cachedLabels: { hideName: string; revealName: string; unknown: string } | undefined;
function getDefaultLabels() {
    return (_cachedLabels ??= {
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
    sp: { value: number | "???"; hue: number } | undefined;
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

type TrackerContext = {
    canRoll: boolean;
    canRollNPCs: boolean;
    contextMenus: EntryContextOption[];
    deathImg: string | undefined;
    expand: { tooltip: string; collapsed: boolean; icon: string };
    hasActive: boolean;
    hasStarted: boolean;
    isGM: boolean;
    isOwner: boolean;
    linked: { icon: string; tooltip: string };
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

type TrackerRenderOptions = ApplicationRenderOptions & {
    collapsed: boolean;
    partyAsObserved: boolean;
    textureScaling: boolean;
};

export { TrackerPF2eHUD };
