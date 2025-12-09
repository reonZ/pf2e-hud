import { FilterValue } from "hud";
import {
    ActorPF2e,
    ApplicationRenderOptions,
    isCastConsumable,
    PhysicalItemPF2e,
    R,
    SheetInventory,
} from "module-helpers";
import { ItemsSidebarItem, SidebarItem } from ".";
import { SidebarPF2eHUD } from "..";

class ItemsSidebarPF2eHUD extends SidebarPF2eHUD<PhysicalItemPF2e<ActorPF2e>, ItemsSidebarItem> {
    get name(): "items" {
        return "items";
    }

    protected async _prepareContext(options: ApplicationRenderOptions): Promise<ItemsHudContext> {
        const actor = this.actor;
        const sheetData = actor.sheet["prepareInventory"]();
        const isGM = game.user.isGM;
        const customConsumableUse = game.toolbelt?.getToolSetting("actionable", "use");
        const canUseMacro = game.toolbelt?.getToolSetting("actionable", "item");

        const canBeUsed = async (itemData: SidebarItem): Promise<boolean> => {
            const item = itemData.item;
            if (!item.isIdentified) return false;

            const isConsumable = item.isOfType("consumable");
            if (!isConsumable && !item.isOfType("equipment")) return false;
            if (isConsumable && (customConsumableUse || isCastConsumable(item))) return true;

            const macro = canUseMacro && (await game.toolbelt?.api.actionable.getItemMacro(item));
            return !!macro || (isConsumable && itemData.hasCharges && !item.isAmmo);
        };

        const sections = await Promise.all(
            R.pipe(
                sheetData.sections,
                R.filter((section): section is SidebarItemList => section.items.length > 0),
                R.map(async (section) => {
                    section.filterValue = new FilterValue();

                    // we don't want infinite depth of containers so we bring them all back to depth 1
                    const itemsPromises = extractContainers(section.items).map(async (itemData) => {
                        itemData.canBeUsed = await canBeUsed(itemData);

                        if (itemData.heldItems?.length) {
                            const heldItems = itemData.heldItems.map(async (heldItemData) => {
                                heldItemData.canBeUsed = await canBeUsed(heldItemData);
                                return this.addSidebarItem(ItemsSidebarItem, "id", heldItemData);
                            });

                            itemData.heldItems = await Promise.all(heldItems);
                        } else if (itemData.item.subitems.size) {
                            itemData.subItems = itemData.item.subitems.map((subItem) => {
                                const subItemData: SidebarItem = {
                                    canBeEquipped: false,
                                    canBeUsed: false,
                                    hasCharges: false,
                                    hidden: false,
                                    isContainer: false,
                                    isSubitem: true,
                                    isInvestable: false,
                                    isSellable: false,
                                    item: subItem,
                                    unitBulk: null,
                                };

                                return this.addSidebarItem(ItemsSidebarItem, "id", subItemData);
                            });
                        }

                        const sidebarItem = this.addSidebarItem(ItemsSidebarItem, "id", itemData);
                        section.filterValue.add(sidebarItem);

                        return sidebarItem;
                    });

                    section.items = await Promise.all(itemsPromises);

                    return section;
                })
            )
        );

        const canPlayerIdentify =
            !isGM &&
            !!game.toolbelt?.getToolSetting("identify", "enabled") &&
            game.toolbelt.getToolSetting("identify", "playerRequest");

        const wealth = {
            coins: actor.inventory.coins.goldValue,
            total: actor.inventory.totalWealth.goldValue,
        };

        return {
            ...sheetData,
            canIdentify: isGM || canPlayerIdentify,
            canMergeItems: game.toolbelt?.localize("betterInventory.sheet.merge"),
            investedTooltip: getInvestedTooltip(sheetData),
            isCharacter: actor.isOfType("character"),
            isGM,
            isNPC: actor.isOfType("npc"),
            sections,
            wealth,
        } satisfies ItemsHudContext;
    }

    protected async _onClickAction(event: PointerEvent, target: HTMLElement) {
        const action = target.dataset.action as EventAction;

        if (action === "merge-items" && event.button === 0) {
            return game.toolbelt?.api.betterInventory.mergeItems(this.actor);
        }

        const sidebarItem = this.getSidebarItemFromElement(target);
        if (!sidebarItem) return;

        if (event.button !== 0) {
            if (action === "split-item") {
                sidebarItem.split();
            }
            return;
        }

        switch (action) {
            case "delete-item": {
                return sidebarItem.delete(event);
            }

            case "detach-subitem": {
                return sidebarItem.detach(event);
            }

            case "edit-item": {
                return sidebarItem.openSheet();
            }

            case "open-carry-type-menu": {
                return sidebarItem.openCarryTypeMenu(target);
            }

            case "repair-item": {
                return sidebarItem.repair(event);
            }

            case "toggle-container": {
                return sidebarItem.toggleContainer();
            }

            case "toggle-identified": {
                return sidebarItem.toggleIdentified();
            }

            case "toggle-invested": {
                return sidebarItem.toggleInvested();
            }

            case "use-item": {
                return sidebarItem.use(event);
            }
        }
    }
}

const _cached: { investedToggle?: string; investedLabel?: string } = {};
function getInvestedTooltip(data: SheetInventory): string {
    const toggle = (_cached.investedToggle ??= game.i18n.localize("PF2E.ui.equipmentInvested"));
    const label = (_cached.investedLabel ??= game.i18n.localize("PF2E.InvestedLabel"));
    const { max, value } = data.invested ?? {};

    return `${toggle}<br>${label} - ${value} / ${max}`;
}

function extractContainers(items: SidebarItem[]): SidebarItem[] {
    return items.flatMap((itemData) => {
        if (!itemData.heldItems?.length) return itemData;

        const [foundContainers, foundItems] = R.partition(itemData.heldItems, (x) => {
            return !!x.heldItems?.length;
        });

        itemData.heldItems = foundItems;

        return [...extractContainers(foundContainers), itemData];
    });
}

type EventAction =
    | "delete-item"
    | "detach-subitem"
    | "edit-item"
    | "merge-items"
    | "open-carry-type-menu"
    | "repair-item"
    | "split-item"
    | "toggle-container"
    | "toggle-identified"
    | "toggle-invested"
    | "use-item";

type ItemsHudContext = SheetInventory & {
    canIdentify: boolean;
    canMergeItems: string | undefined;
    investedTooltip: string;
    isCharacter: boolean;
    isGM: boolean;
    isNPC: boolean;
    wealth: {
        coins: number;
        total: number;
    };
};

type SheetItemList = SheetInventory["sections"][number];

type SidebarItemList = Omit<SheetItemList, "items"> & {
    filterValue: FilterValue;
    items: ItemsSidebarItem[];
};

export { ItemsSidebarPF2eHUD };
