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
    RegisterSettingOptions,
    settingPath,
} from "module-helpers";

const _globalSettings: Partial<GlobalSetting> = {};

function getGlobalSetting<K extends GlobalSettingKey>(setting: K): GlobalSetting[K] {
    return (_globalSettings[setting] ??= getSetting(setting)) as GlobalSetting[K];
}

function getHealthStatusData(): HealthStatus {
    return getGlobalSetting("healthStatusData");
}

function registerGlobalSetting(key: GlobalSettingKey, options: RegisterSettingOptions) {
    const _onChange = options.onChange;

    options.name = settingPath("global", key, "name");
    options.hint = settingPath("global", key, "hint");

    if ("choices" in options && Array.isArray(options.choices)) {
        options.choices = R.mapToObj(options.choices, (choice) => [
            choice,
            settingPath("global", key, "choices", choice),
        ]);
    }

    options.onChange = (value, operation, userId) => {
        _globalSettings[key] = value;
        _onChange?.(value, operation, userId);
    };

    registerSetting(key, options);
}

function registerSettings(huds: Record<string, BasePF2eHUD<Record<string, any>>>) {
    registerSettingMenu("healthStatusMenu", {
        type: HealthStatusMenu,
        icon: "fa-solid fa-kit-medical",
        restricted: true,
    });

    registerGlobalSetting("healthStatusData", {
        type: HealthStatus,
        default: {},
        scope: "world",
        config: false,
        onChange: (value: HealthStatus) => {
            hud.tracker.render();
            hud.tooltip.configurate();
        },
    });

    registerGlobalSetting("useModifiers", {
        type: Boolean,
        default: false,
        scope: "user",
        onChange: () => {
            hud.token.render();
            hud.persistent.render();
        },
    });

    registerGlobalSetting("highestSpeed", {
        type: Boolean,
        default: false,
        scope: "user",
        onChange: () => {
            hud.token.render();
            hud.persistent.render();
        },
    });

    registerModuleSettings(
        R.pipe(
            R.values(huds),
            R.map((hud) => [hud.key, hud._getHudSettings()] as const),
            R.mapToObj(([key, entries]) => [key, entries])
        )
    );
}

type GlobalSetting = {
    healthStatusData: HealthStatus;
    useModifiers: boolean;
    highestSpeed: boolean;
};

type GlobalSettingKey = keyof GlobalSetting;

MODULE.debugExpose({ getHealthStatusData });

export { getGlobalSetting, getHealthStatusData, registerSettings };
