import { ConsumablePF2e, CreaturePF2e, ValueAndMaybeMax } from "module-helpers";
import { generateItemShortcutFields, ItemShortcut, ItemShortcutSchema, ShortcutSource } from "..";

class ConsumableShortcut extends ItemShortcut<
    ConsumableShortcutSchema,
    ConsumablePF2e<CreaturePF2e>
> {
    #uses!: ValueAndMaybeMax;

    static defineSchema(): ConsumableShortcutSchema {
        return generateItemShortcutFields("consumable");
    }

    async _initShortcut(): Promise<void> {
        const item = this.item;

        const uses =
            item?.uses.max && (item.uses.max > 1 || item.category === "wand")
                ? item.uses
                : undefined;

        this.#uses = (this.quantity > 0 && uses) || { value: this.quantity };
    }

    get canUse(): boolean {
        return super.canUse && this.uses.value > 0;
    }

    get greyed(): boolean {
        return this.uses.value < 1;
    }

    get uses(): ValueAndMaybeMax {
        return this.#uses;
    }

    get icon(): string {
        return "fa-regular fa-flask-round-potion";
    }

    get unusableReason(): string | undefined {
        return super.unusableReason ?? (this.uses.value < 1 ? "uses" : undefined);
    }
}

interface ConsumableShortcut extends ModelPropsFromSchema<ConsumableShortcutSchema> {
    type: "consumable";
}

type ConsumableShortcutSchema = ItemShortcutSchema;

type ConsumableShortcutData = ShortcutSource<ConsumableShortcutSchema> & {
    type: "consumable";
};

export { ConsumableShortcut };
export type { ConsumableShortcutData };
