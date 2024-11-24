import {
    createHTMLElement,
    htmlQuery,
    localize,
    MODULE,
    registerSetting,
    userIsGM,
} from "module-helpers";
import { PF2eHudPopup } from "./hud/popup/base";
import { hud as HUDS } from "./main";

function registerModuleSettings() {
    const isGM = userIsGM();
    const settings: SettingOptions[] = [];

    registerSetting({
        key: "healthStatus",
        type: String,
        default: localize(`settings.healthStatus.default`),
        scope: "world",
        onChange: () => {
            HUDS.tracker.render();
            HUDS.tooltip.render();
        },
    });

    registerSetting({
        key: "partyAsObserved",
        type: Boolean,
        default: false,
        scope: "world",
        onChange: () => {
            HUDS.tracker.render();
        },
    });

    registerSetting({
        key: "useModifiers",
        type: Boolean,
        default: false,
        scope: "client",
        onChange: () => {
            HUDS.token.render();
            HUDS.persistent.render();
        },
    });

    registerSetting({
        key: "highestSpeed",
        type: Boolean,
        default: false,
        scope: "client",
        onChange: () => {
            HUDS.token.render();
            HUDS.persistent.render();
        },
    });

    // popup

    registerSetting({
        key: "popup.onCursor",
        type: Boolean,
        default: true,
        scope: "client",
    });

    registerSetting({
        key: "popup.fontSize",
        type: Number,
        range: {
            min: 10,
            max: 30,
            step: 1,
        },
        default: 14,
        scope: "client",
        onChange: () => {
            for (const popup of PF2eHudPopup.apps) {
                popup.render();
            }
        },
    });

    registerSetting({
        key: "popup.closeOnSendToChat",
        type: Boolean,
        default: false,
        scope: "client",
    });

    // sidebar

    registerSetting({
        key: "sidebar.fontSize",
        type: Number,
        range: {
            min: 10,
            max: 30,
            step: 1,
        },
        default: 14,
        scope: "client",
        onChange: () => {
            refreshSidebar();
        },
    });

    registerSetting({
        key: "sidebar.multiColumns",
        type: Number,
        default: 5,
        range: {
            min: 1,
            max: 5,
            step: 1,
        },
        scope: "client",
        onChange: () => {
            refreshSidebar();
        },
    });

    registerSetting({
        key: "sidebar.maxHeight",
        type: Number,
        range: {
            min: 50,
            max: 100,
            step: 1,
        },
        default: 100,
        scope: "client",
        onChange: () => {
            refreshSidebar();
        },
    });

    registerSetting({
        key: "sidebar.hideUntrained",
        type: Boolean,
        default: false,
        scope: "client",
        onChange: () => {
            refreshSidebar();
        },
    });

    for (const hud of Object.values(HUDS)) {
        const mainSettingsOrder: string[] = hud.SETTINGS_ORDER;
        const subSettingsOrder: string[] = hud.SUB_SETTINGS_ORDER;
        const mainSettings: SettingOptions[] = [];
        const subSettings: SettingOptions[] = [];
        const orphanSettings: SettingOptions[] = [];

        for (const setting of hud.getSettings()) {
            const key = `${hud.key}.${setting.key}`;
            const mainIndex = mainSettingsOrder.indexOf(setting.key);

            if (mainIndex !== -1) {
                mainSettings[mainIndex] = setting;
            } else {
                const subIndex = subSettingsOrder.indexOf(setting.key);
                if (subIndex !== -1) {
                    subSettings[subIndex] = setting;
                } else {
                    orphanSettings.push(setting);
                }
            }

            setting.key = key;
        }

        settings.push(...mainSettings, ...orphanSettings, ...subSettings);
    }

    for (const setting of settings) {
        if (setting.gmOnly && !isGM) continue;
        registerSetting(setting);
    }
}

function onRenderSettingsConfig(app: SettingsConfig, $html: JQuery) {
    const html = $html[0];
    const tab = htmlQuery(html, `.tab[data-tab="${MODULE.id}"]`);

    const huds = Object.values(HUDS);
    const settings = huds
        .map(({ key, SUB_SETTINGS_ORDER }): { key: string; subkey?: string } => ({
            key,
            subkey: SUB_SETTINGS_ORDER[0],
        }))
        .concat([{ key: "popup" }, { key: "sidebar" }]);

    for (const { key, subkey } of settings) {
        const group = htmlQuery(tab, `[data-setting-id^="${MODULE.id}.${key}."]`);
        const title = createHTMLElement("h3", {
            innerHTML: localize("settings", key, "title"),
        });

        group?.before(title);

        if (subkey) {
            const group = htmlQuery(tab, `[data-setting-id="${MODULE.id}.${key}.${subkey}"]`);
            const title = createHTMLElement("h3", {
                innerHTML: localize("settings", key, "subtitle"),
            });

            group?.before(title);
        }
    }

    for (const hud of huds) {
        const gmOnlyLabel = localize("gmOnly");
        const reloadLabel = localize("reload");

        for (const setting of hud.getSettings()) {
            const nameExtras: string[] = [];

            if (setting.gmOnly) nameExtras.push(gmOnlyLabel);
            if (setting.requiresReload) nameExtras.push(reloadLabel);

            if (!nameExtras.length) continue;

            const key = `${MODULE.id}.${hud.key}.${setting.key}`;
            const labelElement = htmlQuery(tab, `[data-setting-id="${key}"] > label`);
            const extraElement = createHTMLElement("span", {
                innerHTML: ` (${nameExtras.join(", ")})`,
            });

            labelElement?.append(extraElement);
        }
    }
}

function refreshSidebar() {
    HUDS.token.sidebar?.render();
    HUDS.persistent.sidebar?.render();
}

export { onRenderSettingsConfig, registerModuleSettings };
