import { EquipAnnotationData, SpellPF2e, SpellSlotGroupId, ValueAndMax } from "module-helpers";
import { BaseSidebarItem, CustomSpellcastingEntry } from "..";

class SpellSidebarItem extends BaseSidebarItem<SpellPF2e, SlotSpellData> {
    get item(): SpellPF2e {
        return this.spell;
    }
}
interface SpellSidebarItem extends BaseSidebarItem<SpellPF2e, SlotSpellData>, SlotSpellData {}

type SlotSpellData = Omit<
    CustomSpellcastingEntry,
    "category" | "groups" | "id" | "statistic" | "uses"
> & {
    annotation: (EquipAnnotationData & { dataset: string }) | undefined;
    canTogglePrepared: boolean | undefined;
    castRank: number;
    category: { icon: string; label: string };
    categoryType: string;
    entryId: string;
    entryTooltip: string;
    expended: boolean | undefined;
    groupId: SpellSlotGroupId;
    isBroken: boolean;
    isVirtual: boolean | undefined;
    parentId: string | undefined;
    signature: { toggled: boolean | undefined } | undefined;
    slotId: number;
    spell: SpellPF2e;
    uses: (ValueAndMax & { input: string; itemId: string; hasMaxUses: boolean }) | undefined;
};

export { SpellSidebarItem };
