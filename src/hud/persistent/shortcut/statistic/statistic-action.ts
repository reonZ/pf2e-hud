import {
    BaseStatisticAction,
    BaseStatisticRollOptions,
    getMapLabel,
    getStatisticTypes,
    StatisticType,
} from "hud";
import { AbilityItemPF2e, CreaturePF2e, FeatPF2e, R, ZeroToTwo } from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    PersistentShortcut,
    ShortcutDataset,
} from "..";
import fields = foundry.data.fields;

function generateStatisticActionSchema(
    type: string,
    keysChoices: () => string[]
): StatisticActionShortcutSchema {
    return {
        ...generateBaseShortcutFields(type),
        key: new fields.StringField({
            required: true,
            nullable: false,
            choices: keysChoices,
        }),
        override: new fields.SchemaField({
            agile: new fields.BooleanField({
                required: false,
                nullable: false,
                initial: undefined,
            }),
            statistic: new fields.StringField({
                required: false,
                nullable: false,
                choices: () => getStatisticTypes(),
                initial: undefined,
            }),
        }),
        sourceId: new fields.DocumentUUIDField({
            required: true,
            nullable: false,
            type: "Item",
        }),
    };
}

abstract class StatisticActionShortcut<
    TAction extends BaseStatisticAction,
    TItem extends FeatPF2e | AbilityItemPF2e
> extends PersistentShortcut<StatisticActionShortcutSchema, TItem> {
    #usedImage?: ImageFilePath;

    static getItem(
        actor: CreaturePF2e,
        { sourceId }: SourceFromSchema<StatisticActionShortcutSchema>
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

    use(event: MouseEvent): void {
        const action = this.action;
        if (!action) return;

        if (event.button !== 0 || !action.hasMap) {
            action.roll(this.actor, event, this.useOptions);
            return;
        }

        const useOptions = this.useOptions;

        this.radialMenu(
            this.title,
            () => {
                const mapVariants = generateMapRadialOptions(
                    useOptions.agile ?? (action.data.variants as { agile: boolean }).agile
                );

                return [mapVariants];
            },
            (value) => {
                const map = Number(value);

                action.roll(this.actor, event, {
                    ...useOptions,
                    map: !isNaN(map) && map.between(0, 2) ? (map as ZeroToTwo) : undefined,
                });
            }
        );
    }

    altUse(event: MouseEvent): void {
        this.use(event);
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

interface StatisticActionShortcut<
    TAction extends BaseStatisticAction,
    TItem extends FeatPF2e | AbilityItemPF2e
> extends ModelPropsFromSchema<StatisticActionShortcutSchema> {}

type StatisticActionOverrideSchema = {
    agile: fields.BooleanField<boolean, boolean, false, false, true>;
    statistic: fields.StringField<StatisticType, StatisticType, false, false, false>;
};

type StatisticActionShortcutSchema = BaseShortcutSchema & {
    key: fields.StringField<string, string, true, false, false>;
    override: fields.SchemaField<StatisticActionOverrideSchema>;
    sourceId: fields.DocumentUUIDField<DocumentUUID, true, false, false>;
};

export { generateStatisticActionSchema, StatisticActionShortcut };
export type { StatisticActionShortcutSchema };
