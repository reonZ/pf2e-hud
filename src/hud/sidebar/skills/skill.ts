import { AbilityItemPF2e, ActorPF2e, FeatPF2e } from "module-helpers";
import {
    BaseSidebarItem,
    BaseStatisticRollOptions,
    ExtractedSkillActionData,
    getSkillAction,
} from "..";

class SkillsSidebarItem extends BaseSidebarItem<
    FeatPF2e | AbilityItemPF2e,
    ExtractedSkillActionData
> {
    async roll(actor: ActorPF2e, event: MouseEvent, options: BaseStatisticRollOptions) {
        const rollOptions: BaseStatisticRollOptions = {
            rollOptions: this.rollOptions,
            statistic: this.statistic,
            ...options,
        };

        getSkillAction(this.statistic, this.key)?.roll(actor, event, rollOptions);
    }
}

interface SkillsSidebarItem extends Readonly<ExtractedSkillActionData> {}

export { SkillsSidebarItem };
