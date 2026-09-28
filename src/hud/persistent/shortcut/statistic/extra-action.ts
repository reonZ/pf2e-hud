import { AbilityItemPF2e, localize, R, SaveType, signedInteger, z } from "foundry-helpers";
import {
    BaseStatisticRollOptions,
    ExtraAction,
    getExtraAction,
    getExtraKeys,
    getStatisticTypes,
    SIDEBAR_ICONS,
    StatisticType,
} from "hud";
import { ShortcutData, ShortcutRadialOption, StatisticActionShortcut, zStatisticActionShortcut } from "..";

function zExtraActionShortcut() {
    return zStatisticActionShortcut("extraAction", getExtraKeys()).extend({
        statistic: z.enum(getStatisticTypes()).optional(),
    });
}

class ExtraActionShortcut extends StatisticActionShortcut<ExtraAction, AbilityItemPF2e> {
    static #schema?: ExtraActionShortcutSchema;

    static get schema() {
        return (this.#schema ??= zExtraActionShortcut());
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
        const statistic = this.override.statistic && this.actor.getStatistic(this.override.statistic)?.label;

        if (!statistic) {
            return super.subtitle;
        }

        if (this.override.dc) {
            const dc = game.i18n.format("PF2E.InlineAction.Check.DC", this.override);
            return `${statistic} (${dc})`;
        }

        return statistic;
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

interface ExtraActionShortcut extends ShortcutData<ExtraActionShortcutSchema> {
    type: "extraAction";
}

type ExtraActionShortcutSchema = ReturnType<typeof zExtraActionShortcut>;
type ExtraActionShortcutSource = z.input<ExtraActionShortcutSchema>;
type ExtraActionShortcutData = z.output<ExtraActionShortcutSchema>;

export { ExtraActionShortcut };
export type { ExtraActionShortcutData, ExtraActionShortcutSource };
