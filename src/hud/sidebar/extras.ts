import { PF2eHudSidebar, SidebarName } from "./base";

class PF2eHudSidebarExtras extends PF2eHudSidebar {
    get key(): SidebarName {
        return "extras";
    }

    _activateListeners(html: HTMLElement) {}
}

export { PF2eHudSidebarExtras };
