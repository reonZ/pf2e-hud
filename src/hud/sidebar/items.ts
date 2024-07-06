import {
    ErrorPF2e,
    ITEM_CARRY_TYPES,
    IdentifyItemPopup,
    addListenerAll,
    consumeItem,
    createHTMLElement,
    detachSubitem,
    htmlClosest,
    tupleHasValue,
} from "foundry-pf2e";
import { getItemFromElement } from "../shared/base";
import { PF2eHudSidebar, SidebarContext, SidebarName, SidebarRenderOptions } from "./base";

class PF2eHudSidebarItems extends PF2eHudSidebar {
    get key(): SidebarName {
        return "items";
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<ItemContext> {
        const actor = this.actor;
        const inventory = actor.inventory;
        const parentData = await super._prepareContext(options);

        const inventoryData = actor.sheet.prepareInventory();
        inventoryData.sections = inventoryData.sections
            .filter((section): section is ItemList => !!section.items.length)
            .map((section) => {
                const sectionFilters: string[] = [];

                section.items = section.items.map((itemData) => {
                    itemData.filterValue = getItemFilter(itemData);
                    sectionFilters.push(itemData.filterValue);
                    return itemData;
                });

                section.filterValue = sectionFilters.join("|");
                return section;
            });

        const data: ItemContext = {
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

    _getDragData(
        target: HTMLElement,
        baseDragData: Record<string, JSONValue>,
        item: Maybe<ItemPF2e<ActorPF2e>>
    ) {
        return { fromInventory: true };
    }

    _activateListeners(html: HTMLElement) {
        const actor = this.actor;

        addListenerAll(html, "[data-action]:not(disabled)", async (event, el) => {
            const action = el.dataset.action as ItemsActionEvent;
            const item = await getItemFromElement(el, actor);
            if (!item?.isOfType("physical")) return;

            switch (action) {
                case "toggle-container": {
                    if (!item.isOfType("backpack")) return;
                    const isCollapsed = item.system.collapsed ?? false;
                    return item.update({ "system.collapsed": !isCollapsed });
                }

                case "delete-item": {
                    return actor.sheet.deleteItem(item, event);
                }

                case "edit-item": {
                    return item.sheet.render(true);
                }

                case "toggle-identified": {
                    if (item.isIdentified) {
                        item.setIdentificationStatus("unidentified");
                    } else {
                        new IdentifyItemPopup(item).render(true);
                    }
                    break;
                }

                case "toggle-invested": {
                    const itemId = htmlClosest(event.target, "[data-item-id]")?.dataset.itemId;
                    if (itemId && actor.isOfType("character")) {
                        actor.toggleInvested(itemId);
                    }
                    break;
                }

                case "detach-subitem": {
                    return detachSubitem(item, event.ctrlKey);
                }

                case "repair-item": {
                    return game.pf2e.actions.repair({ event, item });
                }

                case "open-carry-type-menu": {
                    if (actor.isOfType("character")) {
                        openCarryTypeMenu(actor, el);
                    }
                    break;
                }

                case "use-item": {
                    if (item.isOfType("consumable") && !item.isAmmo) {
                        consumeItem(event, item);
                    }
                    break;
                }
            }
        });
    }
}

async function openCarryTypeMenu(actor: CharacterPF2e, anchor: HTMLElement): Promise<void> {
    // Close the menu and return early if any carry-type menu is already open
    const menuOpen = !!document.body.querySelector("aside.locked-tooltip.carry-type-menu");
    if (menuOpen) game.tooltip.dismissLockedTooltips();

    const itemId = htmlClosest(anchor, "[data-item-id]")?.dataset.itemId;
    const item = actor.inventory.get(itemId, { strict: true });
    const hasStowingContainers = actor.itemTypes.backpack.some(
        (i) => i.system.stowing && !i.isInContainer
    );
    const templateArgs = { item, hasStowingContainers };
    const template = await renderTemplate(
        "systems/pf2e/templates/actors/partials/carry-type.hbs",
        templateArgs
    );
    const content = createHTMLElement("ul", { innerHTML: template });

    content.addEventListener("click", (event) => {
        const menuOption = htmlClosest(event.target, "a[data-carry-type]");
        if (!menuOption) return;

        const carryType = menuOption.dataset.carryType;
        if (!tupleHasValue(ITEM_CARRY_TYPES, carryType)) {
            throw ErrorPF2e("Unexpected error retrieving requested carry type");
        }

        const handsHeld = Number(menuOption.dataset.handsHeld) || 0;
        if (!tupleHasValue([0, 1, 2], handsHeld)) {
            throw ErrorPF2e("Invalid number of hands specified");
        }

        const inSlot = "inSlot" in menuOption.dataset;
        const current = item.system.equipped;
        if (
            carryType !== current.carryType ||
            inSlot !== current.inSlot ||
            (carryType === "held" && handsHeld !== current.handsHeld)
        ) {
            actor.changeCarryType(item, { carryType, handsHeld, inSlot });
            game.tooltip.dismissLockedTooltips();
        }
    });

    game.tooltip.activate(anchor, { cssClass: "pf2e-carry-type", content, locked: true });
}

function getItemFilter(itemData: SidebarItem): string {
    if (itemData.item.subitems.size) {
        return `${itemData.item.name} ` + itemData.item.subitems.map((x) => x.name).join("|");
    }

    if (!itemData.heldItems?.length) return itemData.item.name;

    itemData.heldItems = itemData.heldItems.map((x) => {
        x.filterValue = getItemFilter(x);
        return x;
    });

    return `${itemData.item.name} ` + itemData.heldItems.map((x) => x.filterValue).join("|");
}

type SidebarItem = Omit<InventoryItem, "heldItems"> & {
    filterValue: string;
    heldItems?: SidebarItem[];
};

type ItemList = Omit<SheetItemList, "items"> & {
    filterValue: string;
    items: SidebarItem[];
};

type ItemsActionEvent =
    | "toggle-container"
    | "delete-item"
    | "edit-item"
    | "toggle-identified"
    | "toggle-invested"
    | "detach-subitem"
    | "repair-item"
    | "open-carry-type-menu"
    | "use-item";

type ItemContext = SidebarContext &
    SheetInventory & {
        isGM: boolean;
        isNPC: boolean;
        isCharacter: boolean;
        wealth: {
            coins: number;
            total: number;
        };
    };

export { PF2eHudSidebarItems };
