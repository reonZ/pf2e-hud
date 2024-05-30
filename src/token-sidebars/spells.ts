import { SummarizedSpellsData, getSummarizedSpellsDataForRender, localizePath } from "pf2e-api";
import { SidebarContext, SidebarRenderOptions } from "../sidebar";
import { PF2eHudTokenSidebar } from "./base";

class PF2eHudSpellsSidebar extends PF2eHudTokenSidebar {
    get sidebarKey(): "spells" {
        return "spells";
    }

    async _prepareContext(
        options: SidebarRenderOptions
    ): Promise<SpellsSidebarContext | SidebarContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);
        if (!actor.isOfType("character", "npc")) return parentData;

        const summarizedData = await getSummarizedSpellsDataForRender(actor, false, (str: string) =>
            localizePath("sidebars.spells", str)
        );

        const data: SpellsSidebarContext = {
            ...parentData,
            ...summarizedData,
        };

        return data;
    }
}

type SpellsSidebarContext = SidebarContext & SummarizedSpellsData & {};

export { PF2eHudSpellsSidebar };
