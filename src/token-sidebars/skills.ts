import { PF2eHudTokenSidebar } from "./base";

class PF2eHudSkillsSidebar extends PF2eHudTokenSidebar {
    get sidebarKey(): "skills" {
        return "skills";
    }
}

export { PF2eHudSkillsSidebar };
