import { HealthStatus, HealthStatusMenu } from "health-status";
import { BasePF2eHUD } from "hud";
import { hud } from "main";
import {
    getSetting,
    MODULE,
    R,
    registerModuleSettings,
    registerSetting,
    registerSettingMenu,
} from "module-helpers";

const _globalSettings: {
    healthStatusData?: HealthStatus;
    healthStatusEnabled?: boolean;
} = {
    healthStatusData: undefined,
    healthStatusEnabled: undefined,
};

function getHealthStatusData(): HealthStatus {
    return (_globalSettings.healthStatusData ??= getSetting<HealthStatus>("healthStatusData"));
}

function registerSettings(huds: Record<string, BasePF2eHUD<Record<string, any>>>) {
    registerSetting("healthStatusData", {
        type: HealthStatus,
        default: {},
        scope: "world",
        config: false,
        onChange: (value: HealthStatus) => {
            _globalSettings.healthStatusData = value;

            hud.tracker.render();
            hud.tooltip.configurate();
        },
    });

    registerSettingMenu("healthStatusMenu", {
        type: HealthStatusMenu,
        icon: "fa-solid fa-kit-medical",
        restricted: true,
    });

    registerModuleSettings(
        R.pipe(
            R.values(huds),
            R.map((hud) => [hud.key, hud._getHudSettings()] as const),
            R.mapToObj(([key, entries]) => [key, entries])
        )
    );
}

MODULE.debugExpose({ getHealthStatusData });

export { getHealthStatusData, registerSettings };
