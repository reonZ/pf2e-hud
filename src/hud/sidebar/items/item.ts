import {
    ActorPF2e,
    createHTMLElement,
    ErrorPF2e,
    htmlClosest,
    IdentifyItemPopup,
    InventoryItem,
    ITEM_CARRY_TYPES,
    localizer,
    PhysicalItemPF2e,
    tupleHasValue,
    usePhysicalItem,
} from "module-helpers";
import { BaseSidebarItem } from "..";
import applications = foundry.applications;

class ItemsSidebarItem extends BaseSidebarItem<PhysicalItemPF2e<ActorPF2e>, SidebarItem> {
    constructor(data: SidebarItem) {
        super(data);

        if (this.heldItems?.length) {
            this.filterValue.add(...this.heldItems.map((x) => x.filterValue));
        }

        if (this.subItems?.length) {
            this.filterValue.add(...this.subItems.map((x) => x.filterValue));
        }
    }

    delete(event: MouseEvent) {
        const item = this.item;
        item.actor.sheet["deleteItem"](item, event);
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/0191f1fdac24c3903a939757a315043d1fcbfa59/src/module/item/physical/helpers.ts#L224
     */
    async detachSubitem(skipConfirm: boolean) {
        const subitem = this.item;
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

    /**
     * https://github.com/foundryvtt/pf2e/blob/0191f1fdac24c3903a939757a315043d1fcbfa59/src/module/actor/creature/sheet.ts#L293
     */
    async openCarryTypeMenu(anchor: HTMLElement) {
        const actor = this.item.actor;
        if (!actor.isOfType("character")) return;

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

    openSheet() {
        this.item.sheet.render(true);
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
}
interface ItemsSidebarItem
    extends BaseSidebarItem<PhysicalItemPF2e<ActorPF2e>, SidebarItem>,
        SidebarItem {
    get item(): PhysicalItemPF2e<ActorPF2e>;
}

type SidebarItem = Omit<InventoryItem, "heldItems"> & {
    canBeUsed: boolean;
    isSubitem: boolean;
    heldItems?: ItemsSidebarItem[];
    subItems?: ItemsSidebarItem[];
};

export { ItemsSidebarItem };
export type { SidebarItem };
