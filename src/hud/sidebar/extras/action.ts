import { ShortcutData } from "hud";
import { AbilityItemPF2e, ActorPF2e } from "module-helpers";
import { rollRecallKnowledge } from ".";
import {
    BaseSidebarItem,
    BaseStatisticRollOptions,
    ExtraActionKey,
    ExtractedExtraActionData,
    getExtraAction,
} from "..";

class ExtrasSidebarItem extends BaseSidebarItem<AbilityItemPF2e, ExtractedExtraActionData> {
    async roll(actor: ActorPF2e, event: MouseEvent, options: BaseStatisticRollOptions) {
        if (this.key === "earnIncome") {
            return game.pf2e.actions.earnIncome(actor);
        }

        if (this.key === "recall-knowledge") {
            return actor.isOfType("creature") && rollRecallKnowledge(actor);
        }

        const rollOptions: BaseStatisticRollOptions = {
            dc: this.dc,
            notes: this.notes,
            ...options,
        };

        if (this.key === "aid") {
            rollOptions.alternates = true;
        }

        getExtraAction(this.sourceId)?.roll(actor, event, rollOptions);
    }

    toShortcut(): ShortcutData | undefined {
        return;
    }
}

interface ExtrasSidebarItem extends Readonly<ExtractedExtraActionData> {
    get key(): ExtraActionKey;
}

export { ExtrasSidebarItem };
