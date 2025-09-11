import { HealthStatus, HealthStatusMenu } from "health-status";
import { BasePF2eHUD, SidebarPF2eHUD } from "hud";
import { hud } from "main";
import {
    getSetting,
    MODULE,
    R,
    registerModuleSettings,
    registerSetting,
    registerSettingMenu,
    RegisterSettingOptions,
    setSetting,
    settingPath,
} from "module-helpers";

const _globalSettings: Partial<GlobalSetting> = {};

function getGlobalSetting<K extends GlobalSettingKey>(setting: K): GlobalSetting[K] {
    return (_globalSettings[setting] ??= getSetting(setting)) as GlobalSetting[K];
}

function setGlobalSetting<K extends GlobalSettingKey>(
    setting: K,
    value: GlobalSetting[K]
): Promise<GlobalSetting[K]> {
    return setSetting(setting, value);
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

function registerSettings(huds: Record<string, BasePF2eHUD>) {
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

    registerGlobalSetting("hideUntrained", {
        type: Boolean,
        default: false,
        scope: "user",
        config: false,
        onChange: (value) => {
            if (SidebarPF2eHUD.current === "skills") {
                SidebarPF2eHUD.refresh();
                SidebarPF2eHUD.refresh();
            }
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

    const moduleSettings = R.pipe(
        R.values(huds),
        R.map((hud) => [hud.key, hud._getHudSettings()] as const),
        R.mapToObj(([key, entries]) => [key, entries])
    );

    registerModuleSettings(moduleSettings);

    MODULE.debugExpose({ getHealthStatusData });
}

type GlobalSetting = {
    healthStatusData: HealthStatus;
    hideUntrained: boolean;
    highestSpeed: boolean;
    useModifiers: boolean;
};

type GlobalSettingKey = keyof GlobalSetting;

export { getGlobalSetting, getHealthStatusData, registerSettings, setGlobalSetting };
