import { ConsumablePF2e, CreaturePF2e, ValueAndMaybeMax, z } from "foundry-helpers";
import { ItemShortcut, ShortcutData, zItemShortcut } from "..";

const zConsumableShortcut = zItemShortcut("consumable");

class ConsumableShortcut extends ItemShortcut<typeof zConsumableShortcut, ConsumablePF2e<CreaturePF2e>> {
    #uses!: ValueAndMaybeMax;

    static get schema() {
        return zConsumableShortcut;
    }

    async _initShortcut(): Promise<void> {
        const item = this.item;

        const uses = item?.uses.max && (item.uses.max > 1 || item.category === "wand") ? item.uses : undefined;

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

interface ConsumableShortcut extends ShortcutData<typeof zConsumableShortcut> {
    type: "consumable";
}

type ConsumableShortcutSource = z.input<typeof zConsumableShortcut>;
type ConsumableShortcutData = z.output<typeof zConsumableShortcut>;

export { ConsumableShortcut };
export type { ConsumableShortcutData, ConsumableShortcutSource };
