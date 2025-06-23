import {
    ActorPF2e,
    ApplicationRenderOptions,
    CharacterPF2e,
    createHTMLElement,
    ErrorPF2e,
    htmlClosest,
    IdentifyItemPopup,
    InventoryItem,
    isCastConsumable,
    ITEM_CARRY_TYPES,
    ItemPF2e,
    localizer,
    PhysicalItemPF2e,
    R,
    SheetInventory,
    tupleHasValue,
    usePhysicalItem,
} from "module-helpers";
import { SidebarPF2eHUD } from ".";
import applications = foundry.applications;
import { FilterValue } from "hud/shared";

const _cached: { investedToggle?: string; investedLabel?: string } = {};

class ItemsSidebarPF2eHUD extends SidebarPF2eHUD {
    get name(): "items" {
        return "items";
    }

    protected async _prepareContext(options: ApplicationRenderOptions): Promise<ItemsHudContext> {
        const actor = this.actor;
        const data = actor.sheet["prepareInventory"]() as ItemsHudContext;
        const isGM = (data.isGM = game.user.isGM);
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

        data.sections = await Promise.all(
            R.pipe(
                data.sections,
                R.filter((section): section is SidebarItemList => section.items.length > 0),
                R.map(async (section) => {
                    section.filterValue = new FilterValue();

                    // we don't want infinite depth of containers so we bring them all back to depth 1
                    const itemsPromises = extractContainers(section.items).map(async (itemData) => {
                        itemData.canBeUsed = await canBeUsed(itemData);
                        itemData.filterValue = new FilterValue(itemData.item);

                        if (itemData.heldItems?.length) {
                            const heldItems = itemData.heldItems.map(async (heldItemData) => {
                                heldItemData.canBeUsed = await canBeUsed(heldItemData);
                                heldItemData.filterValue = new FilterValue(heldItemData.item);

                                itemData.filterValue.add(heldItemData.filterValue);

                                return heldItemData;
                            });

                            itemData.heldItems = await Promise.all(heldItems);
                        } else if (itemData.item.subitems.size) {
                            itemData.filterValue.add(...itemData.item.subitems);
                        }

                        section.filterValue.add(itemData.filterValue);
                        return itemData;
                    });

                    section.items = await Promise.all(itemsPromises);

                    return section;
                })
            )
        );

        // TODO when toolbelt.identify is back
        data.canIdentify = isGM;
        // data.canIdentify = isGM || game.toolbelt?.api.identify.canPlayerIdentify()
        data.investedTooltip = getInvestedTooltip(data);
        data.isCharacter = actor.isOfType("character");
        data.isNPC = actor.isOfType("npc");
        data.wealth = {
            coins: actor.inventory.coins.goldValue,
            total: actor.inventory.totalWealth.goldValue,
        };

        return data;
    }

    protected async _onClickAction(event: PointerEvent, target: HTMLElement) {
        if (event.button !== 0) return;

        const item = await this.getItemFromElement<ItemPF2e<ActorPF2e>>(target);
        if (!item?.isOfType("physical")) return;

        const actor = this.actor;
        const action = target.dataset.action as EventAction;

        if (action === "delete-item") {
            actor.sheet["deleteItem"](item, event);
        } else if (action === "detach-subitem") {
            detachSubitem(item, event.ctrlKey);
        } else if (action === "edit-item") {
            item.sheet.render(true);
        } else if (action === "open-carry-type-menu") {
            if (actor.isOfType("character")) {
                openCarryTypeMenu(actor, target);
            }
        } else if (action === "repair-item") {
            game.pf2e.actions.repair({ event, item });
        } else if (action === "toggle-container") {
            if (item.isOfType("backpack")) {
                const isCollapsed = item.system.collapsed ?? false;
                item.update({ "system.collapsed": !isCollapsed });
            }
        } else if (action === "toggle-identified") {
            this.#toggleIdentified(item);
        } else if (action === "toggle-invested") {
            if (actor.isOfType("character")) {
                actor.toggleInvested(item.id);
            }
        } else if (action === "use-item") {
            if (item.isOfType("consumable", "equipment")) {
                usePhysicalItem(event, item);
            }
        }
    }

    #toggleIdentified(item: PhysicalItemPF2e) {
        if (item.isIdentified) {
            item.setIdentificationStatus("unidentified");
            return;
        }

        // TODO when toolbelt.identify is implemented
        // if (game.toolbelt?.getToolSetting("identify", "enabled")) {
        //     if (game.user.isGM) {
        //         game.toolbelt.api.identify.openTracker(item);
        //     } else {
        //         game.toolbelt.api.identify.requestIdentify(item);
        //     }
        // } else {
        new IdentifyItemPopup(item).render(true);
        // }
    }
}

function getInvestedTooltip(data: ItemsHudContext): string {
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

/**
 * https://github.com/foundryvtt/pf2e/blob/0191f1fdac24c3903a939757a315043d1fcbfa59/src/module/actor/creature/sheet.ts#L293
 */
async function openCarryTypeMenu(actor: CharacterPF2e, anchor: HTMLElement): Promise<void> {
    // Close the menu and return early if any carry-type menu is already open
    const menuOpen = !!document.body.querySelector("aside.locked-tooltip.carry-type-menu");
    if (menuOpen) game.tooltip.dismissLockedTooltips();

    const itemId = htmlClosest(anchor, "[data-item-id]")?.dataset.itemId;
    const item = actor.inventory.get(itemId, { strict: true });
    const hasStowingContainers = actor.itemTypes.backpack.some(
        (i) => i.system.stowing && !i.isInContainer
    );
    const templatePath = "systems/pf2e/templates/actors/partials/carry-type.hbs";
    const templateArgs = { item, hasStowingContainers };
    const template = await applications.handlebars.renderTemplate(templatePath, templateArgs);
    const html = createHTMLElement("ul", { content: template });

    html.addEventListener("click", (event) => {
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

    game.tooltip.activate(anchor, { cssClass: "pf2e carry-type-menu", html, locked: true });
}

/**
 * https://github.com/foundryvtt/pf2e/blob/0191f1fdac24c3903a939757a315043d1fcbfa59/src/module/item/physical/helpers.ts#L224
 */
async function detachSubitem(subitem: PhysicalItemPF2e, skipConfirm: boolean): Promise<void> {
    const parentItem = subitem.parentItem;
    if (!parentItem) throw ErrorPF2e("Subitem has no parent item");

    const localize = localizer("PF2E.Item.Physical.Attach.Detach");
    const confirmed =
        skipConfirm ||
        (await applications.api.DialogV2.confirm({
            window: { title: localize("Label") },
            content: createHTMLElement("p", {
                content: [localize("Prompt", { attachable: subitem.name })],
            }).outerHTML,
            yes: { default: true },
        }));

    if (confirmed) {
        const deletePromise = subitem.delete();
        const createPromise = (async (): Promise<unknown> => {
            // Find a stack match, cloning the subitem as worn so the search won't fail due to it being equipped
            const stack = subitem.isOfType("consumable")
                ? parentItem.actor?.inventory.findStackableItem(
                      subitem.clone({ "system.equipped.carryType": "worn" })
                  )
                : null;
            const keepId = !!parentItem.actor && !parentItem.actor.items.has(subitem.id);
            return (
                stack?.update({ "system.quantity": stack.quantity + 1 }) ??
                Item.implementation.create(
                    foundry.utils.mergeObject(subitem.toObject(), {
                        "system.containerId": parentItem.system.containerId,
                    }),
                    { parent: parentItem.actor, keepId }
                )
            );
        })();

        await Promise.all([deletePromise, createPromise]);
    }
}

type EventAction =
    | "delete-item"
    | "detach-subitem"
    | "edit-item"
    | "open-carry-type-menu"
    | "repair-item"
    | "toggle-container"
    | "toggle-identified"
    | "toggle-invested"
    | "use-item";

type ItemsHudContext = SheetInventory & {
    canIdentify: boolean;
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

type SidebarItem = Omit<InventoryItem, "heldItems"> & {
    canBeUsed: boolean;
    filterValue: FilterValue;
    heldItems?: SidebarItem[];
};

type SidebarItemList = Omit<SheetItemList, "items"> & {
    filterValue: FilterValue;
    items: SidebarItem[];
};

export { ItemsSidebarPF2eHUD };
