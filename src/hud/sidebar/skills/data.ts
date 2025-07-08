import { FilterValue } from "hud";
import {
    AbilityItemPF2e,
    ActorPF2e,
    FeatPF2e,
    gettersToData,
    localizeIfExist,
    LorePF2e,
    MODULE,
    R,
    signedInteger,
    Statistic,
    ZeroToFour,
} from "module-helpers";
import { RAW_STATISTICS, SHARED_ACTIONS, SkillActionData } from ".";
import {
    BaseStatisticAction,
    createMapsVariantsCollection,
    MapVariant,
    SkillsConfigSf2e,
    StatisticType,
    StatisticVariant,
} from "..";

class SkillAction extends BaseStatisticAction<SkillActionData> {
    #filterValue?: FilterValue;
    #label?: string;
    #statistic: StatisticType;
    #systemPrefix?: string;
    #variants?: SkillVariants;

    constructor(statistic: StatisticType, data: SkillActionData, item: FeatPF2e | AbilityItemPF2e) {
        super(data, item);
        this.#statistic = statistic;
    }

    get statistic(): StatisticType {
        return this.#statistic;
    }

    get rollOptions(): string[] {
        return this.data.rollOptions ?? [];
    }

    get system(): "pf2e" | "sf2e" {
        return this.data.system ?? "pf2e";
    }

    get systemPrefix(): string {
        return (this.#systemPrefix ??= this.system.toUpperCase());
    }

    get requireTrained(): boolean {
        return !!this.data.requireTrained;
    }

    get useInstance(): boolean {
        return !!this.data.useInstance;
    }

    get label(): string {
        return (this.#label ??= this.data.label
            ? localizeIfExist("actions", this.data.label) ?? game.i18n.localize(this.data.label)
            : game.i18n.localize(`${this.systemPrefix}.Actions.${this.actionKey}.Title`));
    }

    get filterValue(): FilterValue {
        return (this.#filterValue ??= new FilterValue(
            this.label,
            ...this.variants.map((variant) => variant.filterValue).filter(R.isTruthy)
        ));
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
}

class SkillActionGroup extends Collection<SkillAction> {
    #filterValue?: FilterValue;
    #label?: string;
    #slug: StatisticType;

    constructor(statistic: StatisticType, actions: SkillAction[]) {
        super(actions.map((action) => [action.key, action]));
        this.#slug = statistic;
    }

    get slug(): StatisticType {
        return this.#slug;
    }

    get filterValue(): FilterValue {
        return (this.#filterValue ??= new FilterValue(this.label, ...this));
    }

    get label(): string {
        return (this.#label ??= game.i18n.localize(
            this.slug === "perception"
                ? "PF2E.PerceptionLabel"
                : (CONFIG.PF2E.skills as SkillsConfigSf2e)[this.slug].label
        ));
    }

    toData(): ExtractedSkillActionGroupData {
        return gettersToData<SkillActionGroup>(this);
    }
}

class LoreSkill implements ISkill {
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
}

class SkillActionGroups<T extends SkillActionGroup = SkillActionGroup> extends Collection<T> {
    constructor(groups?: T[]) {
        super(groups?.map((group) => [group.slug, group]));
    }
}

let _cachedSkillActionGroups: SkillActionGroups | undefined;
async function prepareActionGroups() {
    if (_cachedSkillActionGroups) return;

    const currentSystem = game.system.id;
    const skillActionGroups: SkillActionGroup[] = [];

    for (const { actions, statistic, system } of RAW_STATISTICS) {
        if (system && system !== currentSystem) continue;

        const actionsPromise = actions.map(async (action) => {
            const data = R.isString(action) ? { ...SHARED_ACTIONS[action], key: action } : action;
            if (data.system && data.system !== currentSystem) return;

            const sourceItem = await fromUuid<FeatPF2e | AbilityItemPF2e>(data.sourceId);
            if (!(sourceItem instanceof Item)) return;

            return new SkillAction(statistic, data, sourceItem);
        });

        const groupActions = R.filter(await Promise.all(actionsPromise), R.isTruthy);
        const skillActionGroup = new SkillActionGroup(statistic, groupActions);

        skillActionGroups.push(skillActionGroup);
    }

    _cachedSkillActionGroups = new SkillActionGroups(skillActionGroups);
}

function getSkillActionGroups(): SkillActionGroups {
    return _cachedSkillActionGroups!;
}

function getSkillActionGroup(statistic: string): SkillActionGroup | undefined {
    return getSkillActionGroups().get(statistic);
}

function getSkillAction(statistic: string, action: string): SkillAction | undefined {
    return getSkillActionGroup(statistic)?.get(action);
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

type SkillVariants = Collection<StatisticVariant | MapVariant>;

type ExtractedSkillActionGroupData = ExtractReadonly<SkillActionGroup>;
type ExtractedSkillActionData = ExtractReadonly<SkillAction>;

MODULE.devExpose({ getSkillActionGroups, getSkillAction });

export {
    getSkillAction,
    getSkillActionGroup,
    getSkillActionGroups,
    LoreSkill,
    prepareActionGroups,
    SkillActionGroups,
};
export type {
    ExtractedSkillActionData,
    ExtractedSkillActionGroupData,
    ISkill,
    SkillAction,
    SkillProficiency,
    SkillVariants,
};
