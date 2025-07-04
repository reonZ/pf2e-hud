import { CreaturePF2e, EquipmentPF2e } from "module-helpers";
import { generateItemShortcutFields, ItemShortcut, ItemShortcutSchema } from ".";

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
}

interface EquipmentShortcut extends ModelPropsFromSchema<EquipmentShortcutSchema> {
    type: "equipment";
}

type EquipmentShortcutSchema = ItemShortcutSchema;

type EquipmentShortcutData = SourceFromSchema<EquipmentShortcutSchema>;

export { EquipmentShortcut };
export type { EquipmentShortcutData };
