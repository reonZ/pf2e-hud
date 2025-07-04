import { ConsumablePF2e, CreaturePF2e, localize, R, ValueAndMaybeMax } from "module-helpers";
import {
    generateItemShortcutFields,
    ItemShortcut,
    ItemShortcutSchema,
    ShortcutTooltipData,
} from ".";

class ConsumableShortcut extends ItemShortcut<
    ConsumableShortcutSchema,
    ConsumablePF2e<CreaturePF2e>
> {
    static defineSchema(): ConsumableShortcutSchema {
        return generateItemShortcutFields("consumable");
    }

    get canUse(): boolean {
        return super.canUse && this.counter.value > 0;
    }

    get greyed(): boolean {
        return this.counter.value < 1;
    }

    get uses(): number | undefined {
        const item = this.item;
        return item?.uses.max && (item.uses.max > 1 || item.category === "wand")
            ? item.uses.value
            : undefined;
    }

    _counter(): ValueAndMaybeMax {
        return { value: this.uses ?? this.item?.quantity ?? 0 };
    }

    _tooltipData(): ShortcutTooltipData {
        const data = super._tooltipData();

        if (!data.reason) {
            const uses = this.uses;
            data.reason = R.isNonNullish(uses) && uses < 1 ? "uses" : undefined;
        }

        return data;
    }
}

interface ConsumableShortcut extends ModelPropsFromSchema<ConsumableShortcutSchema> {
    get counter(): ValueAndMaybeMax;
    type: "consumable";
}

type ConsumableShortcutSchema = ItemShortcutSchema;

type ConsumableShortcutData = SourceFromSchema<ConsumableShortcutSchema>;

export { ConsumableShortcut };
export type { ConsumableShortcutData };
