import { SkillActionShortcutData } from "hud";
import { BaseSidebarItem, BaseStatisticRollOptions, ExtractedSkillActionData, getSkillAction, MapVariant } from "..";
import { AbilityItemPF2e, ActorPF2e, FeatPF2e } from "foundry-helpers";

class SkillsSidebarItem extends BaseSidebarItem<FeatPF2e | AbilityItemPF2e, ExtractedSkillActionData> {
    async roll(actor: ActorPF2e, event: MouseEvent, options: BaseStatisticRollOptions) {
        getSkillAction(this.statistic, this.key)?.roll(actor, event, options);
    }

    toShortcut(event?: DragEvent): SkillActionShortcutData {
        const variant: MaybeFalsy<Partial<MapVariant>> =
            event?.target instanceof HTMLElement && this.variants.get(event.target.dataset.variant ?? "");

        return {
            img: this.img,
            key: this.key,
            name: this.label,
            sourceId: this.sourceId,
            statistic: this.statistic,
            type: "skillAction",
            variant: variant && !("map" in variant) ? variant.slug : undefined,
        };
    }
}

interface SkillsSidebarItem extends Readonly<ExtractedSkillActionData> {}

export { SkillsSidebarItem };
