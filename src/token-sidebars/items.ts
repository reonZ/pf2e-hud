import { SidebarContext, SidebarRenderOptions } from "../sidebar";
import { addItemsListeners } from "../utils";
import { PF2eHudTokenSidebar } from "./base";

class PF2eHudItemsSidebar extends PF2eHudTokenSidebar {
    get sidebarKey(): "items" {
        return "items";
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<ItemsSidebarContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);
        const inventory = actor.inventory;

        const inventoryData = actor.sheet.prepareInventory();
        inventoryData.sections = inventoryData.sections.filter((section) => section.items.length);

        const data: ItemsSidebarContext = {
            ...parentData,
            ...inventoryData,
            isGM: game.user.isGM,
            isNPC: actor.isOfType("npc"),
            isCharacter: actor.isOfType("character"),
            wealth: {
                coins: inventory.coins.goldValue,
                total: inventory.totalWealth.goldValue,
            },
        };

        return data;
    }

    _activateListener(html: HTMLElement) {
        super._activateListener(html);
        addItemsListeners(this.actor, html);
    }
}

type ItemsSidebarContext = SidebarContext &
    SheetInventory & {
        isGM: boolean;
        isNPC: boolean;
        isCharacter: boolean;
        wealth: {
            coins: number;
            total: number;
        };
    };

export { PF2eHudItemsSidebar };
