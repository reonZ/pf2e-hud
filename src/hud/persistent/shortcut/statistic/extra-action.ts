import {
    BaseStatisticRollOptions,
    ExtraAction,
    getExtraAction,
    getExtraKeys,
    SIDEBAR_ICONS,
    StatisticType,
} from "hud";
import { AbilityItemPF2e, localize } from "module-helpers";
import {
    generateStatisticActionSchema,
    ShortcutSource,
    StatisticActionShortcut,
    StatisticActionShortcutSchema,
} from "..";

class ExtraActionShortcut extends StatisticActionShortcut<ExtraAction, AbilityItemPF2e> {
    static defineSchema(): ExtraActionShortcutSchema {
        return generateStatisticActionSchema("extraAction", getExtraKeys);
    }

    get action(): ExtraAction | undefined {
        return getExtraAction(this.sourceId);
    }

    get canAltUse(): boolean {
        return this.canUse && this.key === "escape";
    }

    get title(): string {
        return this.name;
    }

    get subtitle(): string {
        const label = localize("shortcuts.tooltip.subtitle", this.type);
        const cost = this.cost ? Handlebars.helpers.actionGlyph(this.cost.value) : undefined;

        return cost ? `${cost} ${label}` : label;
    }

    get altUseLabel(): string {
        return localize("shortcuts.tooltip.altUse.skillAction");
    }

    get icon(): string {
        return SIDEBAR_ICONS.extras;
    }

    get useOptions(): BaseStatisticRollOptions {
        return this.override;
    }
}

type ExtraActionShortcutSchema = StatisticActionShortcutSchema;

type ExtraActionShortcutData = Omit<ShortcutSource<ExtraActionShortcutSchema>, "override"> & {
    type: "extraAction";
    override?: {
        agile?: boolean;
        statistic?: StatisticType;
    };
};

export { ExtraActionShortcut };
export type { ExtraActionShortcutData };
