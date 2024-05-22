import { BaseHUD } from "./hud";

class PF2eHudTracker extends BaseHUD<TrackerSettings> {
    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-tracker",
        window: {
            positioned: false,
        },
    };

    get partials() {
        return [];
    }

    get templates(): ["tracker"] {
        return ["tracker"];
    }

    get key(): string {
        return "tracker";
    }

    get enabled(): boolean {
        return this.setting("enabled");
    }

    get settings(): SettingOptions[] {
        return [
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "client",
            },
        ];
    }

    _onEnable(enabled?: boolean): void {}
}

type TrackerSettings = {
    enabled: boolean;
};

export { PF2eHudTracker };
