import {
    ConsumablePF2e,
    CreaturePF2e,
    EquipmentPF2e,
    ItemType,
    usePhysicalItem,
    z,
    zDocumentId,
} from "foundry-helpers";
import { getItemSlug, PersistentShortcut, ShortcutData, zBaseShortcut } from "..";

function zItemShortcut(type: string) {
    return zBaseShortcut(type).extend({
        itemId: zDocumentId(true),
        slug: z.string().nonempty(),
    });
}

abstract class ItemShortcut<
    TSchema extends ItemShortcutSchema,
    TItem extends ItemShortcutItem,
> extends PersistentShortcut<TSchema, TItem> {
    static async getItem(actor: CreaturePF2e, data: ItemShortcutSource): Promise<Maybe<ItemShortcutItem>> {
        const item =
            actor.items.get(data.itemId) ??
            actor.itemTypes[data.type as ItemType].find((item) => getItemSlug(item) === data.slug);
        return item as Maybe<ItemShortcutItem>;
    }

    get canUse(): boolean {
        return super.canUse && !this.dropped && this.quantity > 0;
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
        return !this.item ? "match" : this.dropped ? "dropped" : this.quantity < 1 ? "quantity" : undefined;
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

interface ItemShortcut<
    TSchema extends ItemShortcutSchema,
    TItem extends ItemShortcutItem,
> extends ShortcutData<ItemShortcutSchema> {
    type: "consumable" | "equipment";
}

type ItemShortcutItem = EquipmentPF2e<CreaturePF2e> | ConsumablePF2e<CreaturePF2e>;

type ItemShortcutSchema = ReturnType<typeof zItemShortcut>;
type ItemShortcutSource = z.input<ItemShortcutSchema>;

export { ItemShortcut, zItemShortcut };
export type { ItemShortcutSchema };
