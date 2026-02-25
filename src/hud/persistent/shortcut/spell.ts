import {
    BaseSpellcastingEntry,
    CharacterPF2e,
    ConsumablePF2e,
    CreaturePF2e,
    localize,
    OneToTen,
    R,
    SpellCollection,
    SpellPF2e,
    ValueAndMax,
    ValueAndMaybeMax,
    z,
    zDocumentId,
    zSpellcastingEntryId,
} from "foundry-helpers";
import { CustomSpellcastingEntry, isAnimistEntry, isFocusCantrip, SPELL_CATEGORIES, SPELL_CATEGORY_TYPES } from "hud";
import {
    getItemSlug,
    PersistentShortcut,
    ROMAN_RANKS,
    RomanRank,
    ShortcutCache,
    ShortcutCost,
    ShortcutData,
    ShortcutLabel,
    zBaseShortcut,
} from "..";

const zSpellShortcut = zBaseShortcut("spell").extend({
    castRank: z.number().min(1).max(10).multipleOf(1),
    category: z.enum(SPELL_CATEGORY_TYPES),
    entryId: zSpellcastingEntryId(),
    groupId: z.number().min(0).max(10).multipleOf(1),
    isAnimist: z.boolean().default(false),
    itemId: zDocumentId(true),
    slotId: z.number().min(0).multipleOf(1),
    slug: z.string().nonempty(),
});

class SpellShortcut extends PersistentShortcut<typeof zSpellShortcut, SpellPF2e<CreaturePF2e>> {
    #disabled: [boolean, reason: string | undefined] = [false, undefined];
    #entryData?: SpellEntryData | null;
    #group?: SpellcastingEntryGroup;
    #uses?: ValueAndMaybeMax;

    static get schema() {
        return zSpellShortcut;
    }

    static async getItem(
        actor: CreaturePF2e,
        data: SpellShortcutData,
        cached: ShortcutCache,
    ): Promise<Maybe<SpellPF2e<CreaturePF2e>>> {
        const collection = actor.spellcasting.collections.get(data.entryId);
        const exact = collection?.get(data.itemId);
        if (exact) return exact;

        // we recover similar consumable spell
        if (R.isIncludedIn(data.category, ["scroll", "wand"])) {
            const slug = `${data.slug}-rank-${data.castRank}`;
            const embeddedSpell = actor.itemTypes.consumable.find((item) => getItemSlug(item) === slug)?.embeddedSpell;

            const embbededEntryId = embeddedSpell?.system.location.value;
            if (!embbededEntryId) return;

            const collection = actor.spellcasting.collections.get(embbededEntryId);
            if (!collection) return;

            data.entryId = embbededEntryId;
            data.itemId = embeddedSpell.id;

            return embeddedSpell;
        }

        // we recover similar staff spell
        if (collection && data.category === "staff") {
            const spellFilter: (spell: SpellPF2e) => boolean =
                data.groupId === 0
                    ? (spell) => spell.slug === data.slug && spell.isCantrip
                    : (spell) => spell.slug === data.slug && spell.rank === data.groupId;

            const spell = collection.find(spellFilter);
            if (!spell) return;

            data.itemId = spell.id;

            return spell;
        }

        // we recover similar animist spell
        if (data.isAnimist && R.isIncludedIn(data.category, ["focus", "spontaneous"])) {
            const collection: Maybe<SpellCollection<CreaturePF2e>> =
                data.category === "focus"
                    ? getAnimistVesselsData(cached, actor)?.entry.spells
                    : cached("animistCollection", () => {
                          const entry = actor.spellcasting.collections.find(({ entry }) => {
                              return isAnimistEntry(entry);
                          });
                          return entry ?? null;
                      });

            if (!collection) return;

            const spell = collection.find((spell) => {
                return spell.slug === data.slug;
            });
            if (!spell) return;

            data.entryId = collection.id;
            data.itemId = spell.id;

            return spell;
        }
    }

    async _initShortcut(): Promise<void> {
        const returnDisabled = (disabled: boolean, reason: string) => {
            this.#disabled = [disabled, disabled ? reason : undefined];
            return;
        };

        const spell = this.item;
        const actor = this.actor;
        const entryId = this.entryId;

        const entryData = (this.#entryData = await this.cached("shortcutSpellData", entryId, () => {
            return this.#getEntryData.call(this);
        }));

        if (!spell || !entryData || entryData.notPrimaryVessel(this.itemId)) {
            return returnDisabled(true, !spell || !entryData ? "match" : "vessel");
        }

        const isCantrip = spell.isCantrip;
        const isBroken = !isCantrip && entryData.isCharges && !game.dailies?.active;

        if (isBroken) {
            return returnDisabled(true, "broken");
        }

        const slotId = this.slotId;
        const groupId = this.groupId || "cantrip";
        const castRank = this.castRank;
        const group = (this.#group = entryData.groups.find((x) => x.id === groupId));

        const groupUses = typeof group?.uses?.value === "number" ? (group.uses as ValueAndMax) : undefined;

        const uses =
            entryData.isFocus && (!isCantrip || isFocusCantrip(spell))
                ? (actor as CreaturePF2e).system.resources?.focus
                : isCantrip || entryData.isConsumable || (entryData.isPrepared && !entryData.isFlexible)
                  ? undefined
                  : entryData.isCharges && !isBroken
                    ? entryData.uses
                    : entryData.isInnate && !spell.atWill
                      ? spell.system.location.uses
                      : groupUses;

        this.#uses =
            entryData.consumable && entryData.consumable.quantity > 1 ? { value: entryData.consumable.quantity } : uses;

        if (isCantrip && (!uses || spell.system.cast.focusPoints <= 0)) {
            return returnDisabled(false, "");
        }

        // no longer a signature spell
        if (entryData.isSpontaneous && castRank > spell.rank && !spell.system.location.signature) {
            return returnDisabled(true, "rank");
        }

        // no longer prepared
        if (entryData.isFlexible && !spell.system.location.signature) {
            return returnDisabled(true, "prepared");
        }

        if (entryData.isStaff) {
            const canCast = this.cached(
                "canCastStaffRank",
                this.castRank,
                () => !!game.dailies?.api.canCastRank(this.actor as CharacterPF2e, this.castRank),
            );

            return returnDisabled(!canCast, "charges");
        }

        if (uses && entryData.isCharges) {
            return returnDisabled(uses.value < castRank, "charges");
        } else if (uses) {
            return returnDisabled(uses.value === 0, entryData.isFocus ? "focus" : "uses");
        }

        const actives = entryData.isConsumable
            ? [group?.active[0]].filter(R.isTruthy)
            : slotId != null
              ? group?.active.filter((x) => x?.spell.id === spell.id)
              : undefined;

        // no longer prepared
        if (!actives?.length) {
            return returnDisabled(true, "prepared");
        }

        if (!isCantrip) {
            // we count all identical prepared slots as "charges"
            this.#uses = {
                value: actives.filter((x) => x && !x.expended).length,
                max: actives.length,
            };
        }

        returnDisabled(this.#uses?.value === 0, "expended");
    }

    get canUse(): boolean {
        return !this.#disabled[0];
    }

    get unusableReason(): string | undefined {
        return this.#disabled[1];
    }

    get spellcastinEntry(): BaseSpellcastingEntry<CreaturePF2e> | undefined {
        return this.#entryData?.collection.entry;
    }

    get icon(): string {
        return SPELL_CATEGORIES[this.category]?.icon ?? "";
    }

    get cost(): ShortcutCost | null {
        const value = this.item?.system.time.value;
        return R.isNonNullish(value) ? { value, combo: isNaN(Number(value)) && value !== "reaction" } : null;
    }

    get isCantrip(): boolean {
        return this.groupId === 0;
    }

    get uses(): ValueAndMaybeMax | null {
        return this.#uses ?? null;
    }

    get romanRank(): RomanRank {
        return ROMAN_RANKS[this.castRank];
    }

    get label(): ShortcutLabel {
        return { value: this.romanRank, class: "rank" };
    }

    get title(): string {
        return `${this.romanRank} - ${this.item?.name ?? this.name}`;
    }

    get subtitle(): string {
        const entry = this.spellcastinEntry;

        if (!entry) {
            return localize("shortcuts.tooltip.subtitle", this.type);
        }

        const entryDc = entry.statistic?.dc.value;
        const dcLabel = entryDc && game.i18n.format("PF2E.DCWithValue", { dc: entryDc, text: "" });

        return dcLabel ? `${dcLabel} - ${entry.name}` : entry.name;
    }

    use() {
        const item = this.item;
        if (!item?.isOfType("spell")) return;

        if (item.parentItem) {
            return item.parentItem.consume();
        }

        if (!this.castRank.between(1, 10)) return;

        // for prepared, we look for any slot that isn't expended if the exact one is
        if (this.category === "prepared" && !this.isCantrip) {
            const slotId = this.#group?.active.findIndex((x) => x?.spell.id === this.itemId && !x.expended);

            if (R.isNumber(slotId)) {
                this.spellcastinEntry?.cast(item, { rank: this.castRank, slotId });
            }
        } else {
            this.spellcastinEntry?.cast(item, { rank: this.castRank, slotId: this.slotId });
        }
    }

    async #getEntryData(this: SpellShortcut): Promise<SpellEntryData | null> {
        const actor = this.actor;
        const entryId = this.entryId;
        const collection = actor.spellcasting.collections.get(entryId);
        if (!collection) return null;

        const entry = collection.entry;
        const entrySheetData = await this.cached("spellcastingEntry", entryId, () => {
            return entry.getSheetData({ spells: collection }) as unknown as Promise<CustomSpellcastingEntry>;
        });

        const vessels = getAnimistVesselsData(this.cached, actor);
        const isConsumable = entrySheetData.category === "items";
        const isFlexible = !!entrySheetData.isFlexible;
        const isStaff = !!entrySheetData.isStaff;

        const consumable =
            isConsumable && this.category === "scroll"
                ? actor.items.get<ConsumablePF2e<CreaturePF2e>>(entryId.split("-")[0])
                : undefined;

        const data: SpellEntryData = {
            collection,
            consumable,
            groups: entrySheetData.groups,
            isCharges: entrySheetData.category === "charges",
            isConsumable,
            isFlexible,
            isFocus: !!entrySheetData.isFocusPool,
            isInnate: !!entrySheetData.isInnate,
            isPrepared: !!entrySheetData.isPrepared,
            isSpontaneous: !!entrySheetData.isSpontaneous,
            isStaff,
            notPrimaryVessel: (spellId: string) => vessels?.entry.id === entryId && !vessels.primary.includes(spellId),
            uses: entrySheetData.uses,
        };

        return data;
    }
}

function getAnimistVesselsData(cached: ShortcutCache, actor: CreaturePF2e): dailies.AnimistVesselsData | null {
    return cached("animistVesselsData", () => {
        if (!actor.isOfType("character") || !game.dailies?.active) return null;
        return game.dailies.api.getAnimistVesselsData(actor) ?? null;
    });
}

interface SpellShortcut extends ShortcutData<typeof zSpellShortcut> {
    get castRank(): OneToTen;
    type: "spell";
}

type SpellShortcutSource = z.input<typeof zSpellShortcut>;
type SpellShortcutData = z.output<typeof zSpellShortcut>;

type SpellEntryData = {
    collection: SpellCollection<CreaturePF2e>;
    consumable: ConsumablePF2e<CreaturePF2e> | undefined;
    isCharges: boolean;
    isConsumable: boolean;
    isFlexible: boolean;
    isFocus: boolean;
    isInnate: boolean;
    isPrepared: boolean;
    isSpontaneous: boolean;
    isStaff: boolean;
    groups: CustomSpellcastingEntry["groups"];
    notPrimaryVessel: (spellId: string) => boolean;
    uses: ValueAndMax | undefined;
};

type SpellcastingEntryGroup = CustomSpellcastingEntry["groups"][number];

export { SpellShortcut };
export type { SpellEntryData, SpellShortcutData, SpellShortcutSource };
