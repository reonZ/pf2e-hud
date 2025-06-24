import { FilterValue } from "hud";
import { AbilityItemPF2e, ActorPF2e, FeatPF2e } from "module-helpers";
import {
    BaseSidebarItem,
    ExtractedSkillActionData,
    getSkillAction,
    SkillActionRollOptions,
} from "..";

class SkillsSidebarItem extends BaseSidebarItem<
    FeatPF2e | AbilityItemPF2e,
    ExtractedSkillActionData
> {
    async roll(actor: ActorPF2e, event: MouseEvent, options: SkillActionRollOptions) {
        getSkillAction(this.statistic, this.key)?.roll(actor, event, options);
    }
}

interface SkillsSidebarItem
    extends BaseSidebarItem<FeatPF2e | AbilityItemPF2e, ExtractedSkillActionData>,
        ExtractedSkillActionData {
    get dragImg(): ImageFilePath;
    get item(): FeatPF2e | AbilityItemPF2e;
    get label(): string;
    get filterValue(): FilterValue;
}

export { SkillsSidebarItem };
