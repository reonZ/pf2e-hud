import { MODULE } from "foundry-pf2e";
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
    game.hud = {
        ...HUDS,
        actions,
        utils,
    };

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
