import { PF2eHudSidebar, SidebarName } from "./base";

class PF2eHudSidebarActions extends PF2eHudSidebar {
    get key(): SidebarName {
        return "actions";
    }

    _activateListeners(html: HTMLElement) {}
}

export { PF2eHudSidebarActions };
