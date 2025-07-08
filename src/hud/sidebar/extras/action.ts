import { ExtraActionShortcutData } from "hud";
import { AbilityItemPF2e, ActorPF2e } from "module-helpers";
import {
    BaseSidebarItem,
    BaseStatisticRollOptions,
    ExtraActionKey,
    ExtractedExtraActionData,
    getExtraAction,
} from "..";

class ExtrasSidebarItem extends BaseSidebarItem<AbilityItemPF2e, ExtractedExtraActionData> {
    async roll(actor: ActorPF2e, event: MouseEvent, options: BaseStatisticRollOptions) {
        getExtraAction(this.sourceId)?.roll(actor, event, options);
    }

    toShortcut(): ExtraActionShortcutData {
        return {
            img: this.img,
            key: this.key,
            name: this.label,
            sourceId: this.sourceId,
            type: "extraAction",
        };
    }
}

interface ExtrasSidebarItem extends Readonly<ExtractedExtraActionData> {
    get key(): ExtraActionKey;
}

export { ExtrasSidebarItem };
