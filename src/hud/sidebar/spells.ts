import {
    ErrorPF2e,
    MODULE,
    SummarizedSpellsData,
    addListenerAll,
    changeCarryType,
    coerceToSpellGroupId,
    elementDataset,
    getActiveModule,
    getSummarizedSpellsDataForRender,
    htmlClosest,
    localize,
} from "foundry-pf2e";
import { PF2eHudSidebar, SidebarContext, SidebarName, SidebarRenderOptions } from "./base";

function getAnnotationTooltip(annotation: NonNullable<AuxiliaryActionPurpose>) {
    const label = localize("sidebars.spells.action", annotation);
    const icon = `<span class='action-glyph'>${annotation === "retrieve" ? 2 : 1}</span>`;
    return `${label} ${icon}`;
}

class PF2eHudSidebarSpells extends PF2eHudSidebar {
    get key(): SidebarName {
        return "spells";
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<SpellsContext> {
        const parentData = await super._prepareContext(options);
        const summarizedData = await getSummarizedSpellsDataForRender(this.actor, false, {
            staff: MODULE.path("sidebars.spells.staff"),
            charges: MODULE.path("sidebars.spells.charges"),
        });

        const data: SpellsContext = {
            ...parentData,
            ...summarizedData,
            annotationTooltip: getAnnotationTooltip,
        };

        return data;
    }

    _getDragData(
        target: HTMLElement,
        baseDragData: Record<string, JSONValue>,
        item: Maybe<ItemPF2e<ActorPF2e>>
    ) {
        return target.dataset;
    }

    _activateListeners(html: HTMLElement) {
        const actor = this.actor;

        if (actor.isOfType("character")) {
            addListenerAll(html, "[data-slider-action='focus']", "mousedown", (event, el) => {
                const direction = event.button === 0 ? 1 : -1;
                const focusPoints = actor.system.resources.focus;
                const newValue = Math.clamp(focusPoints.value + direction, 0, focusPoints.max);

                if (newValue !== focusPoints.value) {
                    actor.update({ "system.resources.focus.value": newValue });
                }
            });

            const pf2eDailies = getActiveModule("pf2e-dailies");
            if (pf2eDailies) {
                addListenerAll(
                    html,
                    "[data-action='update-staff-charges']",
                    "change",
                    (event, el: HTMLInputElement) => {
                        const value = el.valueAsNumber;
                        pf2eDailies.api.setStaffChargesValue(actor, value);
                    }
                );
            }
        }

        addListenerAll(html, "[data-action]:not(disabled)", (event, el) => {
            const action = el.dataset.action as SpellsActionEvent;

            switch (action) {
                case "cast-spell": {
                    const { spell, castRank, collection, slotId } = getSpellFromElement(actor, el);
                    const maybeCastRank = Number(castRank) || NaN;
                    if (!Number.isInteger(maybeCastRank) || !maybeCastRank.between(1, 10)) return;

                    const rank = maybeCastRank as OneToTen;
                    this.parentHUD.closeIf("cast-spell");

                    return (
                        spell.parentItem?.consume() ??
                        collection.entry.cast(spell, { rank, slotId: Number(slotId) })
                    );
                }

                case "toggle-slot-expended": {
                    const row = htmlClosest(el, "[data-item-id]");
                    const groupId = coerceToSpellGroupId(row?.dataset.groupId);
                    if (!groupId) throw ErrorPF2e("Unexpected error toggling expended state");

                    const slotId = Number(row?.dataset.slotId) || 0;
                    const entryId = row?.dataset.entryId ?? "";
                    const expend = row?.dataset.slotExpended === undefined;
                    const collection = actor.spellcasting.collections.get(entryId);

                    return collection?.setSlotExpendedState(groupId, slotId, expend);
                }

                case "draw-item": {
                    const { parentId, annotation } = elementDataset<SpallDrawData>(el);
                    const item = actor.inventory.get(parentId, { strict: true });
                    if (!item) return;
                    return changeCarryType(actor, item, 1, annotation);
                }
            }
        });
    }
}

function getSpellFromElement(actor: CreaturePF2e, target: HTMLElement) {
    const spellRow = htmlClosest(target, "[data-item-id]");
    const { itemId, entryId, slotId } = spellRow?.dataset ?? {};
    const collection = actor.spellcasting.collections.get(entryId, {
        strict: true,
    });

    return {
        slotId,
        collection,
        castRank: spellRow?.dataset.castRank,
        spell: collection.get(itemId, { strict: true }),
    };
}

type SpallDrawData = {
    parentId: string;
    annotation: NonNullable<AuxiliaryActionPurpose>;
};

type SpellsActionEvent = "cast-spell" | "toggle-slot-expended" | "draw-item";

interface PF2eHudSidebarSpells {
    get actor(): CreaturePF2e;
}

type SpellsContext = SidebarContext &
    SummarizedSpellsData & {
        annotationTooltip: (annotation: NonNullable<AuxiliaryActionPurpose>) => string;
    };

export { PF2eHudSidebarSpells, getAnnotationTooltip };
