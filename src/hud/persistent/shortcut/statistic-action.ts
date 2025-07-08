import { BaseStatisticAction, getStatisticTypes, StatisticType } from "hud";
import { AbilityItemPF2e, CreaturePF2e, FeatPF2e } from "module-helpers";
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

    get dataset(): ShortcutDataset | null {
        return { itemUuid: this.sourceId };
    }

    get usedImage(): ImageFilePath {
        return (this.#usedImage ??= this.action?.img ?? this.img);
    }

    altUse(event: MouseEvent): void {
        this.use(event);
    }
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
