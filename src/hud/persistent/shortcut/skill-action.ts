import {
    BaseStatisticRollOptions,
    getSkillAction,
    getSkillActionGroup,
    SkillAction,
    STATISTIC_KEYS,
    StatisticType,
} from "hud";
import {
    AbilityItemPF2e,
    addToObjectIfNonNullish,
    CreaturePF2e,
    FeatPF2e,
    localize,
    R,
} from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    PersistentShortcut,
    ShortcutDataset,
    ShortcutSource,
} from ".";
import fields = foundry.data.fields;

class SkillActionShortcut extends PersistentShortcut<
    SkillActionShortcutSchema,
    FeatPF2e | AbilityItemPF2e
> {
    #action?: SkillAction;

    static defineSchema(): SkillActionShortcutSchema {
        return {
            ...generateBaseShortcutFields("skillAction"),
            key: new fields.StringField({
                required: true,
                nullable: false,
                choices: () => STATISTIC_KEYS.slice(),
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
                    choices: () => {
                        return [
                            ...R.keys(CONFIG.PF2E.skills),
                            ...["perception", "computers", "piloting"],
                        ] as const satisfies StatisticType[];
                    },
                    initial: undefined,
                }),
            }),
            sourceId: new fields.DocumentUUIDField({
                required: true,
                nullable: false,
                type: "Item",
            }),
            statistic: new fields.StringField({
                required: true,
                nullable: false,
                choices: () => {
                    return [
                        ...R.keys(CONFIG.PF2E.skills),
                        ...["perception", "computers", "piloting"],
                    ] as const satisfies StatisticType[];
                },
            }),
            variant: new fields.StringField({
                required: false,
                nullable: false,
                initial: undefined,
            }),
        };
    }

    static getItem(
        actor: CreaturePF2e,
        { sourceId }: SkillActionShortcutData
    ): Promise<Maybe<FeatPF2e | AbilityItemPF2e>> {
        return fromUuid<FeatPF2e | AbilityItemPF2e>(sourceId);
    }

    get action(): SkillAction | undefined {
        return (this.#action ??= getSkillAction(this.statistic, this.key));
    }

    get dataset(): ShortcutDataset | null {
        return { itemUuid: this.sourceId };
    }

    get canAltUse(): boolean {
        return this.canUse;
    }

    get usedImage(): ImageFilePath {
        return this.action?.img ?? this.img;
    }

    get title(): string {
        return (this.variant && this.action?.variants.get(this.variant)?.label) || this.name;
    }

    get altUseLabel(): string {
        return localize("shortcuts.tooltip.altUse.skillAction");
    }

    get subtitle(): string {
        const statistic = this.override.statistic ?? this.statistic;
        const label = getSkillActionGroup(statistic)?.label ?? super.subtitle;
        return this.variant ? `${label} (${this.name})` : label;
    }

    use(event: MouseEvent): void {
        const data: BaseStatisticRollOptions = addToObjectIfNonNullish(
            { variant: this.variant },
            this.override
        );

        this.action?.roll(this.actor, event, data);
    }

    altUse(event: MouseEvent): void {
        this.use(event);
    }
}

interface SkillActionShortcut extends ModelPropsFromSchema<SkillActionShortcutSchema> {}

type SkillActionOverrideSchema = {
    agile: fields.BooleanField<boolean, boolean, false, false, true>;
    statistic: fields.StringField<StatisticType, StatisticType, false, false, false>;
};

type SkillActionShortcutSchema = BaseShortcutSchema & {
    key: fields.StringField<string, string, true, false, false>;
    override: fields.SchemaField<SkillActionOverrideSchema>;
    sourceId: fields.DocumentUUIDField<DocumentUUID, true, false, false>;
    statistic: fields.StringField<StatisticType, StatisticType, true, false, false>;
    variant: fields.StringField<string, string, false, false, false>;
};

type SkillActionShortcutData = Omit<ShortcutSource<SkillActionShortcutSchema>, "override"> & {
    override?: {
        agile?: boolean;
        statistic?: StatisticType;
    };
};

export { SkillActionShortcut };
export type { SkillActionShortcutData };
