import {
    MODULE,
    beforeHTMLFromString,
    htmlElement,
    localize,
    querySelector,
    registerSetting,
} from "pf2e-api";
import { PF2eHudPersistent } from "./persistent";
import { PF2eHudToken } from "./token";
import { PF2eHudTooltip } from "./tooltip";

const hudList = {
    tooltip: new PF2eHudTooltip(),
    token: new PF2eHudToken(),
    persistent: new PF2eHudPersistent(),
};

MODULE.register("pf2e-hud", "PF2e HUD");

Hooks.once("setup", () => {
    // registerSetting({
    //     key: "partyObserved",
    //     type: Boolean,
    //     default: false,
    // });

    for (const hud of Object.values(hudList)) {
        for (const setting of hud.settings) {
            const key = `${hud.key}.${setting.key}`;

            if (setting.default === undefined) {
                setting.default = localize(`settings.${key}.default`);
            }

            setting.key = key;
            registerSetting(setting);
        }
    }

    MODULE.current.api = {
        hud: hudList,
    };

    for (const hud of Object.values(hudList)) {
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
            `[data-setting-id="${MODULE.id}.${hud.key}.${setting.key}"]`
        );

        if (group) {
            const label = localize("settings", hud.key, "title");
            beforeHTMLFromString(group, `<h3>${label}</h3>`);
        }
    }
}

export { hudList as hud };
