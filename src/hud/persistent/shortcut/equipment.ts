import { CreaturePF2e, EquipmentPF2e } from "module-helpers";
import { generateItemShortcutFields, ItemShortcut, ItemShortcutSchema } from ".";

class EquipmentShortcut extends ItemShortcut<EquipmentShortcutSchema, EquipmentPF2e<CreaturePF2e>> {
    static defineSchema(): EquipmentShortcutSchema {
        return generateItemShortcutFields("equipment");
    }
}

interface EquipmentShortcut extends ModelPropsFromSchema<EquipmentShortcutSchema> {}

type EquipmentShortcutSchema = ItemShortcutSchema;

type EquipmentShortcutData = SourceFromSchema<EquipmentShortcutSchema>;

export { EquipmentShortcut };
export type { EquipmentShortcutData };
