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
    getItemSlug,
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

class ItemShortcut<
    TSchema extends BaseShortcutSchema,
    TItem extends PhysicalItemPF2e<CreaturePF2e>
> extends BasePersistentShortcut<TSchema, TItem> {
    get disabled(): boolean {
        return !this.item || this.dropped;
    }

    get dropped(): boolean {
        return this.item?.system.equipped.carryType === "dropped";
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
        const exact = this.actor.items.get<TItem>(this.itemId);

        if (exact || !this.slug) {
            return exact ?? null;
        }

        const same = this.actor.itemTypes[this.type].find(
            (item) => getItemSlug(item) === this.slug
        );

        return (same ?? null) as TItem | null;
    }

    _tooltipData(): ShortcutTooltipData {
        const data = super._tooltipData();

        data.altUse = game.i18n.localize("PF2E.EditItemTitle");

        if (!data.reason) {
            data.reason = this.dropped
                ? "dropped"
                : (this.item?.quantity ?? 0) < 1
                ? "quantity"
                : undefined;
        }

        return data;
    }
}

interface ItemShortcut<
    TSchema extends BaseShortcutSchema,
    TItem extends PhysicalItemPF2e<CreaturePF2e>
> extends ModelPropsFromSchema<ItemShortcutSchema> {
    type: "consumable" | "equipment";
}

type ItemShortcutSchema = BaseShortcutSchema & {
    itemId: IdField<true, false, false>;
    slug: fields.StringField<string, string, true, false, false>;
};

export { generateItemShortcutFields, ItemShortcut };
export type { ItemShortcutSchema };
