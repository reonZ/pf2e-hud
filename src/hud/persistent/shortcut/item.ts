import {
    ConsumablePF2e,
    CreaturePF2e,
    EquipmentPF2e,
    IdField,
    ItemType,
    usePhysicalItem,
} from "module-helpers";
import { BaseShortcutSchema, generateBaseShortcutFields, getItemSlug, PersistentShortcut } from ".";
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
    static async getItem(
        actor: CreaturePF2e,
        data: SourceFromSchema<ItemShortcutSchema>
    ): Promise<Maybe<ItemShortcutItem>> {
        const item =
            actor.items.get(data.itemId) ??
            actor.itemTypes[data.type as ItemType].find((item) => getItemSlug(item) === data.slug);
        return item as Maybe<ItemShortcutItem>;
    }

    get canUse(): boolean {
        return super.canUse && !this.dropped;
    }

    get canAltUse(): boolean {
        return !!this.item;
    }

    get dropped(): boolean {
        return this.item?.system.equipped.carryType === "dropped";
    }

    get greyed(): boolean {
        return !this.item || this.dropped;
    }

    get quantity(): number {
        return this.item?.quantity ?? 0;
    }

    get unusableReason(): string | undefined {
        return !this.item
            ? "match"
            : this.dropped
            ? "dropped"
            : this.quantity < 1
            ? "quantity"
            : undefined;
    }

    get subtitle(): string {
        return game.i18n.localize(`TYPES.Item.${this.item?.type ?? this.type}`);
    }

    use(event: MouseEvent): void {
        const item = this.item;

        if (item?.isOfType("consumable", "equipment")) {
            usePhysicalItem(event, item);
        }
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
