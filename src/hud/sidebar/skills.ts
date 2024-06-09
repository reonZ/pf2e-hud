import { PF2eHudSidebar, SidebarName } from "./base";

class PF2eHudSidebarSkills extends PF2eHudSidebar {
    get key(): SidebarName {
        return "skills";
    }

    _activateListeners(html: HTMLElement) {}
}

export { PF2eHudSidebarSkills };
