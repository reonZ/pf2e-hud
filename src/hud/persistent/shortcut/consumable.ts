import { ConsumablePF2e, CreaturePF2e } from "module-helpers";
import { generateItemShortcutFields, getItemSlug, ItemShortcut, ItemShortcutSchema } from ".";
import fields = foundry.data.fields;

class ConsumableShortcut extends ItemShortcut<
    ConsumableShortcutSchema,
    ConsumablePF2e<CreaturePF2e>
> {
    static defineSchema(): ConsumableShortcutSchema {
        return {
            ...generateItemShortcutFields("consumable"),
            slug: new fields.StringField({
                required: true,
                nullable: false,
            }),
        };
    }

    get disabled(): boolean {
        const counter = this.counter;
        return !counter || !counter.value;
    }

    get counter(): { value: number } {
        const item = this.item;
        const uses =
            item?.uses.max && (item.uses.max > 1 || item.category === "wand")
                ? item.uses.value
                : undefined;

        return { value: uses ?? item?.quantity ?? 0 };
    }

    _item(): ConsumablePF2e<CreaturePF2e> | null {
        const exact = this.actor.items.get<ConsumablePF2e<CreaturePF2e>>(this.itemId);

        if (exact || !this.slug) {
            return exact ?? null;
        }

        const same = this.actor.itemTypes.consumable.find(
            (item) => getItemSlug(item) === this.slug
        );

        return same ?? null;
    }
}

interface ConsumableShortcut extends ModelPropsFromSchema<ConsumableShortcutSchema> {}

type ConsumableShortcutSchema = ItemShortcutSchema & {
    slug: fields.StringField<string, string, true, false, false>;
};

type ConsumableShortcutData = SourceFromSchema<ConsumableShortcutSchema>;

export { ConsumableShortcut };
export type { ConsumableShortcutData };
