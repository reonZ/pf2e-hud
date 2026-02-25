import { getItemSlug, SpellShortcutData } from "hud";
import { BaseSidebarItem, CustomSpellcastingEntry, SpellCategoryType } from "..";
import {
    CreaturePF2e,
    EquipAnnotationData,
    equipItemToUse,
    OneToTen,
    SpellCollection,
    SpellPF2e,
    SpellSlotGroupId,
    ValueAndMax,
} from "foundry-helpers";

class SpellSidebarItem extends BaseSidebarItem<SpellPF2e<CreaturePF2e>, SlotSpellData> {
    #collection?: SpellCollection<CreaturePF2e> | null;

    get item(): SpellPF2e<CreaturePF2e> {
        return this.spell;
    }

    get actor(): CreaturePF2e {
        return this.spell.actor;
    }

    get collection(): SpellCollection<CreaturePF2e> | null {
        if (this.#collection !== undefined) {
            return this.#collection;
        }

        return (this.#collection = this.actor.spellcasting?.collections.get(this.entryId) ?? null);
    }

    cast() {
        this.spell.parentItem?.consume() ??
            this.spell.spellcasting?.cast(this.spell, { rank: this.castRank, slotId: this.slotId });
    }

    drawItem() {
        const actor = this.actor;
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

    toShortcut(): SpellShortcutData {
        return {
            category: this.categoryType,
            castRank: this.castRank,
            entryId: this.entryId,
            groupId: this.groupId === "cantrips" ? 0 : this.groupId,
            img: this.img,
            isAnimist: !!this.isAnimist || this.isVessel,
            itemId: this.item.id,
            name: this.label,
            slotId: this.slotId,
            slug: getItemSlug(this.item),
            type: "spell",
        };
    }
}

interface SpellSidebarItem extends Readonly<SlotSpellData> {}

type SlotSpellData = Omit<CustomSpellcastingEntry, "category" | "groups" | "id" | "statistic" | "uses"> & {
    annotation: (EquipAnnotationData & { dataset: string }) | undefined;
    canTogglePrepared: boolean | undefined;
    castRank: OneToTen;
    category: { icon: string; label: string };
    categoryType: SpellCategoryType;
    disabled: boolean;
    entryId: string;
    entryTooltip: string;
    expended: boolean | undefined;
    groupId: SpellSlotGroupId;
    isBroken: boolean;
    isVessel: boolean;
    isVirtual: boolean | undefined;
    parentId: string | undefined;
    signature: { toggled: boolean | undefined } | undefined;
    slotId: number;
    spell: SpellPF2e<CreaturePF2e>;
    untrainedVessel: string | undefined;
    uses: (ValueAndMax & { input: string; itemId: string; hasMaxUses: boolean }) | undefined;
};

export { SpellSidebarItem };
export type { SlotSpellData };
