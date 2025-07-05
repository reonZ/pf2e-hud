import {
    ConsumablePF2e,
    CreaturePF2e,
    EquipmentPF2e,
    IdField,
    ItemType,
    usePhysicalItem,
} from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    getItemSlug,
    PersistentShortcut,
    ShortcutDataset,
    ShortcutTooltipData,
} from ".";
import fields = foundry.data.fields;

function generateItemShortcutFields(type: string): ItemShortcutSchema {
    return {
        ...generateBaseShortcutFields(type),
        itemId: new IdField({
            required: true,
            nullable: false,
        }),
        slug: new fields.StringField({
            required: true,
            nullable: false,
        }),
    };
}

abstract class ItemShortcut<
    TSchema extends ItemShortcutSchema,
    TItem extends ItemShortcutItem
> extends PersistentShortcut<TSchema, TItem> {
    static getItem(
        actor: CreaturePF2e,
        data: SourceFromSchema<ItemShortcutSchema>
    ): Maybe<ItemShortcutItem> {
        const item =
            actor.items.get(data.itemId) ??
            actor.itemTypes[data.type as ItemType].find((item) => getItemSlug(item) === data.slug);
        return item as Maybe<ItemShortcutItem>;
    }

    get canUse(): boolean {
        return !this.disabled;
    }

    get canAltUse(): boolean {
        return !this.disabled;
    }

    get dropped(): boolean {
        return this.item?.system.equipped.carryType === "dropped";
    }

    get dataset(): ShortcutDataset | null {
        return this.item ? { itemId: this.item.id } : null;
    }

    get disabled(): boolean {
        return !this.item || this.dropped;
    }

    get greyed(): boolean {
        return false;
    }

    use(event: Event): void {
        const item = this.item;

        if (item?.isOfType("consumable", "equipment")) {
            usePhysicalItem(event, item);
        }
    }

    altUse(event: Event): void {
        this.item?.sheet.render(true);
    }

    tooltipData(): ShortcutTooltipData {
        const data = super.tooltipData();

        data.reason = !this.item
            ? "match"
            : this.dropped
            ? "dropped"
            : (this.item?.quantity ?? 0) < 1
            ? "quantity"
            : undefined;

        return data;
    }
}

interface ItemShortcut<TSchema extends ItemShortcutSchema, TItem extends ItemShortcutItem>
    extends ModelPropsFromSchema<ItemShortcutSchema> {
    type: "consumable" | "equipment";
}

type ItemShortcutItem = EquipmentPF2e<CreaturePF2e> | ConsumablePF2e<CreaturePF2e>;

type ItemShortcutSchema = BaseShortcutSchema & {
    itemId: IdField<true, false, false>;
    slug: fields.StringField<string, string, true, false, false>;
};

export { generateItemShortcutFields, ItemShortcut };
export type { ItemShortcutSchema };
