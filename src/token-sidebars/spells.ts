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
import { PF2eHudTokenSidebar } from "./base";
import { getSpellFromElement } from "../utils";

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

        // addEnterKeyListeners(html);
        // addListenerAll(html, "[data-action]:not(disabled)", this.#actionEvents.bind(this));
        // addItemPropertyListeners(this.actor, html);
        // addStavesListeners(this.actor, html);

        // const actor = this.actor;
        // if (actor.isOfType("character")) {
        //     addListenerAll(html, "[data-slider-action='focus']", "mousedown", (event, el) => {
        //         const direction = event.button === 0 ? 1 : -1;
        //         const focusPoints = actor.system.resources.focus;
        //         const newValue = Math.clamp(focusPoints.value + direction, 0, focusPoints.max);

        //         if (newValue !== focusPoints.value) {
        //             this.actor.update({ "system.resources.focus.value": newValue });
        //         }
        //     });
        // }
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
        }
    }
}

interface PF2eHudSpellsSidebar {
    get actor(): CreaturePF2e;
}

type SpellsActionEvent = "cast-spell" | "toggle-slot-expended";

type SpellsSidebarContext = SidebarContext & SummarizedSpellsData & {};

export { PF2eHudSpellsSidebar };
