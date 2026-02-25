import {
    BaseStatisticRollOptions,
    getSkillAction,
    getSkillActionGroup,
    getSkillKeys,
    getStatisticTypes,
    SIDEBAR_ICONS,
    SkillAction,
    StatisticType,
} from "hud";
import {
    generateStatisticActionSchema,
    ShortcutSource,
    StatisticActionShortcut,
    StatisticActionShortcutSchema,
} from "..";
import fields = foundry.data.fields;
import { AbilityItemPF2e, FeatPF2e, localize, ModelPropsFromSchema } from "foundry-helpers";

class SkillActionShortcut extends StatisticActionShortcut<SkillAction, FeatPF2e | AbilityItemPF2e> {
    static defineSchema(): SkillActionShortcutSchema {
        return {
            ...generateStatisticActionSchema("skillAction", getSkillKeys),
            statistic: new fields.StringField({
                required: true,
                nullable: false,
                choices: () => getStatisticTypes(),
            }),
            variant: new fields.StringField({
                required: false,
                nullable: false,
                initial: undefined,
            }),
        };
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

interface SkillActionShortcut extends ModelPropsFromSchema<SkillActionShortcutSchema> {}

type SkillActionShortcutSchema = StatisticActionShortcutSchema & {
    statistic: fields.StringField<StatisticType, StatisticType, true, false, false>;
    variant: fields.StringField<string, string, false, false, false>;
};

type SkillActionShortcutData = Omit<ShortcutSource<SkillActionShortcutSchema>, "override"> & {
    type: "skillAction";
    override?: {
        agile?: boolean;
        statistic?: StatisticType;
    };
};

export { SkillActionShortcut };
export type { SkillActionShortcutData };
