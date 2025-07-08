import { ConsumablePF2e, CreaturePF2e, R, ValueAndMaybeMax } from "module-helpers";
import { generateItemShortcutFields, ItemShortcut, ItemShortcutSchema, ShortcutSource } from ".";

class ConsumableShortcut extends ItemShortcut<
    ConsumableShortcutSchema,
    ConsumablePF2e<CreaturePF2e>
> {
    #uses?: number | null;

    static defineSchema(): ConsumableShortcutSchema {
        return generateItemShortcutFields("consumable");
    }

    get canUse(): boolean {
        return super.canUse && this.counter.value > 0;
    }

    get greyed(): boolean {
        return this.counter.value < 1;
    }

    get uses(): number | null {
        if (this.#uses !== undefined) {
            return this.#uses;
        }

        const item = this.item;
        return (this.#uses =
            item?.uses.max && (item.uses.max > 1 || item.category === "wand")
                ? item.uses.value
                : null);
    }

    get counter(): ValueAndMaybeMax {
        return { value: this.uses ?? this.quantity };
    }

    get unusableReason(): string | undefined {
        return !this.item
            ? "match"
            : this.dropped
            ? "dropped"
            : R.isNullish(this.uses)
            ? this.quantity < 1
                ? "quantity"
                : undefined
            : this.uses < 1
            ? "uses"
            : undefined;
    }
}

interface ConsumableShortcut extends ModelPropsFromSchema<ConsumableShortcutSchema> {
    type: "consumable";
}

type ConsumableShortcutSchema = ItemShortcutSchema;

type ConsumableShortcutData = ShortcutSource<ConsumableShortcutSchema>;

export { ConsumableShortcut };
export type { ConsumableShortcutData };
