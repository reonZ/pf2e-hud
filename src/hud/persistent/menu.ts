import { addListener, addListenerAll, localize } from "foundry-pf2e";
import { PersistentContext, PersistentRenderOptions, PF2eHudPersistent } from "../persistent";

function prepareMenuContext(
    this: PF2eHudPersistent,
    context: PersistentContext,
    options: PersistentRenderOptions
): MenuContext {
    const setTooltipParts = [["setActor", "leftClick"]];
    const hasSavedActor = !!this.savedActor;
    if (hasSavedActor) setTooltipParts.push(["unsetActor", "rightClick"]);

    const setActorTooltip = setTooltipParts
        .map(([key, click]) => {
            let msg = localize("persistent.menu", key);
            if (hasSavedActor) msg = `${localize(click)} ${msg}`;
            return `<div>${msg}</div>`;
        })
        .join("");

    return {
        ...context,
        hasSavedActor,
        setActorTooltip,
        hotbarLocked: ui.hotbar.locked,
    };
}

function activateMenuListeners(this: PF2eHudPersistent, html: HTMLElement) {
    const actor = this.actor;

    addListener(html, "[data-action='select-actor']", "contextmenu", () => {
        this.setActor(null, { force: true });
    });

    addListenerAll(html, "[data-action]", (event, el) => {
        const action = el.dataset.action as MenuActionEvent;

        switch (action) {
            case "toggle-users": {
                this.setSetting("showUsers", !this.getSetting("showUsers"));
                break;
            }
            case "open-macros": {
                ui.macros.renderPopout(true);
                break;
            }
            case "toggle-hotbar-lock": {
                ui.hotbar._toggleHotbarLock();
                break;
            }
            case "open-sheet": {
                actor?.sheet.render(true);
                break;
            }
            case "select-actor": {
                this.setSelectedToken();
                break;
            }
            case "toggle-clean": {
                this.setSetting("cleanPortrait", !this.getSetting("cleanPortrait"));
                break;
            }
        }
    });
}

type MenuActionEvent =
    | "toggle-users"
    | "open-macros"
    | "toggle-hotbar-lock"
    | "open-sheet"
    | "select-actor"
    | "toggle-clean";

type MenuContext = PersistentContext & {
    hotbarLocked: boolean;
    hasSavedActor: boolean;
    setActorTooltip: string;
};

export type { MenuContext };
export { activateMenuListeners, prepareMenuContext };
