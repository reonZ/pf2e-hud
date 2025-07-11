import { CreaturePF2e, EquipmentPF2e, ValueAndMaybeMax } from "module-helpers";
import { generateItemShortcutFields, ItemShortcut, ItemShortcutSchema, ShortcutSource } from "..";

class EquipmentShortcut extends ItemShortcut<EquipmentShortcutSchema, EquipmentPF2e<CreaturePF2e>> {
    static defineSchema(): EquipmentShortcutSchema {
        return generateItemShortcutFields("equipment");
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

interface EquipmentShortcut extends ModelPropsFromSchema<EquipmentShortcutSchema> {
    type: "equipment";
}

type EquipmentShortcutSchema = ItemShortcutSchema;

type EquipmentShortcutData = ShortcutSource<EquipmentShortcutSchema> & {
    type: "equipment";
};

export { EquipmentShortcut };
export type { EquipmentShortcutData };
