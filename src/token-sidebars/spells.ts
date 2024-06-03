import { SummarizedSpellsData, getSummarizedSpellsDataForRender, localizePath } from "pf2e-api";

import { SidebarContext, SidebarRenderOptions } from "../sidebar";
import { addSpellsListeners } from "../utils";
import { PF2eHudTokenSidebar } from "./base";

class PF2eHudSpellsSidebar extends PF2eHudTokenSidebar {
    get sidebarKey(): "spells" {
        return "spells";
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<SpellsSidebarContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);

        const summarizedData = await getSummarizedSpellsDataForRender(actor, false, (str: string) =>
            localizePath("sidebars.spells", str)
        );

        const data: SpellsSidebarContext = {
            ...parentData,
            ...summarizedData,
        };

        return data;
    }

    _activateListener(html: HTMLElement) {
        super._activateListener(html);
        addSpellsListeners(this.actor, html, () => this.closeIf("castSpell"));
    }
}

interface PF2eHudSpellsSidebar {
    get actor(): CharacterPF2e | NPCPF2e;
}

type SpellsSidebarContext = SidebarContext & SummarizedSpellsData;

export { PF2eHudSpellsSidebar };
