import {
    MODULE,
    R,
    createHTMLElement,
    htmlQuery,
    localize,
    registerKeybind,
    registerSetting,
    userIsGM,
} from "foundry-pf2e";
import { PF2eHudPersistent } from "./hud/persistent";
import { PF2eHudPopup } from "./hud/popup/base";
import { PF2eHudResources } from "./hud/resources";
import { PF2eHudFilter } from "./hud/sidebar/filter";
import { PF2eHudToken } from "./hud/token";
import { PF2eHudTooltip } from "./hud/tooltip";
import { PF2eHudTracker } from "./hud/tracker";
import { rollRecallKnowledge } from "./actions/recall-knowledge";
import { useResolve } from "./actions/resolve";
import { editAvatar } from "./utils/avatar";
import { getNpcStrikeImage } from "./utils/npc-attacks";

MODULE.register("pf2e-hud", "PF2e HUD");

const HUDS = {
    tooltip: new PF2eHudTooltip(),
    token: new PF2eHudToken(),
    persistent: new PF2eHudPersistent(),
    tracker: new PF2eHudTracker(),
    resources: new PF2eHudResources(),
};

Hooks.once("canvasReady", () => {
    document
        .getElementById("board")
        ?.addEventListener("click", () => HUDS.persistent.closeSidebar());
});

Hooks.once("setup", () => {
    const isGM = userIsGM();
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

    registerSetting({
        key: "closePopupOnSendToChat",
        type: Boolean,
        default: false,
        scope: "client",
    });

    registerSetting({
        key: "hideUntrained",
        type: Boolean,
        default: false,
        scope: "client",
        onChange: () => {
            HUDS.token.sidebar?.render();
            HUDS.persistent.sidebar?.render();
        },
    });

    registerKeybind("setActor", {
        onUp: () => HUDS.persistent.setSelectedToken(),
    });

    registerKeybind("filter", {
        onUp: () => {
            const sidebar = HUDS.persistent.sidebar ?? HUDS.token.sidebar;
            if (!sidebar) return;

            if (sidebar.filter) sidebar.filter = "";
            else new PF2eHudFilter(sidebar).render(true);
        },
    });

    registerKeybind("altTracker", {
        restricted: true,
        editable: [{ key: "ControlLeft", modifiers: [] }],
        onUp: () => HUDS.tracker.toggleMenu(false),
        onDown: () => HUDS.tracker.toggleMenu(true),
    });

    for (const hud of huds) {
        const currentOffset = settings.length;
        const orphanSettings: SettingOptions[] = [];

        for (const setting of hud.getSettings()) {
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
    }

    for (const setting of settings) {
        if (setting.gmOnly && !isGM) continue;
        registerSetting(setting);
    }

    const actions = {
        rollRecallKnowledge,
        useResolve,
    };

    const utils = {
        editAvatar,
        getNpcStrikeImage,
    };

    MODULE.current.api = {
        hud: HUDS,
        actions,
        utils,
    };

    // @ts-ignore
    game.hud = {
        ...HUDS,
        actions,
        utils,
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

        //

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
});

function getFadingElements() {
    const list = [
        HUDS.token.mainElement,
        ...[HUDS.token, HUDS.persistent].map(
            (x) => x.sidebar && x.sidebar.key !== "extras" && x.sidebar.element
        ),
        ...PF2eHudPopup.apps,
    ];
    return R.pipe(list, R.filter(R.isTruthy));
}

window.addEventListener(
    "dragstart",
    () => {
        for (const element of getFadingElements()) {
            element.classList.add("pf2e-hud-fadeout");
        }

        window.addEventListener(
            "dragend",
            () => {
                setTimeout(() => {
                    for (const element of getFadingElements()) {
                        element.classList.remove("pf2e-hud-fadeout");
                    }
                }, 500);
            },
            { once: true, capture: true }
        );
    },
    true
);

export { HUDS as hud };
