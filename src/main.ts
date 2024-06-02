import {
    MODULE,
    beforeHTMLFromString,
    htmlElement,
    localize,
    querySelector,
    registerKeybind,
    registerSetting,
} from "pf2e-api";
import { PF2eHudPersistent } from "./persistent";
import { PF2eHudToken } from "./token";
import { PF2eHudTooltip } from "./tooltip";
import { PF2eHudTracker } from "./tracker";

const hudList = {
    tooltip: new PF2eHudTooltip(),
    token: new PF2eHudToken(),
    persistent: new PF2eHudPersistent(),
    tracker: new PF2eHudTracker(),
};

MODULE.register("pf2e-hud", "PF2e HUD");

Hooks.once("setup", () => {
    const isGM = game.user.isGM;
    const huds = Object.values(hudList);

    for (const hud of huds) {
        for (const setting of hud.settings) {
            const key = `${hud.hudKey}.${setting.key}`;

            if (setting.default === undefined) {
                setting.default = localize(`settings.${key}.default`);
            }

            setting.key = key;
            registerSetting(setting);
        }

        for (const keybind of hud.keybinds) {
            keybind.name = `${hud.hudKey}.${keybind.name}`;
            registerKeybind(keybind.name, keybind);
        }
    }

    MODULE.current.api = {
        hud: hudList,
    };

    for (const hud of huds) {
        hud.enable();
    }
});

Hooks.on("renderSettingsConfig", onRenderSettingsConfig);

function onRenderSettingsConfig(app: SettingsConfig, $html: JQuery) {
    const html = htmlElement($html);
    const tab = querySelector(html, `.tab[data-tab="${MODULE.id}"]`);

    for (const hud of Object.values(hudList)) {
        const settings = hud.settings;
        const setting = game.user.isGM
            ? settings[0]
            : settings.find((setting) => setting.scope === "client")!;
        const group = querySelector(
            tab,
            `[data-setting-id="${MODULE.id}.${hud.hudKey}.${setting.key}"]`
        );

        if (group) {
            const label = localize("settings", hud.hudKey, "title");
            beforeHTMLFromString(group, `<h3>${label}</h3>`);
        }
    }
}

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

export { hudList as hud };
