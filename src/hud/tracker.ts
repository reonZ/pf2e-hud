import {
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    createHook,
    EncounterPF2e,
    EncounterTrackerPF2e,
    render,
    settingPath,
    toggleHooksAndWrappers,
} from "module-helpers";
import { BasePF2eHUD, HUDSettingsList } from ".";

class TrackerPF2eHUD extends BasePF2eHUD<TrackerSettings> {
    #combatHook = createHook("renderCombatTracker", this.#onRenderCombatTracker.bind(this));
    #activeHooks = [];

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

    async _prepareContext(options: ApplicationRenderOptions): Promise<TrackerContext> {
        return {};
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
    }

    protected _insertElement(element: HTMLElement): HTMLElement {
        document.getElementById("interface")?.classList.add(this.id);
        document.getElementById("ui-right-column-1")?.appendChild(element);

        return element;
    }

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        toggleHooksAndWrappers(this.#activeHooks, true);
    }

    protected _onClose(options: ApplicationClosingOptions): void {
        toggleHooksAndWrappers(this.#activeHooks, false);
        document.getElementById("interface")?.classList.remove(this.id);
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

type TrackerContext = {};

type TrackerSettings = {
    enabled: boolean;
    started: boolean;
};

export { TrackerPF2eHUD };
