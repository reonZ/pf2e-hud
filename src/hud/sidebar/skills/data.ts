import { FilterValue, getMapLabel, getMapValue, SidebarDragData } from "hud";
import {
    Action,
    ActionVariantUseOptions,
    ActorPF2e,
    AttributeString,
    createFormData,
    createHTMLElement,
    getActionIcon,
    gettersToData,
    hasAnyItemWithSourceId,
    hasItemWithSourceId,
    htmlQuery,
    isInstanceOf,
    localize,
    localizeIfExist,
    LorePF2e,
    ModifierPF2e,
    R,
    signedInteger,
    SingleCheckAction,
    SingleCheckActionVariantData,
    SkillActionOptions,
    SkillSlug,
    Statistic,
    waitDialog,
    ZeroToFour,
    ZeroToTwo,
} from "module-helpers";
import {
    ACTION_IMAGES,
    CHIRURGEON,
    RAW_STATISTICS,
    SHARED_ACTIONS,
    SkillActionData,
    SkillActionType,
    SkillSlugSfe2,
    UNTRAINED_IMPROVISATION,
} from ".";

class SkillAction implements Required<IStatisticAction> {
    #actionKey?: string;
    #data: SkillActionData;
    #filterValue?: FilterValue;
    #label?: string;
    #statistic: SkillActionType;
    #systemPrefix?: string;
    #dragImg?: ImageFilePath;
    #variants?: SkillVariants;

    constructor(statistic: SkillActionType, data: SkillActionData) {
        this.#data = data;
        this.#statistic = statistic;
    }

    get key(): string {
        return this.#data.key;
    }

    get statistic(): SkillActionType {
        return this.#statistic;
    }

    get rollOptions(): string[] {
        return this.#data.rollOptions ?? [];
    }

    get system(): "pf2e" | "sf2e" {
        return this.#data.system ?? "pf2e";
    }

    get systemPrefix(): string {
        return (this.#systemPrefix ??= this.system.toUpperCase());
    }

    get actionKey(): string {
        return (this.#actionKey ??= game.pf2e.system.sluggify(this.key, { camel: "bactrian" }));
    }

    get requireTrained(): boolean {
        return !!this.#data.requireTrained;
    }

    get actionCost(): Exclude<SkillActionData["actionCost"], undefined> {
        return this.#data.actionCost ?? null;
    }

    get useInstance(): boolean {
        return !!this.#data.useInstance;
    }

    get sourceId(): CompendiumUUID {
        return this.#data.sourceId;
    }

    get label(): string {
        return (this.#label ??= this.#data.label
            ? localizeIfExist("actions", this.#data.label) ?? game.i18n.localize(this.#data.label)
            : game.i18n.localize(`${this.systemPrefix}.Actions.${this.actionKey}.Title`));
    }

    get filterValue(): FilterValue {
        return (this.#filterValue ??= new FilterValue(
            this.label,
            ...this.variants.map((variant) => variant.filterValue).filter(R.isTruthy)
        ));
    }

    get dragImg(): ImageFilePath {
        return (this.#dragImg ??=
            ACTION_IMAGES[this.key] ??
            game.pf2e.actions.get(this.key)?.img ??
            getActionIcon(this.actionCost));
    }

    get variants(): SkillVariants {
        if (this.#variants !== undefined) {
            return this.#variants;
        }

        if (!this.#data.variants) {
            return new Collection();
        }

        if (R.isPlainObject(this.#data.variants)) {
            const { agile } = this.#data.variants;

            const variants = R.times(3, (map): MapVariant => {
                return {
                    agile,
                    filterValue: new FilterValue(this.label),
                    label: getMapLabel(map as ZeroToTwo, agile),
                    map: map as ZeroToTwo,
                    slug: `map-${map}`,
                };
            });

            return (this.#variants = new Collection(
                variants.map((variant) => [variant.slug, variant])
            ));
        }

        const variants = this.#data.variants.map((variant): ActionVariant => {
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

    prepare(actor: ActorPF2e): Omit<PreparedSkillAction, "isProficient"> {
        return gettersToData<SkillAction>(this);
    }

    async roll(actor: ActorPF2e, event: MouseEvent, options: SkillActionRollOptions) {
        const variant = options.variant ? this.variants.get(options.variant) : null;
        const usedOptions = {
            ...R.pick((variant ?? {}) as MapVariant, ["agile", "map"]),
            ...options,
            event,
            statistic: this.statistic,
        };

        const isMapVariant = R.isNonNullish(usedOptions.map);
        const action = game.pf2e.actions.get(this.key) ?? game.pf2e.actions[this.key];

        if (usedOptions.alternates ?? event.button === 2) {
            if (
                !usedOptions.dc &&
                isInstanceOf<SingleCheckAction>(action, "SingleCheckAction") &&
                typeof action.difficultyClass === "object"
            ) {
                usedOptions.dc = action.difficultyClass.value;
            }

            const label = (!isMapVariant && variant?.label) || this.label;
            const statistics = getSkillActionGroups().map(({ label, slug }) => {
                return { label, value: slug };
            });

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
                    statistics,
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
            variant: !isMapVariant ? usedOptions.variant : undefined,
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
            (rollOptions as SingleCheckActionVariantData).statistic = usedOptions.statistic;
            action.use(rollOptions);
        } else if (action) {
            (rollOptions as SkillActionOptions).skill = usedOptions.statistic;
            action(rollOptions);
        }
    }
}

class SkillActionGroup extends Collection<SkillAction> {
    #filterValue?: FilterValue;
    #label?: string;
    #slug: SkillActionType;

    constructor(statistic: SkillActionType, actions: SkillAction[]) {
        super(actions.map((action) => [action.key, action]));
        this.#slug = statistic;
    }

    get slug(): SkillActionType {
        return this.#slug;
    }

    get filterValue(): FilterValue {
        return (this.#filterValue ??= new FilterValue(
            this.label,
            ...this.map((action) => action.filterValue)
        ));
    }

    get label(): string {
        return (this.#label ??= game.i18n.localize(
            this.slug === "perception"
                ? "PF2E.PerceptionLabel"
                : (CONFIG.PF2E.skills as SkillsConfigSf2e)[this.slug].label
        ));
    }

    prepare(
        actor: ActorPF2e,
        showUntrained: boolean,
        cached: PrepareSkillCached
    ): PreparedSkillActionGroup {
        const isCharacter = actor.isOfType("character");
        const statistic = actor.getStatistic(this.slug);
        const rank = statistic?.rank ?? 0;

        const isProficient = (() => {
            if (!isCharacter || statistic?.proficient) {
                return true;
            }

            if (
                this.slug === "medicine" &&
                (cached.isChirurgeon ??= hasItemWithSourceId(actor, CHIRURGEON, "feat"))
            ) {
                return true;
            }

            return (cached.hasUntrainedImprovisation ??= hasAnyItemWithSourceId(
                actor,
                UNTRAINED_IMPROVISATION,
                "feat"
            ));
        })();

        const proficiency = isCharacter
            ? { rank, label: game.i18n.localize(`PF2E.ProficiencyLevel${rank}`) }
            : statistic?.proficient
            ? { rank, label: localize("sidebar.skills.proficient") }
            : undefined;

        const actions = this.map((action) => {
            if (!isProficient && !showUntrained && action.requireTrained) return;
            if (
                action.useInstance &&
                (!isCharacter || !hasItemWithSourceId(actor, action.sourceId, "feat"))
            )
                return;

            const prepared = action.prepare(actor) as PreparedSkillAction;
            prepared.isProficient = !action.requireTrained || isProficient;

            return prepared;
        }).filter(R.isTruthy);

        return {
            ...gettersToData<SkillActionGroup>(this),
            actions: R.sortBy(actions, R.prop("label")),
            isCharacter,
            proficiency,
            signedMod: signedInteger(statistic?.mod ?? 0),
        };
    }
}

class LoreSkill implements ISkill {
    static #dragImg: ImageFilePath = "systems/pf2e/icons/spells/divine-decree.webp";

    #filterValue?: FilterValue;
    #lore: LorePF2e<ActorPF2e>;
    #proficiency?: SkillProficiency;
    #signedMod?: string;
    #slug?: string;
    #statistic: Statistic | null;

    constructor(lore: LorePF2e<ActorPF2e>) {
        const actor = lore.actor;

        this.#lore = lore;
        this.#statistic = actor.getStatistic(this.slug);
    }

    get slug(): string {
        return (this.#slug ??= getLoreSlug(this.#lore.name));
    }

    get label(): string {
        return this.#lore.name;
    }

    get filterValue(): FilterValue {
        return (this.#filterValue ??= new FilterValue(this.label));
    }

    get uuid(): ItemUUID {
        return this.#lore.uuid;
    }

    get signedMod(): string {
        return (this.#signedMod ??= signedInteger(this.#statistic?.mod ?? 0));
    }

    get proficiency(): SkillProficiency {
        return (this.#proficiency ??= getLoreProficiency(this.#lore.actor, this.#statistic?.rank));
    }

    get dragImg(): ImageFilePath {
        return LoreSkill.#dragImg;
    }
}

class SkillActionGroups<T extends SkillActionGroup = SkillActionGroup> extends Collection<T> {
    constructor(groups?: T[]) {
        super(groups?.map((group) => [group.slug, group]));
    }

    prepare(actor: ActorPF2e, showUntrained: boolean): PreparedSkillActionGroup[] {
        const cached = {};
        return this.map((group) => group.prepare(actor, showUntrained, cached));
    }
}

let _cachedStatisticActionGroups: SkillActionGroups | undefined;
function getSkillActionGroups(): SkillActionGroups {
    if (_cachedStatisticActionGroups) {
        return _cachedStatisticActionGroups;
    }

    const currentSystem = game.system.id;
    const skillActionGroups: SkillActionGroup[] = [];

    for (const { actions, statistic, system } of RAW_STATISTICS) {
        if (system && system !== currentSystem) continue;

        const groupActions = R.pipe(
            actions,
            R.map((action) => {
                const data = R.isString(action)
                    ? { ...SHARED_ACTIONS[action], key: action }
                    : action;

                if (!data.system || data.system === currentSystem) {
                    return new SkillAction(statistic, data);
                }
            }),
            R.filter(R.isTruthy)
        );

        const skillActionGroup = new SkillActionGroup(statistic, groupActions);
        skillActionGroups.push(skillActionGroup);
    }

    return (_cachedStatisticActionGroups = new SkillActionGroups(skillActionGroups));
}

function getSkillAction(statistic: string, action: string): SkillAction | undefined {
    return getSkillActionGroups().get(statistic)?.get(action);
}

function getLoreProficiency(actor: ActorPF2e, rank: Maybe<ZeroToFour>): SkillProficiency {
    const isCharacter = actor.isOfType("character");

    return {
        label: isCharacter ? game.i18n.localize(`PF2E.ProficiencyLevel${rank ?? 0}`) : "",
        rank: isCharacter ? rank ?? 0 : "",
    };
}

function getLoreSlug(loreName: string): string {
    const rawLoreSlug = game.pf2e.system.sluggify(loreName);
    return /\blore\b/.test(rawLoreSlug) ? rawLoreSlug : `${rawLoreSlug}-lore`;
}

interface ISkill<TSlug extends string = string> {
    filterValue: FilterValue;
    label: string;
    signedMod: string;
    slug: TSlug;
    proficiency: SkillProficiency | undefined;
}

type SkillProficiency = { rank: ZeroToFour | ""; label: string };

type PrepareSkillCached = {
    hasUntrainedImprovisation?: boolean;
    isChirurgeon?: boolean;
};

interface PreparedSkillAction extends Prettify<ExtractReadonly<SkillAction>> {
    isProficient: boolean;
}

interface PreparedSkillActionGroup
    extends Prettify<ExtractReadonly<SkillActionGroup>>,
        ISkill<SkillActionType> {
    actions: PreparedSkillAction[];
    isCharacter: boolean;
    proficiency: SkillProficiency | undefined;
    signedMod: string;
}

type SkillVariants = Collection<ActionVariant | MapVariant>;

type ActionVariant = {
    filterValue: FilterValue;
    label: string;
    slug: string;
};

type MapVariant = ActionVariant & {
    map: ZeroToTwo;
    agile: boolean;
};

type SkillsConfigSf2e = Record<
    SkillSlug | SkillSlugSfe2,
    { label: string; attribute: AttributeString }
>;

type SkillActionRollOptions = {
    alternates?: boolean;
    agile?: boolean;
    dc?: number;
    dragData?: SidebarDragData;
    variant?: string;
    map?: ZeroToTwo;
};

interface IStatisticAction {
    actionKey?: string;
    key: string;
    label?: string;
    rollOptions?: string[];
    statistic?: SkillActionType;
    systemPrefix?: string;
    variants?: SkillVariants;
}

type RollStatisticRollOptions = Partial<ActionVariantUseOptions> &
    (SingleCheckActionVariantData | SkillActionOptions);

export { getSkillAction, getSkillActionGroups, LoreSkill, SkillActionGroups };
export type { PreparedSkillActionGroup, SkillVariants };
