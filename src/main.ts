import { MeasuredTemplatePF2e, MODULE } from "module-helpers";
import { rollRecallKnowledge } from "./actions/recall-knowledge";
import { useResolve } from "./actions/resolve";
import { PF2eHudPersistent } from "./hud/persistent";
import { PF2eHudPopup } from "./hud/popup/base";
import { PF2eHudResources } from "./hud/resources";
import { PF2eHudToken } from "./hud/token";
import { PF2eHudTooltip } from "./hud/tooltip";
import { PF2eHudTracker } from "./hud/tracker";
import { registerModuleKeybinds } from "./keybinds";
import { onRenderSettingsConfig, registerModuleSettings } from "./settings";
import { editAvatar } from "./utils/avatar";
import { getNpcStrikeImage } from "./utils/npc-attacks";
import { PF2eHudTime } from "./hud/time";
import { PF2eHudDice } from "./hud/dice";
import * as migrations from "./migrations";

MODULE.register("pf2e-hud", migrations);

const HUDS = {
    tooltip: new PF2eHudTooltip(),
    token: new PF2eHudToken(),
    persistent: new PF2eHudPersistent(),
    tracker: new PF2eHudTracker(),
    resources: new PF2eHudResources(),
    time: new PF2eHudTime(),
    dice: new PF2eHudDice(),
};

Hooks.once("canvasReady", () => {
    document
        .getElementById("board")
        ?.addEventListener("click", () => HUDS.persistent.closeSidebar());
});

Hooks.once("setup", () => {
    registerModuleSettings();
    registerModuleKeybinds();

    //

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
    game.hud = Object.defineProperties(
        {},
        {
            actions: {
                value: actions,
                writable: false,
                configurable: false,
                enumerable: false,
            },
            utils: {
                value: utils,
                writable: false,
                configurable: false,
                enumerable: false,
            },
            tooltip: {
                value: HUDS.tooltip,
                writable: false,
                configurable: false,
                enumerable: false,
            },
            token: {
                value: HUDS.token,
                writable: false,
                configurable: false,
                enumerable: false,
            },
            persistent: {
                value: HUDS.persistent,
                writable: false,
                configurable: false,
                enumerable: false,
            },
            tracker: {
                value: HUDS.tracker,
                writable: false,
                configurable: false,
                enumerable: false,
            },
            resources: {
                value: HUDS.resources,
                writable: false,
                configurable: false,
                enumerable: false,
            },
        }
    );

    for (const hud of Object.values(HUDS)) {
        hud.enable();
    }
});

Hooks.on("renderSettingsConfig", onRenderSettingsConfig);

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
