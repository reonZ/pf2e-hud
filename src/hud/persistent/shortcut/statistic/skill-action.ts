import { AbilityItemPF2e, FeatPF2e, localize, z } from "foundry-helpers";
import {
    BaseStatisticRollOptions,
    getSkillAction,
    getSkillActionGroup,
    getSkillKeys,
    getStatisticTypes,
    SIDEBAR_ICONS,
    SkillAction,
} from "hud";
import { ShortcutData, StatisticActionShortcut, zStatisticActionShortcut } from "..";

function zSkillActionShortcut() {
    return zStatisticActionShortcut("skillAction", getSkillKeys()).extend({
        statistic: z.enum(getStatisticTypes()),
        variant: z.string().optional(),
    });
}

class SkillActionShortcut extends StatisticActionShortcut<SkillAction, FeatPF2e | AbilityItemPF2e> {
    static #schema?: SkillActionShortcutSchema;

    static get schema() {
        return (this.#schema ??= zSkillActionShortcut());
    }

    get action(): SkillAction | undefined {
        return getSkillAction(this.statistic, this.key);
    }

    get title(): string {
        return (this.variant && this.action?.variants.get(this.variant)?.label) || this.name;
    }

    get subtitle(): string {
        const statistic = this.override.statistic ?? this.statistic;
        const label =
            this.actor.getStatistic(statistic)?.label ??
            getSkillActionGroup(statistic)?.label ??
            localize("shortcuts.tooltip.subtitle", this.type);

        return this.variant ? `${label} (${this.name})` : label;
    }

    get canAltUse(): boolean {
        return this.canUse;
    }

    get altUseLabel(): string {
        return localize("shortcuts.tooltip.altUse.skillAction");
    }

    get icon(): string {
        return SIDEBAR_ICONS.skills;
    }

    get useOptions(): BaseStatisticRollOptions {
        return {
            variant: this.variant,
            ...this.override,
        };
    }
}

interface SkillActionShortcut extends ShortcutData<SkillActionShortcutSchema> {
    type: "skillAction";
}

type SkillActionShortcutSchema = ReturnType<typeof zSkillActionShortcut>;
type SkillActionShortcutSource = z.input<SkillActionShortcutSchema>;
type SkillActionShortcutData = z.output<SkillActionShortcutSchema>;

export { SkillActionShortcut };
export type { SkillActionShortcutData, SkillActionShortcutSource };
