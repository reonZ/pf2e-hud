import { createSlider, processSliderEvent, SliderData } from "hud";
import {
    ActiveSpell,
    addListenerAll,
    ApplicationRenderOptions,
    ConsumablePF2e,
    CreaturePF2e,
    datasetToData,
    dataToDatasetString,
    EquipAnnotationData,
    equipItemToUse,
    ErrorPF2e,
    getEquipAnnotation,
    htmlClosest,
    localeCompare,
    OneToTen,
    R,
    SpellcastingCategory,
    SpellcastingSheetData,
    SpellcastingSlotGroup,
    SpellPF2e,
    SpellSlotGroupId,
    spellSlotGroupIdToNumber,
    ValueAndMax,
} from "module-helpers";
import { SidebarFilter, SidebarPF2eHUD, SPELL_CATEGORIES, SpellCategoryType } from ".";

class SpellsSidebarPF2eHUD extends SidebarPF2eHUD {
    get name(): "spells" {
        return "spells";
    }

    protected async _prepareContext(options: ApplicationRenderOptions): Promise<SpellsHudContext> {
        return getSpellcastingData(this.actor);
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        const action = target.dataset.action as EventAction;

        if (action === "cast-spell") {
            this.#castSpell(target);
        } else if (action === "draw-item") {
            this.#drawItem(target);
        } else if (action === "slider") {
            processSliderEvent(event, target, this.#onSlider.bind(this));
        } else if (action === "toggle-signature") {
            this.#toggleSignature(target);
        } else if (action === "toggle-slot-expended") {
            this.#toggleSlotExpended(target);
        }
    }

    protected _activateListeners(html: HTMLElement): void {
        const actor = this.actor;

        if (actor.isOfType("character") && game.dailies?.active) {
            addListenerAll(
                html,
                "[data-action='update-staff-charges']",
                "change",
                (el: HTMLInputElement) => {
                    game.dailies?.api.setStaffChargesValue(actor, el.valueAsNumber);
                }
            );
        }
    }

    #drawItem(target: HTMLElement) {
        const actor = this.actor;
        const data = datasetToData<EquipAnnotationData & { parentId: string }>(target.dataset);
        const item = actor.inventory.get(data.parentId, { strict: true });

        if (item && actor.isOfType("character")) {
            equipItemToUse(actor, item, data);
        }
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/92f410ea3863aa46fe9594ca73874c5f7d565bf3/src/module/actor/creature/sheet.ts#L220
     */
    #toggleSignature(target: HTMLElement) {
        const itemId = htmlClosest(target, "[data-item-id]")?.dataset.itemId;
        const spell = this.actor.items.get(itemId, { strict: true });
        if (!spell?.isOfType("spell")) return;
        return spell.update({ "system.location.signature": !spell.system.location.signature });
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/92f410ea3863aa46fe9594ca73874c5f7d565bf3/src/module/actor/creature/sheet.ts#L172
     */
    #castSpell(target: HTMLElement) {
        const spellRow = htmlClosest(target, "[data-item-id]");
        const { itemId, entryId, slotId } = spellRow?.dataset ?? {};
        const collection = this.actor.spellcasting.collections.get(entryId, { strict: true });
        const spell = collection.get(itemId, { strict: true });
        const maybeCastRank = Number(spellRow?.dataset.castRank) || NaN;

        if (Number.isInteger(maybeCastRank) && maybeCastRank.between(1, 10)) {
            const rank = maybeCastRank as OneToTen;
            return (
                spell.parentItem?.consume() ??
                collection.entry.cast(spell, { rank, slotId: Number(slotId) })
            );
        }
    }

    /**
     * https://github.com/foundryvtt/pf2e/blob/92f410ea3863aa46fe9594ca73874c5f7d565bf3/src/module/actor/creature/sheet.ts#L207
     */
    #toggleSlotExpended(target: HTMLElement) {
        const row = htmlClosest(target, "[data-item-id]");
        const groupId = coerceToSpellGroupId(row?.dataset.groupId);
        if (!groupId) throw ErrorPF2e("Unexpected error toggling expended state");

        const slotId = Number(row?.dataset.slotId) || 0;
        const entryId = row?.dataset.entryId ?? "";
        const expend = row?.dataset.slotExpended === undefined;
        const collection = this.actor.spellcasting.collections.get(entryId);

        return collection?.setSlotExpendedState(groupId, slotId, expend);
    }

    #onSlider(action: "focus", direction: 1 | -1) {
        if (action === "focus") {
            const actor = this.actor;
            if (!actor.isOfType("character", "npc")) return;

            const focusPoints = actor.system.resources.focus;
            const newValue = Math.clamp(focusPoints.value + direction, 0, focusPoints.max);

            if (newValue !== focusPoints.value) {
                actor.update({ "system.resources.focus.value": newValue });
            }
        }
    }
}

/**
 * https://github.com/foundryvtt/pf2e/blob/92f410ea3863aa46fe9594ca73874c5f7d565bf3/src/module/item/spellcasting-entry/helpers.ts#L36
 */
function coerceToSpellGroupId(value: unknown): SpellSlotGroupId | null {
    if (value === "cantrips") return value;
    const numericValue = Number(value) || NaN;
    return numericValue.between(1, 10) ? (numericValue as OneToTen) : null;
}

async function getSpellcastingData(actor: CreaturePF2e): Promise<SpellsHudContext> {
    const spellcastingEntries = actor.spellcasting.collections.map(async (spells) => {
        const entry = spells.entry;
        const data = (await entry.getSheetData({ spells })) as CustomSpellcastingEntry;

        const id = foundry.utils.getProperty(entry, "flags.pf2e-dailies.identifier");
        data.isAnimist = id === "animist-spontaneous";

        return data;
    });

    const spellGroups: SpellGroupData[] = [];
    const dailiesActive = !!game.dailies?.active;
    const canUseCharges = dailiesActive;
    const focusPool = createSlider("focus", actor.system.resources?.focus ?? { value: 0, max: 0 });

    const vesselsData = (dailiesActive && game.dailies?.api.getAnimistVesselsData(actor)) || {
        entry: undefined,
        primary: [] as string[],
    };

    for (const entry of await Promise.all(spellcastingEntries)) {
        if (!entry.groups.length) continue;

        const entryId = entry.id;
        const entryData = R.omit(entry, ["groups", "id", "statistic"]);
        const isCharges = entry.category === "charges";
        const isVessels = entry.id === vesselsData.entry?.id;

        const item = entry.isEphemeral
            ? actor.items.get<ConsumablePF2e<CreaturePF2e>>(entry.id.split("-")[0])
            : undefined;

        const [categoryType, consumable] =
            entry.category === "items" && item
                ? [item.category, item]
                : [
                      entry.isFlexible ? "flexible" : entry.isStaff ? "staff" : entry.category,
                      undefined,
                  ];

        const category = SPELL_CATEGORIES[categoryType as SpellCategoryType];

        const entryDc = entry.statistic?.dc.value;
        const entryDcLabel = entryDc
            ? game.i18n.format("PF2E.DCWithValue", { dc: entryDc, text: "" })
            : "";
        const entryLabel = game.i18n.localize(category.label);
        const entryTooltip = entryDcLabel
            ? `${entryLabel} - ${entryDcLabel}<br>${entry.name}`
            : `${entryLabel}<br>${entry.name}`;

        const annotationData = entry.isStaff || consumable ? getEquipAnnotation(item) : undefined;
        const annotation = annotationData
            ? {
                  ...annotationData,
                  dataset: dataToDatasetString(
                      R.pick(annotationData, ["carryType", "cost", "fullAnnotation", "handsHeld"])
                  ),
              }
            : undefined;

        for (const group of entry.groups) {
            if (!group.active.length || group.uses?.max === 0) continue;

            const slotSpells: SlotSpellData[] = [];
            const groupNumber = spellSlotGroupIdToNumber(group.id);
            const isCantrip = group.id === "cantrips";
            const isBroken = !isCantrip && isCharges && !canUseCharges;
            const focusExpended = !isCantrip && focusPool.value <= 0;
            const groupUses = R.isNumber(group.uses?.value)
                ? (group.uses as ValueAndMax)
                : undefined;

            const getUses = (active: CustomGroupActive): SlotSpellData["uses"] | undefined => {
                if (
                    isCantrip ||
                    entry.isFocusPool ||
                    consumable ||
                    (entry.isPrepared && !entry.isFlexible)
                )
                    return;

                const uses = isCharges && !isBroken ? entry.uses : active.uses ?? groupUses;
                if (!uses) return;

                const input = entry.isStaff
                    ? ""
                    : isCharges
                    ? "system.slots.slot1.value"
                    : entry.isInnate
                    ? "system.location.uses.value"
                    : `system.slots.slot${groupNumber}.value`;

                return {
                    ...uses,
                    hasMaxUses: !!uses.max && !entry.isStaff,
                    input,
                    itemId: entry.isStaff ? "" : entry.isInnate ? active.spell.id : entry.id,
                };
            };

            for (let slotId = 0; slotId < group.active.length; slotId++) {
                const active = group.active[slotId];
                if (!active?.spell || active.uses?.max === 0) continue;

                const spell = active.spell;
                if (isVessels && !vesselsData.primary.includes(spell.id)) continue;

                const isVirtual = entry.isSpontaneous && !isCantrip && active.virtual;
                const signature =
                    entry.isAnimist && !isCantrip && !isVirtual
                        ? { toggled: active.signature }
                        : undefined;

                slotSpells.push({
                    ...entryData,
                    annotation,
                    canTogglePrepared: entry.isPrepared && !isCantrip,
                    castRank: active.castRank ?? spell.rank,
                    category,
                    categoryType,
                    entryId,
                    entryTooltip,
                    expended: entry.isFocusPool ? focusExpended : active.expended,
                    filterValue: new SidebarFilter(spell),
                    groupId: group.id,
                    isBroken,
                    isVirtual,
                    parentId: item?.id,
                    signature,
                    slotId,
                    spell,
                    uses: getUses(active),
                });
            }

            if (slotSpells.length) {
                const isFocusGroup = entry.isFocusPool && !isCantrip;
                const groupRank = isFocusGroup ? 12 : entry.isRitual ? 13 : groupNumber;

                const spellsGroup = (spellGroups[groupRank] ??= {
                    filterValue: new SidebarFilter(),
                    focusPool: entry.isFocusPool ? focusPool : null,
                    label: isFocusGroup
                        ? "PF2E.Focus.Spells"
                        : entry.isRitual
                        ? "PF2E.Actor.Character.Spellcasting.Tab.Rituals"
                        : group.label,
                    slotSpells: [],
                });

                spellsGroup.filterValue.add(...slotSpells.map((x) => x.spell));
                spellsGroup.slotSpells.push(...slotSpells);
            }
        }
    }

    for (let i = 0; i < spellGroups.length; i++) {
        const group = spellGroups[i];

        if (group && i <= 11) {
            group.slotSpells.sort((a: SlotSpellData, b: SlotSpellData) => {
                return localeCompare(a.name, b.name);
            });
        }
    }

    return {
        spellGroups,
    };
}

interface SpellsSidebarPF2eHUD {
    get actor(): CreaturePF2e;
}

type EventAction =
    | "cast-spell"
    | "draw-item"
    | "slider"
    | "toggle-signature"
    | "toggle-slot-expended";

type SpellGroupData = {
    label: string;
    focusPool: SliderData | null;
    filterValue: SidebarFilter;
    slotSpells: SlotSpellData[];
};

type SlotSpellData = Omit<
    CustomSpellcastingEntry,
    "statistic" | "groups" | "uses" | "id" | "category"
> & {
    annotation: (EquipAnnotationData & { dataset: string }) | undefined;
    canTogglePrepared: boolean | undefined;
    castRank: number;
    category: { icon: string; label: string };
    categoryType: string;
    entryId: string;
    entryTooltip: string;
    expended: boolean | undefined;
    filterValue: SidebarFilter;
    groupId: SpellSlotGroupId;
    isBroken: boolean;
    isVirtual: boolean | undefined;
    parentId: string | undefined;
    signature: { toggled: boolean | undefined } | undefined;
    slotId: number;
    spell: SpellPF2e;
    uses: (ValueAndMax & { input: string; itemId: string; hasMaxUses: boolean }) | undefined;
};

type CustomSpellcastingEntry = Omit<SpellcastingSheetData, "category" | "groups"> & {
    isAnimist?: boolean;
    category: SpellcastingCategory | "charges";
    isStaff: boolean;
    uses?: ValueAndMax;
    groups: Array<
        Omit<SpellcastingSlotGroup, "active"> & {
            active: (CustomGroupActive | null)[];
        }
    >;
};

type CustomGroupActive = ActiveSpell & { uses?: ValueAndMax };

type SpellsHudContext = {
    spellGroups: SpellGroupData[];
};

export { SpellsSidebarPF2eHUD };
