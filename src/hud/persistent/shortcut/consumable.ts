import { ConsumablePF2e, CreaturePF2e, R, ValueAndMaybeMax } from "module-helpers";
import { generateItemShortcutFields, ItemShortcut, ItemShortcutSchema, ShortcutSource } from ".";

class ConsumableShortcut extends ItemShortcut<
    ConsumableShortcutSchema,
    ConsumablePF2e<CreaturePF2e>
> {
    #uses?: ValueAndMaybeMax;

    static defineSchema(): ConsumableShortcutSchema {
        return generateItemShortcutFields("consumable");
    }

    get canUse(): boolean {
        return super.canUse && this.uses.value > 0;
    }

    get greyed(): boolean {
        return this.uses.value < 1;
    }

    get uses(): ValueAndMaybeMax {
        if (this.#uses) {
            return this.#uses;
        }

        const item = this.item;

        const uses =
            item?.uses.max && (item.uses.max > 1 || item.category === "wand")
                ? item.uses
                : undefined;

        return (this.#uses = uses ?? { value: this.quantity });
    }

    get icon(): string {
        return "fa-regular fa-flask-round-potion";
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
            : this.uses.value < 1
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
