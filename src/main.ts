import {
    MODULE,
    createHTMLElement,
    htmlQuery,
    localize,
    registerKeybind,
    registerSetting,
} from "foundry-pf2e";
import { PF2eHudPersistent } from "./hud/persistent";
import { PF2eHudToken } from "./hud/token";
import { PF2eHudTooltip } from "./hud/tooltip";
import { PF2eHudTracker } from "./hud/tracker";

MODULE.register("pf2e-hud", "PF2e HUD");

const HUDS = {
    tooltip: new PF2eHudTooltip(),
    token: new PF2eHudToken(),
    persistent: new PF2eHudPersistent(),
    tracker: new PF2eHudTracker(),
};

Hooks.once("canvasReady", () => {
    document
        .getElementById("board")
        ?.addEventListener("click", () => HUDS.persistent.closeSidebar());
});

Hooks.once("setup", () => {
    const huds = Object.values(HUDS);
    const settings: SettingOptions[] = [];

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

    registerSetting({
        key: "popupOnCursor",
        type: Boolean,
        default: true,
        scope: "client",
    });

    for (const hud of huds) {
        const currentOffset = settings.length;
        const orphanSettings: SettingOptions[] = [];

        for (const setting of hud.SETTINGS) {
            const key = `${hud.key}.${setting.key}`;
            const index = hud.SETTINGS_ORDER.indexOf(setting.key as any);

            if (setting.default === undefined) {
                setting.default = localize(`settings.${key}.default`);
            }

            setting.key = key;

            if (index !== -1) settings[index + currentOffset] = setting;
            else orphanSettings.push(setting);
        }

        settings.push(...orphanSettings);

        for (const keybind of hud.keybinds ?? []) {
            keybind.name = `${hud.key}.${keybind.name}`;
            registerKeybind(keybind.name, keybind);
        }
    }

    for (const setting of settings) {
        registerSetting(setting);
    }

    MODULE.current.api = {
        hud: HUDS,
    };

    for (const hud of huds) {
        hud.enable();
    }
});

Hooks.on("renderSettingsConfig", (app: SettingsConfig, $html: JQuery) => {
    const html = $html[0];
    const tab = htmlQuery(html, `.tab[data-tab="${MODULE.id}"]`);

    for (const hud of Object.values(HUDS)) {
        const group = htmlQuery(tab, `[data-setting-id^="${MODULE.id}.${hud.key}."]`);
        if (!group) continue;

        const titleElement = createHTMLElement("h3", {
            innerHTML: localize("settings", hud.key, "title"),
        });

        group.before(titleElement);
    }
});

window.addEventListener(
    "dragstart",
    () => {
        document.body.classList.add("pf2e-hud-fadeout");
        window.addEventListener(
            "dragend",
            () => setTimeout(() => document.body.classList.remove("pf2e-hud-fadeout"), 500),
            { once: true, capture: true }
        );
    },
    true
);

export { HUDS as hud };
