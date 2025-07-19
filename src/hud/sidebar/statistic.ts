import {
    createDraggable,
    ExtrasActionData,
    FilterValue,
    SkillActionData,
    SkillVariants,
} from "hud";
import {
    AbilityItemPF2e,
    Action,
    ActionCost,
    ActionVariantUseOptions,
    ActorPF2e,
    addToObjectIfNonNullish,
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
    #actionKey?: string;
    #data: TData;
    #img?: ImageFilePath;
    #item: TItem;
    #systemPrefix?: string;
    #variants?: SkillVariants;

    constructor(data: TData, item: TItem) {
        this.#data = data;
        this.#item = item;
    }

    abstract get filterValue(): FilterValue;
    abstract get label(): string;

    get data(): TData {
        return this.#data;
    }

    get dc(): number | undefined {
        return this.data.dc;
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

    get notes(): SingleCheckActionRollNoteData[] {
        return (this.data as BaseActionData).notes ?? [];
    }

    get sourceId(): CompendiumItemUUID {
        return this.data.sourceId;
    }

    get actionKey(): string {
        return (this.#actionKey ??= game.pf2e.system.sluggify(this.key, { camel: "bactrian" }));
    }

    get rollOptions(): string[] {
        return (this.data as BaseActionData).rollOptions ?? [];
    }

    get statistic(): StatisticType | undefined {
        return (this.data as BaseActionData).statistic;
    }

    get img(): ImageFilePath {
        return (this.#img ??=
            ACTION_IMAGES[this.key] ??
            game.pf2e.actions.get(this.key)?.img ??
            getActionIcon(this.actionCost));
    }

    get system(): "pf2e" | "sf2e" {
        return this.data.sf2e ? "sf2e" : "pf2e";
    }

    get systemPrefix(): string {
        return (this.#systemPrefix ??= this.system.toUpperCase());
    }

    get hasMap(): boolean {
        return !!this.data.variants && R.isPlainObject(this.data.variants);
    }

    get hasVariants(): boolean {
        return !!this.data.variants && !R.isPlainObject(this.data.variants);
    }

    get variants(): SkillVariants {
        if (this.#variants !== undefined) {
            return this.#variants;
        }

        if (!this.data.variants) {
            return new Collection();
        }

        if (R.isPlainObject(this.data.variants)) {
            const { agile } = this.data.variants;
            return (this.#variants = createMapsVariantsCollection(this.label, agile));
        }

        const variants = this.data.variants.map((variant): StatisticVariant => {
            if (R.isPlainObject(variant)) {
                const label = game.i18n.localize(variant.label);

                return {
                    filterValue: new FilterValue(label),
                    label,
                    slug: variant.slug,
                };
            }

            const variantKey = game.pf2e.system.sluggify(variant, { camel: "bactrian" });
            const label = game.i18n.localize(
                `${this.systemPrefix}.Actions.${this.actionKey}.${variantKey}.Title`
            );

            return {
                filterValue: new FilterValue(this.label, label),
                label,
                slug: variant,
            };
        });

        return (this.#variants = new Collection(
            variants.map((variant) => [variant.slug, variant])
        ));
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
        const variant = options.variant
            ? this.variants.get(options.variant)
            : R.isPlainObject(this.data.variants)
            ? { map: 0, agile: this.data.variants.agile, label: "", slug: "" }
            : undefined;

        const usedOptions: BaseStatisticRollOptions & { event: Event } = {
            ...R.pick(this, ["dc", "notes", "statistic"]),
            ...R.pick((variant ?? {}) as MapVariant, ["agile", "map"]),
            event,
        };

        addToObjectIfNonNullish(usedOptions, options);

        const actionKey = this.key;
        const isMapVariant = R.isNonNullish(usedOptions.map);
        const action = game.pf2e.actions.get(actionKey) ?? game.pf2e.actions[actionKey];

        if (usedOptions.alternates || event.button === 2) {
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
                    maps: R.times(3, (i) => ({ value: i, label: i })),
                    statistics: usedOptions.statistic ? getStatistics() : undefined,
                },
                onRender: (event, dialog) => {
                    const statistic = this.statistic;
                    const html = dialog.element;
                    const img = createHTMLElement("img", {
                        classes: ["drag-img"],
                        dataset: { tooltip: localize("dialogs.alternates.drag") },
                    });

                    img.draggable = true;
                    img.src = this.img;

                    img.addEventListener("dragstart", (event) => {
                        const dragData = {
                            img: this.img,
                            key: this.key,
                            name: this.label,
                            sourceId: this.sourceId,
                            statistic,
                            type: statistic ? "skillAction" : "extraAction",
                            variant: statistic && !isMapVariant ? variant?.slug : undefined,
                            override: {},
                        };

                        addToObjectIfNonNullish(dragData.override, {
                            agile: htmlQuery<HTMLInputElement>(html, `[name="agile"]`)?.checked,
                            statistic: htmlQuery<HTMLSelectElement>(html, `[name="statistic"]`)
                                ?.value,
                        });

                        createDraggable(event, this.img, actor, this.item, {
                            fromSidebar: dragData,
                        });
                    });

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
            rollOptions: this.rollOptions?.map((x) => `action:${x}`) ?? [],
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
    dc?: number;
    key: string;
    sf2e?: boolean;
    /** item used for description and send-to-chat */
    sourceId: CompendiumItemUUID;
    // object refers to map, array refers to actual variants
    variants?: (string | { slug: string; label: string; cost?: ActionCost })[] | { agile: boolean };
};

type BaseActionData = SkillActionData & ExtrasActionData;

type BaseStatisticRollOptions = {
    agile?: boolean;
    alternates?: boolean;
    dc?: number;
    map?: ZeroToTwo;
    notes?: SingleCheckActionRollNoteData[];
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
