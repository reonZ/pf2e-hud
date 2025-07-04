import {
    ConsumablePF2e,
    CreaturePF2e,
    EquipmentPF2e,
    IdField,
    PhysicalItemPF2e,
    usePhysicalItem,
} from "module-helpers";
import {
    BasePersistentShortcut,
    BaseShortcutSchema,
    generateBaseShortcutFields,
    ShortcutTooltipData,
} from ".";

function generateItemShortcutFields(type: string): ItemShortcutSchema {
    return {
        ...generateBaseShortcutFields(type),
        itemId: new IdField({
            required: true,
            nullable: false,
        }),
    };
}

class ItemShortcut<
    TSchema extends BaseShortcutSchema,
    TItem extends PhysicalItemPF2e<CreaturePF2e>
> extends BasePersistentShortcut<TSchema, TItem> {
    get disabled(): boolean {
        return !this.item;
    }

    use(event: Event): void {
        const item = this.item;

        if (item?.isOfType("consumable", "equipment")) {
            usePhysicalItem(
                event,
                item as EquipmentPF2e<CreaturePF2e> | ConsumablePF2e<CreaturePF2e>
            );
        }
    }

    altUse(): void {
        this.item?.sheet.render(true);
    }

    _item(): TItem | null {
        return this.actor.items.get<TItem>(this.itemId) ?? null;
    }

    _tooltipData(): ShortcutTooltipData {
        return {
            altUse: game.i18n.localize("PF2E.EditItemTitle"),
        };
    }
}

interface ItemShortcut<
    TSchema extends BaseShortcutSchema,
    TItem extends PhysicalItemPF2e<CreaturePF2e>
> extends ModelPropsFromSchema<ItemShortcutSchema> {}

type ItemShortcutSchema = BaseShortcutSchema & {
    itemId: IdField<true, false, false>;
};

export { generateItemShortcutFields, ItemShortcut };
export type { ItemShortcutSchema };
