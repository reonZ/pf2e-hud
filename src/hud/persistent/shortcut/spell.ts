import { CustomSpellcastingEntry, isAnimistEntry, SPELL_CATEGORIES, SpellCategoryType } from "hud";
import {
    BaseSpellcastingEntry,
    CharacterPF2e,
    ConsumablePF2e,
    CreaturePF2e,
    IdField,
    localize,
    OneToTen,
    R,
    SpellCollection,
    SpellPF2e,
    ValueAndMax,
    ValueAndMaybeMax,
    ZeroToTen,
} from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    getItemSlug,
    PersistentShortcut,
    ROMAN_RANKS,
    RomanRank,
    ShortcutCache,
    ShortcutCost,
    ShortcutLabel,
    ShortcutSource,
} from "..";
import fields = foundry.data.fields;

class SpellcastingEntryIdField<
    TRequired extends boolean = true,
    TNullable extends boolean = true,
    THasInitial extends boolean = true
> extends fields.DocumentIdField<string, TRequired, TNullable, THasInitial> {
    protected _validateType(value: string) {
        const id = value.endsWith("-casting") ? value.slice(0, -8) : value;
        super._validateType(id);
    }
}

class SpellShortcut extends PersistentShortcut<SpellShortcutSchema, SpellPF2e<CreaturePF2e>> {
    #disabled: [boolean, reason: string | undefined] = [false, undefined];
    #entryData?: SpellEntryData | null;
    #uses?: ValueAndMaybeMax;

    static defineSchema(): SpellShortcutSchema {
        return {
            ...generateBaseShortcutFields("spell"),
            castRank: new fields.NumberField({
                required: true,
                nullable: false,
                min: 1,
                max: 10,
            }),
            category: new fields.StringField({
                required: true,
                nullable: false,
            }),
            entryId: new SpellcastingEntryIdField({
                required: true,
                nullable: false,
            }),
            groupId: new fields.NumberField({
                required: true,
                nullable: false,
                min: 0,
                max: 10,
            }),
            isAnimist: new fields.BooleanField({
                required: false,
                nullable: false,
                initial: false,
            }),
            itemId: new IdField({
                required: true,
                nullable: false,
            }),
            slotId: new fields.NumberField({
                required: true,
                nullable: false,
                min: 0,
            }),
            slug: new fields.StringField({
                required: true,
                nullable: false,
            }),
        };
    }

    static async getItem(
        actor: CreaturePF2e,
        data: SpellShortcutData,
        cached: ShortcutCache
    ): Promise<Maybe<SpellPF2e<CreaturePF2e>>> {
        const collection = actor.spellcasting.collections.get(data.entryId);
        const exact = collection?.get(data.itemId);
        if (exact) return exact;

        // we recover similar consumable spell
        if (R.isIncludedIn(data.category, ["scroll", "wand"])) {
            const slug = `${data.slug}-rank-${data.castRank}`;
            const embeddedSpell = actor.itemTypes.consumable.find(
                (item) => getItemSlug(item) === slug
            )?.embeddedSpell;

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

        const entryData = await this.cached("shortcutSpellData", entryId, () => {
            return this.#getEntryData.call(this);
        });

        this.#entryData = entryData;

        if (!spell || !entryData || entryData.notPrimaryVessel) {
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
        const group = entryData.groups.find((x) => x.id === groupId);

        const groupUses =
            typeof group?.uses?.value === "number" ? (group.uses as ValueAndMax) : undefined;

        const uses =
            isCantrip || entryData.isConsumable || (entryData.isPrepared && !entryData.isFlexible)
                ? undefined
                : entryData.isFocus
                ? (actor as CreaturePF2e).system.resources?.focus
                : entryData.isCharges && !isBroken
                ? entryData.uses
                : entryData.isInnate && !spell.atWill
                ? spell.system.location.uses
                : groupUses;

        this.#uses =
            entryData.consumable && entryData.consumable.quantity > 1
                ? { value: entryData.consumable.quantity }
                : uses;

        if (isCantrip) {
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
                () => !!game.dailies?.api.canCastRank(this.actor as CharacterPF2e, this.castRank)
            );

            return returnDisabled(!canCast, "charges");
        }

        if (uses && entryData.isCharges) {
            return returnDisabled(uses.value < castRank, "charges");
        } else if (uses) {
            return returnDisabled(uses.value === 0, entryData.isFocus ? "focus" : "uses");
        }

        const active = entryData.isConsumable
            ? group?.active[0]
            : slotId != null
            ? group?.active[slotId]
            : undefined;

        // no longer prepared
        if (!active) {
            return returnDisabled(true, "prepared");
        }

        returnDisabled(!!active?.expended, "expended");
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
        return R.isNonNullish(value) ? { value, combo: isNaN(Number(value)) } : null;
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
        return this.spellcastinEntry?.name ?? localize("shortcuts.tooltip.subtitle", this.type);
    }

    use(event: MouseEvent): void {
        const item = this.item;
        if (!item?.isOfType("spell")) return;

        if (item.parentItem) {
            item.parentItem.consume();
        } else if (this.castRank.between(1, 10)) {
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
            return entry.getSheetData({
                spells: collection,
            }) as Promise<CustomSpellcastingEntry>;
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
            notPrimaryVessel:
                vessels?.entry.id === entryId && !vessels.primary.includes(this.itemId),
            uses: entrySheetData.uses,
        };

        return data;
    }
}

function getAnimistVesselsData(
    cached: ShortcutCache,
    actor: CreaturePF2e
): dailies.AnimistVesselsData | null {
    return cached("animistVesselsData", () => {
        if (!actor.isOfType("character") || !game.dailies?.active) return null;
        return game.dailies.api.getAnimistVesselsData(actor) ?? null;
    });
}

interface SpellShortcut extends ModelPropsFromSchema<SpellShortcutSchema> {}

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
    notPrimaryVessel: boolean;
    uses: ValueAndMax | undefined;
};

type SpellShortcutSchema = BaseShortcutSchema & {
    castRank: fields.NumberField<OneToTen, OneToTen, true, false, false>;
    category: fields.StringField<SpellCategoryType, SpellCategoryType, true, false, false>;
    entryId: SpellcastingEntryIdField<true, false, false>;
    groupId: fields.NumberField<ZeroToTen, ZeroToTen, true, false, false>;
    isAnimist: fields.BooleanField<boolean, boolean, false, false, true>;
    itemId: IdField<true, false, false>;
    slotId: fields.NumberField<number, number, true, false, false>;
    slug: fields.StringField<string, string, true, false, false>;
};

type SpellShortcutData = ShortcutSource<SpellShortcutSchema> & {
    type: "spell";
};

export { SpellShortcut };
export type { SpellEntryData, SpellShortcutData };
