import {
    AbilityItemPF2e,
    CreaturePF2e,
    FeatPF2e,
    ImageFilePath,
    R,
    z,
    zDocumentUUID,
    ZeroToTwo,
} from "foundry-helpers";
import { BaseStatisticAction, BaseStatisticRollOptions, getMapLabel } from "hud";
import { PersistentShortcut, ShortcutCost, ShortcutData, ShortcutDataset, zBaseShortcut } from "..";

function zStatisticActionShortcut(type: string, keysChoices: ReadonlyArray<string>) {
    return zBaseShortcut(type).extend({
        key: z.enum(keysChoices),
        override: z.object({ agile: z.boolean().optional(), statistic: z.string().optional() }).prefault({}),
        sourceId: zDocumentUUID("Item"),
    });
}

abstract class StatisticActionShortcut<
    TAction extends BaseStatisticAction,
    TItem extends FeatPF2e | AbilityItemPF2e,
> extends PersistentShortcut<StatisticActionShortcutSchema, TItem> {
    #usedImage?: ImageFilePath;

    static getItem(
        _actor: CreaturePF2e,
        { sourceId }: StatisticActionShortcutSource,
    ): Promise<Maybe<FeatPF2e | AbilityItemPF2e>> {
        return fromUuid<FeatPF2e | AbilityItemPF2e>(sourceId);
    }

    abstract get action(): TAction | undefined;
    abstract get useOptions(): BaseStatisticRollOptions;

    get dataset(): ShortcutDataset | null {
        return { itemUuid: this.sourceId };
    }

    get usedImage(): ImageFilePath {
        return (this.#usedImage ??= this.action?.img ?? this.img);
    }

    get cost(): ShortcutCost | null {
        const actionCost = this.action?.actionCost;
        return actionCost ? { value: actionCost } : null;
    }

    use(event: MouseEvent): void {
        const action = this.action;
        if (!action) return;

        if (!action.hasMap) {
            action.roll(this.actor, event, this.useOptions);
            return;
        }

        const useOptions = this.useOptions;

        this.radialMenu(
            () => {
                const mapVariants = generateMapRadialOptions(
                    useOptions.agile ?? (action.data.variants as { agile: boolean }).agile,
                );

                return [
                    {
                        title: this.title,
                        options: mapVariants,
                    },
                ];
            },
            (event, value) => {
                const map = Number(value);

                action.roll(this.actor, event, {
                    ...useOptions,
                    map: !isNaN(map) && map.between(0, 2) ? (map as ZeroToTwo) : undefined,
                });
            },
        );
    }

    altUse(event: MouseEvent): void {
        this.action?.roll(this.actor, event, this.useOptions);
    }
}

const _mapRadialCached: PartialRecord<string, { value: string; label: string }[]> = {};
function generateMapRadialOptions(agile: boolean): { value: string; label: string }[] {
    return (_mapRadialCached[String(agile)] ??= R.times(3, (map) => {
        return {
            label: getMapLabel(map as ZeroToTwo, agile),
            value: String(map),
        };
    }));
}

interface StatisticActionShortcut<TAction extends BaseStatisticAction, TItem extends FeatPF2e | AbilityItemPF2e>
    extends PersistentShortcut<StatisticActionShortcutSchema, TItem>, ShortcutData<StatisticActionShortcutSchema> {}

type StatisticActionShortcutSchema = ReturnType<typeof zStatisticActionShortcut>;
type StatisticActionShortcutSource = z.input<StatisticActionShortcutSchema>;

export { StatisticActionShortcut, zStatisticActionShortcut };
export type {};
