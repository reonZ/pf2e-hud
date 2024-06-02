import {
    ErrorPF2e,
    SummarizedSpellsData,
    addListenerAll,
    coerceToSpellGroupId,
    elementData,
    getSummarizedSpellsDataForRender,
    htmlClosest,
    localizePath,
} from "pf2e-api";

import { SidebarContext, SidebarRenderOptions } from "../sidebar";
import { addSpellsListeners, getSpellFromElement } from "../utils";
import { PF2eHudTokenSidebar } from "./base";

class PF2eHudSpellsSidebar extends PF2eHudTokenSidebar {
    get sidebarKey(): "spells" {
        return "spells";
    }

    async _prepareContext(
        options: SidebarRenderOptions
    ): Promise<SpellsSidebarContext | SidebarContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);
        if (!actor.isOfType("character", "npc")) return parentData;

        const summarizedData = await getSummarizedSpellsDataForRender(actor, false, (str: string) =>
            localizePath("sidebars.spells", str)
        );

        const data: SpellsSidebarContext = {
            ...parentData,
            ...summarizedData,
        };

        return data;
    }

    _activateListener(html: HTMLElement) {
        super._activateListener(html);
        addSpellsListeners(this.actor, html);
        addListenerAll(html, "[data-action]:not(disabled)", this.#actionEvents.bind(this));
    }

    #actionEvents(event: MouseEvent, target: HTMLElement) {
        const actor = this.actor;
        const action = elementData<{ action: SpellsActionEvent }>(target).action;

        switch (action) {
            case "cast-spell": {
                const { spell, castRank, collection, slotId } = getSpellFromElement(actor, target);
                const maybeCastRank = Number(castRank) || NaN;

                if (Number.isInteger(maybeCastRank) && maybeCastRank.between(1, 10)) {
                    const rank = maybeCastRank as OneToTen;

                    this.parentHud.closeIf("closeOnSpell");

                    return (
                        spell.parentItem?.consume() ??
                        collection.entry.cast(spell, { rank, slotId: Number(slotId) })
                    );
                }

                break;
            }

            case "toggle-slot-expended": {
                const row = htmlClosest(event.target, "[data-item-id]");
                const groupId = coerceToSpellGroupId(row?.dataset.groupId);
                if (!groupId) throw ErrorPF2e("Unexpected error toggling expended state");

                const slotId = Number(row?.dataset.slotId) || 0;
                const entryId = row?.dataset.entryId ?? "";
                const expend = row?.dataset.slotExpended === undefined;
                const collection = actor.spellcasting.collections.get(entryId);

                return collection?.setSlotExpendedState(groupId, slotId, expend);
            }

            case "draw-item": {
                const itemId = htmlClosest(event.target, "[data-item-id")?.dataset.itemId;
                const item = actor.inventory.get(itemId, { strict: true });
                return actor.changeCarryType(item, { carryType: "held", handsHeld: 1 });
            }
        }
    }
}

interface PF2eHudSpellsSidebar {
    get actor(): CreaturePF2e;
}

type SpellsActionEvent = "cast-spell" | "toggle-slot-expended" | "draw-item";

type SpellsSidebarContext = SidebarContext & SummarizedSpellsData & {};

export { PF2eHudSpellsSidebar };
