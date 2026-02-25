import { AbilityItemPF2e, localize, R, SaveType, signedInteger, z } from "foundry-helpers";
import { BaseStatisticRollOptions, ExtraAction, getExtraAction, getExtraKeys, SIDEBAR_ICONS, StatisticType } from "hud";
import { ShortcutData, ShortcutRadialOption, StatisticActionShortcut, zStatisticActionShortcut } from "..";

const zExtraActionShortcut = zStatisticActionShortcut("extraAction", getExtraKeys());

class ExtraActionShortcut extends StatisticActionShortcut<ExtraAction, AbilityItemPF2e> {
    static get schema() {
        return zExtraActionShortcut;
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

interface ExtraActionShortcut extends ShortcutData<typeof zExtraActionShortcut> {
    type: "extraAction";
}

type ExtraActionShortcutSource = z.input<typeof zExtraActionShortcut>;
type ExtraActionShortcutData = z.output<typeof zExtraActionShortcut>;

export { ExtraActionShortcut };
export type { ExtraActionShortcutData, ExtraActionShortcutSource };
