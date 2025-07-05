import { ShortcutData } from "hud";
import {
    CreaturePF2e,
    EquipAnnotationData,
    equipItemToUse,
    OneToTen,
    SpellCollection,
    SpellPF2e,
    SpellSlotGroupId,
    ValueAndMax,
} from "module-helpers";
import { BaseSidebarItem, CustomSpellcastingEntry } from "..";

class SpellSidebarItem extends BaseSidebarItem<SpellPF2e<CreaturePF2e>, SlotSpellData> {
    get item(): SpellPF2e<CreaturePF2e> {
        return this.spell;
    }

    get collection(): SpellCollection<CreaturePF2e> | undefined {
        return this.spell.actor.spellcasting?.collections.get(this.entryId);
    }

    cast() {
        this.spell.parentItem?.consume() ??
            this.spell.spellcasting?.cast(this.spell, { rank: this.castRank, slotId: this.slotId });
    }

    drawItem() {
        const actor = this.spell.actor;
        const parentItem = actor.inventory.get(this.parentId, { strict: true });

        if (actor.isOfType("character") && this.annotation) {
            equipItemToUse(actor, parentItem, this.annotation);
        }
    }

    toggleSignature() {
        const spell = this.spell;
        spell.update({ "system.location.signature": !spell.system.location.signature });
    }

    toggleSlotExpended() {
        return this.collection?.setSlotExpendedState(this.groupId, this.slotId, !this.expended);
    }

    toShortcut(): ShortcutData | undefined {
        return;
    }
}
interface SpellSidebarItem extends Readonly<SlotSpellData> {}

type SlotSpellData = Omit<
    CustomSpellcastingEntry,
    "category" | "groups" | "id" | "statistic" | "uses"
> & {
    annotation: (EquipAnnotationData & { dataset: string }) | undefined;
    canTogglePrepared: boolean | undefined;
    castRank: OneToTen;
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
    spell: SpellPF2e<CreaturePF2e>;
    uses: (ValueAndMax & { input: string; itemId: string; hasMaxUses: boolean }) | undefined;
};

export { SpellSidebarItem };
export type { SlotSpellData };
