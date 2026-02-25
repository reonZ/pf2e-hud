import { BaseStatisticRollOptions, ExtraAction, getExtraAction, getExtraKeys, SIDEBAR_ICONS, StatisticType } from "hud";
import {
    generateStatisticActionSchema,
    ShortcutRadialOption,
    ShortcutSource,
    StatisticActionShortcut,
    StatisticActionShortcutSchema,
} from "..";
import { AbilityItemPF2e, localize, R, SaveType, signedInteger } from "foundry-helpers";

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
        return localize("shortcuts.tooltip.subtitle", this.type);
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

    use(event: MouseEvent): void {
        const action = this.action;
        if (!action) return;

        if (action.choices.length > 1) {
            const actor = this.actor;

            this.radialMenu(
                () => {
                    const options: ShortcutRadialOption[] = R.pipe(
                        action.choices,
                        R.map((slug): ShortcutRadialOption | undefined => {
                            const statistic = actor.getStatistic(slug);
                            if (!statistic) return;

                            return {
                                value: slug,
                                label: `${statistic.label} ${signedInteger(statistic.mod)}`,
                            };
                        }),
                        R.filter(R.isTruthy),
                    );

                    return [
                        {
                            title: this.title,
                            options,
                        },
                    ];
                },
                (event, value: StatisticType | SaveType) => {
                    action.roll(this.actor, event, {
                        ...this.useOptions,
                        statistic: value,
                    });
                },
            );

            return;
        }

        super.use(event);
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
