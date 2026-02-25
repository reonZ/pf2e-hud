import {
    ActorPF2e,
    createHTMLElement,
    ErrorPF2e,
    htmlClosest,
    InventoryItem,
    isControlDown,
    PhysicalItemPF2e,
    tupleHasValue,
    usePhysicalItem,
} from "foundry-helpers";
import { IdentifyItemPopup, ITEM_CARRY_TYPES } from "foundry-helpers/dist";
import {
    BaseSidebarItem,
    ConsumableShortcutSource,
    EquipmentShortcutSource,
    getItemSlug,
    SidebarItemDragData,
} from "hud";
import applications = foundry.applications;

class ItemsSidebarItem extends BaseSidebarItem<PhysicalItemPF2e<ActorPF2e>, SidebarItem> {
    constructor(data: SidebarItem) {
        super(data);

        if (this.heldItems?.length) {
            this.filterValue.add(...this.heldItems);
        }

        if (this.subItems?.length) {
            this.filterValue.add(...this.subItems);
        }
    }

    delete(event: PointerEvent) {
        const item = this.item;
        item.actor.sheet["deleteItem"](item, event);
    }

    detach(event: PointerEvent) {
        this.item.detach({ skipConfirm: isControlDown(event) });
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/1465f7190b2b8454094c50fa6d06e9902e0a3c41/src/module/actor/creature/sheet.ts#L294
     */
    async openCarryTypeMenu(anchor: HTMLElement) {
        const SYSTEM_ROOT = `systems/${game.system.id}`;
        const actor = this.item.actor;
        if (!actor.isOfType("character")) return;

        // Close the menu and return early if any carry-type menu is already open
        const menuOpen = !!document.body.querySelector("aside.locked-tooltip.carry-type-menu");
        if (menuOpen) game.tooltip.dismissLockedTooltips();

        const itemId = htmlClosest(anchor, "[data-item-id]")?.dataset.itemId;
        const item = actor.inventory.get(itemId, { strict: true });
        const hasStowingContainers = actor.itemTypes.backpack.some((i) => i.system.stowing && !i.isInContainer);
        const templatePath = `${SYSTEM_ROOT}/templates/actors/partials/carry-type.hbs`;
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

    openSheet() {
        this.item.sheet.render(true);
    }

    split() {
        game.toolbelt?.api.betterInventory.splitItem(this.item);
    }

    repair(event: Event) {
        game.pf2e.actions.repair({ event, item: this.item });
    }

    toggleContainer() {
        const item = this.item;

        if (item.isOfType("backpack")) {
            const isCollapsed = item.system.collapsed ?? false;
            item.update({ "system.collapsed": !isCollapsed });
        }
    }

    toggleIdentified() {
        const item = this.item;

        if (item.isIdentified) {
            item.setIdentificationStatus("unidentified");
            return;
        }

        if (game.toolbelt?.getToolSetting("identify", "enabled")) {
            if (game.user.isGM) {
                game.toolbelt.api.identify.openTracker(item);
            } else if (game.toolbelt.getToolSetting("identify", "playerRequest")) {
                game.toolbelt.api.identify.requestIdentify(item);
            }
        } else if (game.user.isGM) {
            new IdentifyItemPopup(item).render(true);
        }
    }

    toggleInvested() {
        const item = this.item;
        const actor = item.actor;

        if (actor.isOfType("character")) {
            actor.toggleInvested(item.id);
        }
    }

    use(event: Event) {
        const item = this.item;

        if (item.isOfType("consumable", "equipment")) {
            usePhysicalItem(event, item);
        }
    }

    toShortcut(): ItemShortcutSource {
        const item = this.item;

        return {
            img: this.img,
            itemId: item.id,
            name: this.label,
            slug: getItemSlug(item),
            type: this.item.type as "consumable" | "equipment",
        };
    }

    createDragData(): SidebarItemDragData {
        return {
            fromInventory: true,
            fromSidebar: this.toShortcut(),
        };
    }
}

interface ItemsSidebarItem extends Readonly<Omit<SidebarItem, "canBeUsed">> {
    canBeUsed: boolean;
}

type ItemShortcutSource = ConsumableShortcutSource | EquipmentShortcutSource;

type SidebarItem = Prettify<
    Omit<
        InventoryItem<PhysicalItemPF2e<ActorPF2e>>,
        "canEditQuantity" | "heldItems" | "subitems" | "unitBulk" | "unitPrice" | "assetValue"
    > & {
        canBeUsed: boolean;
        isSubitem: boolean;
        heldItems?: ItemsSidebarItem[];
        subItems?: ItemsSidebarItem[];
    }
>;

export { ItemsSidebarItem };
export type { SidebarItem };
