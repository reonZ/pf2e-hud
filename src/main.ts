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

    //

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

    registerKeybind("previousShortcutsSet", {
        onDown: () => {
            HUDS.persistent.changeShortcutsSet(-1);
        },
    });

    registerKeybind("nextShortcutsSet", {
        onDown: () => {
            HUDS.persistent.changeShortcutsSet(1);
        },
    });

    for (const hud of huds) {
        const mainSettingsOrder: string[] = hud.SETTINGS_ORDER;
        const subSettingsOrder: string[] = hud.SUB_SETTINGS_ORDER;
        const mainSettings: SettingOptions[] = [];
        const subSettings: SettingOptions[] = [];
        const orphanSettings: SettingOptions[] = [];

        for (const setting of hud.getSettings()) {
            const key = `${hud.key}.${setting.key}`;

            if (setting.default === undefined) {
                setting.default = localize(`settings.${key}.default`);
            }

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
});

Hooks.on("drawMeasuredTemplate", (template: MeasuredTemplatePF2e) => {
    if (!template.isPreview) return;

    addFadeOuts();

    HUDS.token.close();
    HUDS.persistent.closeSidebar();
});

Hooks.on("destroyMeasuredTemplate", (template: MeasuredTemplatePF2e) => {
    if (!template.isPreview) return;

    removeFadeOuts();
});

window.addEventListener(
    "dragstart",
    (event) => {
        addFadeOuts(event);
        window.addEventListener("dragend", () => removeFadeOuts(event), {
            once: true,
            capture: true,
        });
    },
    true
);

function addFadeOuts(event?: DragEvent) {
    for (const element of getFadingElements(event)) {
        const classList = element?.classList;
        if (!classList) continue;

        classList.add("pf2e-hud-fadeout");

        if (!event) {
            classList.add("pf2e-hud-fadeout-forced");
        }
    }
}

function removeFadeOuts(event?: DragEvent) {
    setTimeout(() => {
        for (const element of getFadingElements(event)) {
            element?.classList?.remove("pf2e-hud-fadeout", "pf2e-hud-fadeout-forced");
        }
    }, 500);
}

function refreshSidebar() {
    HUDS.token.sidebar?.render();
    HUDS.persistent.sidebar?.render();
}

function getFadingElements(event?: DragEvent) {
    const elements: Maybe<{ classList: DOMTokenList | undefined }>[] = [...PF2eHudPopup.apps];

    if (event) {
        elements.push(HUDS.token.mainElement);

        for (const element of [HUDS.token, HUDS.persistent]) {
            if (element.sidebar && element.sidebar.key !== "extras") {
                elements.push(element.sidebar.element);
            }
        }
    } else {
        elements.push(HUDS.persistent, HUDS.tracker);
    }

    return elements;
}

export { HUDS as hud };
