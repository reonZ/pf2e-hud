import { CreaturePF2e, EquipmentPF2e, ValueAndMaybeMax, z } from "foundry-helpers";
import { ItemShortcut, ShortcutData, zItemShortcut } from "..";

const zEquipmentShortcut = zItemShortcut("equipment");

class EquipmentShortcut extends ItemShortcut<typeof zEquipmentShortcut, EquipmentPF2e<CreaturePF2e>> {
    static get schema() {
        return zEquipmentShortcut;
    }

    get canUse(): boolean {
        return super.canUse && (this.item?.quantity ?? 0) > 0;
    }

    get greyed(): boolean {
        return (this.item?.quantity ?? 0) < 1;
    }

    get icon(): string {
        return "fa-solid fa-wrench";
    }

    get uses(): ValueAndMaybeMax | null {
        return this.item && this.item.quantity > 1 ? { value: this.item.quantity } : null;
    }
}

interface EquipmentShortcut extends ShortcutData<typeof zEquipmentShortcut> {
    type: "equipment";
}

type EquipmentShortcutSource = z.input<typeof zEquipmentShortcut>;
type EquipmentShortcutData = z.output<typeof zEquipmentShortcut>;

export { EquipmentShortcut };
export type { EquipmentShortcutData, EquipmentShortcutSource };
