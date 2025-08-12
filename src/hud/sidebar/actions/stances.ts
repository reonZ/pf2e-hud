import { FilterValue, StanceShortcutData } from "hud";
import {
    AbilityItemPF2e,
    canUseStances,
    CharacterPF2e,
    CreaturePF2e,
    FeatPF2e,
    getStances,
    hasItemWithSourceId,
    StanceData,
    toggleStance,
} from "module-helpers";
import { ActionsSidebarPF2eHUD } from ".";
import { BaseSidebarItem } from "..";

class ActionsStance extends BaseSidebarItem<
    FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>,
    StanceData
> {
    get uuid(): string {
        return this.effectUUID;
    }

    get actor(): CreaturePF2e {
        return this.item.actor;
    }

    get active(): boolean {
        return hasItemWithSourceId(this.actor, this.effectUUID, "effect");
    }

    async toggle(force?: boolean): Promise<void> {
        toggleStance(this.actor, this.effectUUID, force);
    }

    toShortcut(): StanceShortcutData {
        return {
            effectUUID: this.effectUUID,
            img: this.img,
            itemId: this.id,
            name: this.label,
            type: "stance",
        };
    }
}

interface ActionsStance extends Readonly<StanceData> {}

function getSidebarStancesData(this: ActionsSidebarPF2eHUD): StancesContext | undefined {
    const actor = this.actor as CharacterPF2e;
    const stances = getStances(actor);
    if (!stances?.length) return;

    const actions = stances.map((data) => {
        return this.addSidebarItem(ActionsStance, "id", data);
    });

    return {
        actions,
        canUseStances: canUseStances(actor),
        filterValue: new FilterValue(...actions),
    };
}

function onStancesClickAction(
    event: MouseEvent,
    sidebarItem: ActionsStance,
    action: Stringptionel<"toggle-stance">
) {
    if (action === "toggle-stance") {
        sidebarItem.toggle(event.ctrlKey);
    }
}

type StancesContext = {
    canUseStances: boolean;
    filterValue: FilterValue;
    actions: ActionsStance[];
};

export { ActionsStance, getSidebarStancesData, onStancesClickAction };
export type { StancesContext };
