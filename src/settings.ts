import {
    getSetting,
    R,
    registerModuleSettings,
    registerSetting,
    registerSettingMenu,
    RegisterSettingOptions,
    setSetting,
    settingPath,
} from "foundry-helpers";
import { HealthStatus, HealthStatusMenu, HealthStatusSource, zHealthStatus } from "health-status";
import { BasePF2eHUD, SidebarPF2eHUD } from "hud";
import { hud } from "main";

const _globalSettings: Partial<GlobalSetting> = {};

function getGlobalSetting<K extends GlobalSettingKey>(setting: K): GlobalSetting[K] {
    return (_globalSettings[setting] ??= getSetting(setting)) as GlobalSetting[K];
}

function setGlobalSetting<K extends GlobalSettingKey>(setting: K, value: GlobalSetting[K]): Promise<GlobalSetting[K]> {
    return setSetting(setting, value);
}

function getHealthStatusData(): HealthStatus {
    const source = getGlobalSetting("healthStatusData");
    return zHealthStatus.parse(source);
}

function registerGlobalSetting(key: GlobalSettingKey, options: RegisterSettingOptions) {
    const _onChange = options.onChange;

    options.name = settingPath("global", key, "name");
    options.hint = settingPath("global", key, "hint");

    if ("choices" in options && Array.isArray(options.choices)) {
        options.choices = R.fromKeys(options.choices, (choice) => {
            return settingPath("global", key, "choices", choice);
        });
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
        type: Object,
        default: {},
        scope: "world",
        config: false,
        onChange: () => {
            hud.tracker.render();
            hud.tooltip.configurate();
        },
    });

    registerGlobalSetting("hideUntrained", {
        type: Boolean,
        default: false,
        scope: "user",
        config: false,
        onChange: () => {
            if (SidebarPF2eHUD.current === "skills") {
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

    registerGlobalSetting("alwaysFilter", {
        type: Boolean,
        default: false,
        scope: "user",
        onChange: () => {
            SidebarPF2eHUD.refresh();
        },
    });

    const moduleSettings = R.pipe(
        R.values(huds),
        R.map((hud) => [hud.key, hud._getHudSettings()] as const),
        R.fromEntries(),
    );

    registerModuleSettings(moduleSettings);
}

type GlobalSetting = {
    alwaysFilter: boolean;
    healthStatusData: HealthStatusSource;
    hideUntrained: boolean;
    highestSpeed: boolean;
    useModifiers: boolean;
};

type GlobalSettingKey = keyof GlobalSetting;

export { getGlobalSetting, getHealthStatusData, registerSettings, setGlobalSetting };
