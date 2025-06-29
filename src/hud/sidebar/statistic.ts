import { FilterValue } from "hud";
import {
    AbilityItemPF2e,
    Action,
    ActionCost,
    ActionVariantUseOptions,
    ActorPF2e,
    AttributeString,
    createFormData,
    createHTMLElement,
    FeatPF2e,
    getActionIcon,
    htmlQuery,
    isInstanceOf,
    localize,
    ModifierPF2e,
    R,
    RollNoteSource,
    SingleCheckAction,
    SingleCheckActionVariantData,
    SkillActionOptions,
    SkillSlug,
    waitDialog,
    ZeroToTwo,
} from "module-helpers";

const ACTION_IMAGES: Record<string, ImageFilePath> = {
    lore: "systems/pf2e/icons/spells/divine-decree.webp",
    treatWounds: "systems/pf2e/icons/spells/delay-affliction.webp",
    "recall-knowledge": "systems/pf2e/icons/spells/brain-drain.webp",
    "learn-a-spell": "systems/pf2e/icons/equipment/adventuring-gear/writing-set.webp",
    "identify-magic": "systems/pf2e/icons/equipment/adventuring-gear/magnifying-glass.webp",
};

abstract class BaseStatisticAction<
    TData extends RawBaseActionData = RawBaseActionData,
    TItem extends AbilityItemPF2e | FeatPF2e = AbilityItemPF2e | FeatPF2e
> {
    #data: TData;
    #img?: ImageFilePath;
    #item: TItem;
    #actionKey?: string;

    constructor(data: TData, item: TItem) {
        this.#data = data;
        this.#item = item;
    }

    abstract get filterValue(): FilterValue;
    abstract get label(): string;
    abstract readonly variants: Collection<StatisticVariant | MapVariant>;

    get data(): TData {
        return this.#data;
    }

    get key(): string {
        return this.data.key;
    }

    get item(): TItem {
        return this.#item;
    }

    get actionCost(): ActionCost["value"] | ActionCost["type"] {
        return this.data.actionCost ?? null;
    }

    get sourceId(): CompendiumItemUUID {
        return this.data.sourceId;
    }

    get actionKey(): string {
        return (this.#actionKey ??= game.pf2e.system.sluggify(this.key, { camel: "bactrian" }));
    }

    get img(): ImageFilePath {
        return (this.#img ??=
            ACTION_IMAGES[this.key] ??
            game.pf2e.actions.get(this.key)?.img ??
            getActionIcon(this.actionCost));
    }

    toData(): Omit<ExtractReadonly<this>, "data"> {
        const ThisProto = (this.constructor as ConstructorOf<this>).prototype;
        const ParentProto = Reflect.getPrototypeOf(ThisProto);

        return R.pipe(
            [ThisProto, ParentProto],
            R.flatMap((Proto) => R.entries(Object.getOwnPropertyDescriptors(Proto))),
            R.filter(([key, descriptor]) => key !== "data" && typeof descriptor.get === "function"),
            R.mapToObj(([key]) => [key, this[key as keyof this]])
        ) as ExtractReadonly<this>;
    }

    async roll(actor: ActorPF2e, event: MouseEvent, options: BaseStatisticRollOptions) {
        const variant = options.variant ? this.variants.get(options.variant) : undefined;
        const usedOptions = {
            ...R.pick((variant ?? {}) as MapVariant, ["agile", "map"]),
            ...options,
            event,
        };

        const actionKey = this.key;
        const isMapVariant = R.isNonNullish(usedOptions.map);
        const action = game.pf2e.actions.get(actionKey) ?? game.pf2e.actions[actionKey];

        if (usedOptions.alternates ?? event.button === 2) {
            if (
                !usedOptions.dc &&
                isInstanceOf<SingleCheckAction>(action, "SingleCheckAction") &&
                typeof action.difficultyClass === "object"
            ) {
                usedOptions.dc = action.difficultyClass.value;
            }

            const label = (!isMapVariant && variant?.label) || this.label;
            const alternates = await waitDialog<{
                data: Omit<typeof usedOptions, "event">;
                event: MouseEvent;
            }>({
                classes: ["skills"],
                content: "dialogs/action-alternates",
                i18n: "dialogs.alternates",
                data: {
                    ...usedOptions,
                    label,
                    statistics: getStatistics(),
                },
                onRender: (event, dialog) => {
                    if (!usedOptions.dragData) return;

                    const html = dialog.element;
                    const img = createHTMLElement("img", {
                        classes: ["drag-img"],
                        dataset: { tooltip: localize("dialogs.alternates.drag") },
                    });

                    img.draggable = true;
                    img.src = usedOptions.dragData.img;

                    htmlQuery(html, ".form-footer")?.append(img);
                },
                yes: {
                    callback: async (event, el, dialog) => {
                        return {
                            data: createFormData(dialog.element),
                            event,
                        };
                    },
                },
            });

            if (!alternates) return;

            usedOptions.event = alternates.event;
            foundry.utils.mergeObject(usedOptions, alternates.data);
        }

        const rollOptions = {
            event: usedOptions.event,
            actors: [actor],
            variant: !isMapVariant ? variant?.slug : undefined,
            rollOptions: usedOptions.rollOptions?.map((x) => `action:${x}`) ?? [],
            modifiers: [] as ModifierPF2e[],
            difficultyClass: usedOptions.dc ? { value: usedOptions.dc } : undefined,
        } satisfies RollStatisticRollOptions;

        if (variant && !isMapVariant) {
            rollOptions.rollOptions.push(
                ...rollOptions.rollOptions.map((x) => `${x}:${variant.slug}`)
            );
        }

        if (usedOptions.map) {
            const modifier = new game.pf2e.Modifier({
                label: "PF2E.MultipleAttackPenalty",
                modifier: getMapValue(usedOptions.map, usedOptions.agile),
            });
            rollOptions.modifiers.push(modifier);
        }

        if (!action) {
            actor.getStatistic(usedOptions.statistic ?? "")?.roll(rollOptions);
        } else if (isInstanceOf<Action>(action, "BaseAction")) {
            foundry.utils.mergeObject(rollOptions, {
                statistic: usedOptions.statistic,
                notes: usedOptions.notes,
            });
            action.use(rollOptions);
        } else if (action) {
            foundry.utils.mergeObject(rollOptions, {
                skill: usedOptions.statistic,
            });
            action(rollOptions);
        }
    }
}

const _cachedStatistics: SelectOptions = [];
function getStatistics(): SelectOptions {
    if (_cachedStatistics.length === 0) {
        _cachedStatistics.push({
            value: "perception",
            label: game.i18n.localize("PF2E.PerceptionLabel"),
        });

        _cachedStatistics.push(
            ...R.pipe(
                R.entries(CONFIG.PF2E.skills),
                R.map(([value, { label }]): SelectOption => {
                    return { value, label: game.i18n.localize(label) };
                })
            )
        );
    }

    return _cachedStatistics;
}

function getMapValue(map: 1 | 2, agile = false): -4 | -5 | -8 | -10 {
    return map === 1 ? (agile ? -4 : -5) : agile ? -8 : -10;
}

function getMapLabel(map: ZeroToTwo, agile?: boolean) {
    return map === 0
        ? game.i18n.localize("PF2E.Roll.Normal")
        : game.i18n.format("PF2E.MAPAbbreviationLabel", {
              penalty: getMapValue(map, agile),
          });
}

function createMapsVariantsCollection(
    filter: string,
    agile: boolean = false
): Collection<MapVariant> {
    const variants = R.times(3, (map): MapVariant => {
        return {
            agile,
            filterValue: new FilterValue(filter),
            label: getMapLabel(map as ZeroToTwo, agile),
            map: map as ZeroToTwo,
            slug: `map-${map}`,
        };
    });

    return new Collection(variants.map((variant) => [variant.slug, variant]));
}

type RawBaseActionData = {
    actionCost?: ActionCost["value"] | ActionCost["type"];
    key: string;
    /** item use for description and send-to-chat */
    sourceId: CompendiumItemUUID;
};

type BaseStatisticRollOptions = {
    agile?: boolean;
    alternates?: boolean;
    dc?: number;
    dragData?: { img: ImageFilePath };
    map?: ZeroToTwo;
    notes?: SingleCheckActionRollNoteData[];
    rollOptions?: string[];
    statistic?: StatisticType;
    variant?: string;
};

type StatisticVariant = {
    filterValue: FilterValue;
    label: string;
    slug: string;
};

type MapVariant = StatisticVariant & {
    map: ZeroToTwo;
    agile: boolean;
};

type StatisticType = SkillSlug | SkillSlugSfe2 | "perception";

type RollStatisticRollOptions = Partial<ActionVariantUseOptions> &
    (SingleCheckActionVariantData | SkillActionOptions);

type SkillsConfigSf2e = Record<
    SkillSlug | SkillSlugSfe2,
    { label: string; attribute: AttributeString }
>;

type SingleCheckActionRollNoteData = Omit<RollNoteSource, "selector"> & {
    selector?: string;
};

type SkillSlugSfe2 = "computers" | "piloting";

export { BaseStatisticAction, createMapsVariantsCollection, getMapLabel, getStatistics };
export type {
    BaseStatisticRollOptions,
    MapVariant,
    RawBaseActionData,
    SingleCheckActionRollNoteData,
    SkillsConfigSf2e,
    StatisticType,
    StatisticVariant,
};
