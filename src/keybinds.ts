import { registerKeybind } from "module-helpers";
import { hud as HUDS } from "./main";
import { PF2eHudFilter } from "./hud/sidebar/filter";

function registerModuleKeybinds() {
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
}

export { registerModuleKeybinds };
