import {
    Action,
    ActionCost,
    ActionVariantUseOptions,
    ActorPF2e,
    CreaturePF2e,
    ItemPF2e,
    LorePF2e,
    ModifierPF2e,
    R,
    SingleCheckAction,
    SingleCheckActionVariantData,
    SkillActionOptions,
    SkillSlug,
    StatisticRollParameters,
    ZeroToFour,
    createFormData,
    createHTMLElement,
    dataToDatasetString,
    elementDataset,
    getActionIcon,
    getActiveModule,
    getItemSource,
    getItemWithSourceId,
    getSetting,
    getTranslatedSkills,
    hasItemWithSourceId,
    htmlClosest,
    htmlQuery,
    isInstanceOf,
    localize,
    promptDialog,
    setupDragElement,
    signedInteger,
    templateLocalize,
} from "module-helpers";
import {
    PF2eHudSidebar,
    SidebarContext,
    SidebarDragData,
    SidebarName,
    SidebarRenderOptions,
} from "./base";

const FOLLOW_THE_EXPERT = "Compendium.pf2e.actionspf2e.Item.tfa4Sh7wcxCEqL29";
const FOLLOW_THE_EXPERT_EFFECT = "Compendium.pf2e.other-effects.Item.VCSpuc3Tf3XWMkd3";

const UNTRAINED_IMPROVISATION = "Compendium.pf2e.feats-srd.Item.9jGaBxLUtevZYcZO";

const ACTION_IMAGES: Record<string, string> = {
    lore: "systems/pf2e/icons/spells/divine-decree.webp",
    treatWounds: "systems/pf2e/icons/spells/delay-affliction.webp",
    "recall-knowledge": "systems/pf2e/icons/spells/brain-drain.webp",
    "learn-a-spell": "systems/pf2e/icons/equipment/adventuring-gear/writing-set.webp",
    "identify-magic": "systems/pf2e/icons/equipment/adventuring-gear/magnifying-glass.webp",
};

const ACTION_VARIANTS: Record<string, Record<string, { label: string; cost?: ActionCost }>> = {
    drive: {
        drive1: {
            label: "pf2e-hud.actions.drive.drive1",
            cost: {
                type: "action",
                value: 1,
            },
        },
        drive2: {
            label: "pf2e-hud.actions.drive.drive2",
            cost: {
                type: "action",
                value: 2,
            },
        },
        drive3: {
            label: "pf2e-hud.actions.drive.drive3",
            cost: {
                type: "action",
                value: 3,
            },
        },
    },
};

const SHARED_ACTIONS = {
    "recall-knowledge": {
        cost: 1,
        uuid: "Compendium.pf2e.actionspf2e.Item.1OagaWtBpVXExToo",
    },
    "decipher-writing": {
        trained: true,
        uuid: "Compendium.pf2e.actionspf2e.Item.d9gbpiQjChYDYA2L",
    },
    "identify-magic": {
        trained: true,
        uuid: "Compendium.pf2e.actionspf2e.Item.eReSHVEPCsdkSL4G",
    },
    "learn-a-spell": {
        trained: true,
        uuid: "Compendium.pf2e.actionspf2e.Item.Q5iIYCFdqJFM31GW",
    },
    "disable-device": {
        cost: 2,
        trained: true,
        uuid: "Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6",
    },
    subsist: {
        uuid: "Compendium.pf2e.actionspf2e.Item.49y9Ec4bDii8pcD3",
    },
} satisfies Record<string, Omit<RawSkillAction, "actionId">>;

const SKILLS: RawSkill[] = [
    {
        slug: "perception",
        actions: [
            {
                actionId: "seek",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.BlAOM2X92SI6HMtJ",
            },
            {
                actionId: "sense-motive",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.1xRFPTFtWtGJ9ELw",
            },
        ],
    },
    {
        slug: "acrobatics",
        actions: [
            {
                actionId: "balance",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.M76ycLAqHoAgbcej",
            },
            {
                actionId: "tumble-through",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.21WIfSu7Xd7uKqV8",
            },
            {
                actionId: "maneuver-in-flight",
                trained: true,
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.Qf1ylAbdVi1rkc8M",
            },
            {
                actionId: "squeeze",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.kMcV8e5EZUxa6evt",
            },
        ],
    },
    {
        slug: "arcana",
        actions: [
            "recall-knowledge",
            {
                actionId: "borrow-arcane-spell",
                trained: true,
                label: "pf2e-hud.actions.borrowArcaneSpell",
                uuid: "Compendium.pf2e.actionspf2e.Item.OizxuPb44g3eHPFh",
            },
            "decipher-writing",
            "identify-magic",
            "learn-a-spell",
        ],
    },
    {
        slug: "athletics",
        actions: [
            {
                actionId: "climb",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.pprgrYQ1QnIDGZiy",
            },
            {
                actionId: "force-open",
                cost: 1,
                map: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.SjmKHgI7a5Z9JzBx",
            },
            {
                actionId: "grapple",
                cost: 1,
                map: true,
                agile: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.PMbdMWc2QroouFGD",
            },
            {
                actionId: "high-jump",
                cost: 2,
                uuid: "Compendium.pf2e.actionspf2e.Item.2HJ4yuEFY1Cast4h",
            },
            {
                actionId: "long-jump",
                cost: 2,
                uuid: "Compendium.pf2e.actionspf2e.Item.JUvAvruz7yRQXfz2",
            },
            {
                actionId: "reposition",
                cost: 1,
                map: true,
                agile: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.lOE4yjUnETTdaf2T",
            },
            {
                actionId: "shove",
                cost: 1,
                map: true,
                agile: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.7blmbDrQFNfdT731",
            },
            {
                actionId: "swim",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.c8TGiZ48ygoSPofx",
            },
            {
                actionId: "trip",
                cost: 1,
                map: true,
                agile: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.ge56Lu1xXVFYUnLP",
            },
            {
                actionId: "disarm",
                cost: 1,
                map: true,
                agile: true,
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.Dt6B1slsBy8ipJu9",
            },
        ],
    },
    {
        slug: "computers",
        sf2e: true,
        actions: [
            {
                actionId: "access-infosphere",
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.Yn4jLPVWVE1vtAaF",
            },
            "recall-knowledge",
            "decipher-writing",
            "disable-device",
            {
                actionId: "hack",
                trained: true,
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.RF8xNJ8QsMwogerB",
            },
            {
                actionId: "program",
                trained: true,
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.9zvazWNY5tKbMFnC",
            },
        ],
    },
    {
        slug: "crafting",
        actions: [
            "recall-knowledge",
            {
                actionId: "repair",
                uuid: "Compendium.pf2e.actionspf2e.Item.bT3skovyLUtP22ME",
            },
            {
                actionId: "craft",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.rmwa3OyhTZ2i2AHl",
            },
            {
                actionId: "identify-alchemy",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.Q4kdWVOf2ztIBFg1",
            },
        ],
    },
    {
        slug: "deception",
        actions: [
            {
                actionId: "create-a-diversion",
                cost: 1,
                variants: ["distracting-words", "gesture", "trick"],
                uuid: "Compendium.pf2e.actionspf2e.Item.GkmbTGfg8KcgynOA",
            },
            {
                actionId: "impersonate",
                uuid: "Compendium.pf2e.actionspf2e.Item.AJstokjdG6iDjVjE",
            },
            {
                actionId: "lie",
                uuid: "Compendium.pf2e.actionspf2e.Item.ewwCglB7XOPLUz72",
            },
            {
                actionId: "feint",
                cost: 1,
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.QNAVeNKtHA0EUw4X",
            },
        ],
    },
    {
        slug: "diplomacy",
        actions: [
            {
                actionId: "bonMot",
                cost: 1,
                uuid: "Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf",
                useInstance: true,
            },
            {
                actionId: "gather-information",
                uuid: "Compendium.pf2e.actionspf2e.Item.plBGdZhqq5JBl1D8",
            },
            {
                actionId: "make-an-impression",
                uuid: "Compendium.pf2e.actionspf2e.Item.OX4fy22hQgUHDr0q",
            },
            {
                actionId: "request",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.DCb62iCBrJXy0Ik6",
            },
        ],
    },
    {
        slug: "intimidation",
        actions: [
            {
                actionId: "coerce",
                uuid: "Compendium.pf2e.actionspf2e.Item.tHCqgwjtQtzNqVvd",
            },
            {
                actionId: "demoralize",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.2u915NdUyQan6uKF",
            },
        ],
    },
    {
        slug: "medicine",
        actions: [
            {
                actionId: "administer-first-aid",
                cost: 2,
                variants: ["stabilize", "stop-bleeding"],
                rollOption: "administer-first-aid",
                uuid: "Compendium.pf2e.actionspf2e.Item.MHLuKy4nQO2Z4Am1",
            },
            "recall-knowledge",
            {
                actionId: "treat-disease",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.TC7OcDa7JlWbqMaN",
            },
            {
                actionId: "treat-poison",
                cost: 1,
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.KjoCEEmPGTeFE4hh",
            },
            {
                actionId: "treatWounds",
                label: "PF2E.Actions.TreatWounds.Label",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.1kGNdIIhuglAjIp9",
            },
        ],
    },
    {
        slug: "nature",
        actions: [
            {
                actionId: "command-an-animal",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.q9nbyIF0PEBqMtYe",
            },
            "recall-knowledge",
            {
                actionId: "treatWounds",
                trained: true,
                label: "PF2E.Actions.TreatWounds.Label",
                uuid: "Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu",
                useInstance: true,
            },
            "identify-magic",
            "learn-a-spell",
        ],
    },
    {
        slug: "occultism",
        actions: ["recall-knowledge", "decipher-writing", "identify-magic", "learn-a-spell"],
    },
    {
        slug: "performance",
        actions: [
            {
                actionId: "perform",
                cost: 1,
                variants: [
                    "acting",
                    "comedy",
                    "dance",
                    "oratory",
                    "singing",
                    "keyboards",
                    "percussion",
                    "strings",
                    "winds",
                ],
                uuid: "Compendium.pf2e.actionspf2e.Item.EEDElIyin4z60PXx",
            },
        ],
    },
    {
        slug: "piloting",
        sf2e: true,
        actions: [
            "recall-knowledge",
            {
                actionId: "drive",
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.OxF2dvUCdTYHrnIm",
                variants: ["drive1", "drive2", "drive3"],
            },
            {
                actionId: "navigate",
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.hsUKPqTdAvWwsqH2",
            },
            {
                actionId: "plot-course",
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.LXqcXRayK58inaKo",
            },
            {
                actionId: "run-over",
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.FisNbAu9pdMnz6vF",
                cost: 3,
            },
            {
                actionId: "stop",
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.3oL5ap2Qb00Saaz9",
                cost: 1,
            },
            {
                actionId: "stunt",
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.ailFBRjKuGCOAsCR",
                cost: 1,
                variants: [
                    "back-off",
                    "evade",
                    "flip-and-burn",
                    "barrel-roll",
                    "flyby",
                    "drift",
                    "turn-in-place",
                ],
            },
            {
                actionId: "take-control",
                uuid: "Compendium.starfinder-field-test-for-pf2e.actions.Item.9Msf0P33UR5mNRuz",
                cost: 1,
            },
        ],
    },
    {
        slug: "religion",
        actions: ["recall-knowledge", "decipher-writing", "identify-magic", "learn-a-spell"],
    },
    {
        slug: "society",
        actions: [
            "recall-knowledge",
            "subsist",
            {
                actionId: "create-forgery",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.ftG89SjTSa9DYDOD",
            },
            "decipher-writing",
        ],
    },
    {
        slug: "stealth",
        actions: [
            {
                actionId: "avoid-notice",
                uuid: "Compendium.pf2e.actionspf2e.Item.IE2nThCmoyhQA0Jn",
                exclude: false,
            },
            {
                actionId: "conceal-an-object",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.qVNVSmsgpKFGk9hV",
            },
            {
                actionId: "hide",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.XMcnh4cSI32tljXa",
            },
            {
                actionId: "sneak",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.VMozDqMMuK5kpoX4",
            },
        ],
    },
    {
        slug: "survival",
        actions: [
            {
                actionId: "sense-direction",
                uuid: "Compendium.pf2e.actionspf2e.Item.fJImDBQfqfjKJOhk",
            },
            "subsist",
            {
                actionId: "cover-tracks",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.SB7cMECVtE06kByk",
            },
            {
                actionId: "track",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.EA5vuSgJfiHH7plD",
            },
        ],
    },
    {
        slug: "thievery",
        actions: [
            {
                actionId: "palm-an-object",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.ijZ0DDFpMkWqaShd",
            },
            {
                actionId: "steal",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.RDXXE7wMrSPCLv5k",
            },
            "disable-device",
            {
                actionId: "pick-a-lock",
                cost: 2,
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.2EE4aF4SZpYf0R6H",
            },
        ],
    },
];

const SKILL_ACTIONS_UUIDS = R.pipe(
    SKILLS,
    R.flatMap((rawSkill) => rawSkill.actions),
    R.map((action) =>
        typeof action === "object" && action.exclude !== false ? action.uuid : undefined
    ),
    R.concat(Object.values(SHARED_ACTIONS).map((action) => action.uuid)),
    R.filter(R.isTruthy),
    R.unique()
);

const SF2E_VARIANTS = R.pipe(
    SKILLS,
    R.filter((rawSkill) => !!rawSkill.sf2e),
    R.flatMap((rawSkill) =>
        R.pipe(
            rawSkill.actions,
            R.filter((rawAction) => typeof rawAction === "object"),
            R.map((rawAction) => rawAction.actionId)
        )
    )
);

const actionLabels: Record<string, string> = {};

function prepareStatisticAction(
    statistic: string | undefined,
    rawAction: SharedAction | RawSkillAction,
    withAlternate: boolean
) {
    const [actionId, action]: [string, Omit<RawSkillAction, "actionId">] =
        typeof rawAction === "string"
            ? [rawAction, SHARED_ACTIONS[rawAction]]
            : [rawAction.actionId, rawAction];

    const actionKey = game.pf2e.system.sluggify(actionId, { camel: "bactrian" });
    const prefix = SF2E_VARIANTS.includes(actionId) ? "SF2E" : "PF2E";
    const label = game.i18n.localize(action.label ?? `${prefix}.Actions.${actionKey}.Title`);
    actionLabels[actionId] = label;

    const variants: ActionVariant[] | MapVariant[] | undefined = (() => {
        if (action.map) {
            const tooltip = createActionTooltip(label, withAlternate);

            return [
                {
                    tooltip,
                    label: game.i18n.localize("PF2E.Roll.Normal"),
                },
                {
                    map: 1,
                    tooltip,
                    agile: action.agile,
                    label: getMapLabel(1, !!action.agile),
                },
                {
                    map: 2,
                    tooltip,
                    agile: !!action.agile,
                    label: getMapLabel(2, !!action.agile),
                },
            ] satisfies MapVariant[];
        }

        return action.variants?.map((slug) => {
            const label = getSkillVariantName(actionId, slug);

            return {
                slug,
                label,
                tooltip: createActionTooltip(label, withAlternate),
            } satisfies ActionVariant;
        });
    })();

    const dataset: SkillActionDataset = {
        actionId,
        statistic: statistic,
        itemUuid: action.uuid,
        option: action.rollOption,
    };

    const filterValues = variants?.map((variant) => variant.label) ?? [];
    filterValues.unshift(label);

    return {
        ...action,
        variants,
        actionId,
        label,
        dataset,
        tooltip: createActionTooltip(label, withAlternate),
        filterValue: filterValues.join("|"),
        dragImg:
            ACTION_IMAGES[actionId] ??
            game.pf2e.actions.get(actionId)?.img ??
            getActionIcon(action.cost ?? null),
    } satisfies PreparedSkillAction;
}

function createActionTooltip(name: string, withAlternate: boolean) {
    let tooltip = localize("sidebars.skills.roll", { name });
    return withAlternate ? `${tooltip}<br>${localize("sidebars.skills.alternate")}` : tooltip;
}

let skillsCache: PreparedSkill[] | null = null;
function finalizeSkills(actor: ActorPF2e): FinalizedSkill[] {
    if (!skillsCache) {
        const isPF2e = getActiveModule("starfinder-field-test-for-pf2e");
        const skills = isPF2e ? SKILLS : SKILLS.filter((rawSkill) => !rawSkill.sf2e);

        skillsCache ??= skills.map((rawSkill) => {
            const actions = rawSkill.actions.map((rawAction) =>
                prepareStatisticAction(rawSkill.slug, rawAction, true)
            );
            const label = game.i18n.localize(
                rawSkill.slug === "perception"
                    ? "PF2E.PerceptionLabel"
                    : (CONFIG.PF2E.skills as SkillsConfigSf2e)[rawSkill.slug].label
            );

            const filterValues = actions.map((action) => action.filterValue);
            filterValues.unshift(label);

            return {
                actions,
                slug: rawSkill.slug,
                label,
                filterValue: filterValues.join("|"),
            } satisfies PreparedSkill;
        });
    }

    const isCharacter = actor.isOfType("character");
    const hideUntrained =
        getSetting("sidebar.hideUntrained") &&
        !hasItemWithSourceId(actor, UNTRAINED_IMPROVISATION, "feat");

    return skillsCache.map((skill) => {
        const { mod, rank, proficient } = actor.getStatistic(skill.slug)!;
        const rankLabel = game.i18n.localize(`PF2E.ProficiencyLevel${rank ?? 0}`);

        const actions = skill.actions
            .map((action) => {
                const item = action.useInstance
                    ? getItemWithSourceId(actor, action.uuid, "feat")
                    : null;

                if (item) {
                    action.dataset.itemUuid = item.uuid;
                }

                return {
                    ...action,
                    hasInstance: !!item,
                    dataset: dataToDatasetString(action.dataset),
                    proficient: !isCharacter || proficient || !action.trained,
                } satisfies FinalizedSkillAction;
            })
            .filter((action) => {
                if (!isCharacter) {
                    return !action.useInstance && typeof action.condition !== "function";
                }

                return (
                    (!action.trained || !hideUntrained || proficient) &&
                    (!action.useInstance || action.hasInstance) &&
                    (typeof action.condition !== "function" || action.condition(actor))
                );
            });

        return {
            ...skill,
            actions,
            mod,
            rankLabel,
            proficient,
            rank: rank ?? 0,
        } satisfies FinalizedSkill;
    });
}

function getStatisticDragDataFromElement(el: HTMLElement) {
    const itemElement = htmlClosest(el, ".item");
    if (!itemElement) return {};

    const { itemUuid, actionId, statistic, option } =
        elementDataset<SkillActionDataset>(itemElement);

    return {
        ...el.dataset,
        type: "Item",
        uuid: itemUuid,
        itemType: "action",
        actorLess: true,
        actionId,
        statistic,
        option,
        isStatistic: true,
    };
}

class PF2eHudSidebarSkills extends PF2eHudSidebar {
    get key(): SidebarName {
        return "skills";
    }

    _getDragData(
        target: HTMLElement,
        baseDragData: Record<string, JSONValue>,
        item: Maybe<ItemPF2e<ActorPF2e>>
    ) {
        return getStatisticDragDataFromElement(target);
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<SkillsContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);
        const skills = finalizeSkills(actor);
        const follow = {
            uuid: FOLLOW_THE_EXPERT,
            active: hasItemWithSourceId(actor, FOLLOW_THE_EXPERT_EFFECT, "effect"),
        };

        const lores = (() => {
            if (!actor.isOfType("creature")) return;

            const list = actor.itemTypes.lore.map((lore): LoreSkill => {
                const slug = getLoreSlug(lore);
                const { mod, rank } = actor.getStatistic(slug)!;

                return {
                    slug,
                    uuid: lore.uuid,
                    rank: rank ?? 0,
                    label: lore.name,
                    modifier: signedInteger(mod),
                    rankLabel: game.i18n.localize(`PF2E.ProficiencyLevel${rank ?? 0}`),
                    dragImg: ACTION_IMAGES.lore,
                };
            });

            const modifierWidth = list.reduce(
                (width, lore) => (lore.modifier.length > width ? lore.modifier.length : width),
                2
            );

            return {
                list,
                modifierWidth,
                filterValue: list.map((lore) => lore.label).join("|"),
            };
        })();

        const data: SkillsContext = {
            ...parentData,
            isCharacter: actor.isOfType("character"),
            follow,
            skills,
            lores,
        };

        return data;
    }

    async _onClickAction(event: PointerEvent, target: HTMLElement) {
        const actor = this.actor;
        const action = target.dataset.action as SkillActionEvent;

        if (![0, 2].includes(event.button)) return;
        if (event.button === 2 && action !== "roll-statistic-action") return;

        switch (action) {
            case "roll-skill": {
                const { slug } = elementDataset<{ slug: SkillSlug }>(target);
                actor.getStatistic(slug)?.roll({ event } as StatisticRollParameters);
                this.parentHUD.closeIf("roll-skill");
                break;
            }

            case "roll-statistic-action": {
                rollStatistic(actor, event, getStatisticDataFromElement(target), {
                    requireVariants: event.button === 2 ? this.getDragData(target) : false,
                    onRoll: () => {
                        this.parentHUD.closeIf("roll-skill");
                    },
                });
                break;
            }

            case "follow-the-expert": {
                const exist = getItemWithSourceId(actor, FOLLOW_THE_EXPERT_EFFECT, "effect");
                if (exist) {
                    return exist.delete();
                }

                const source = await getItemSource(FOLLOW_THE_EXPERT_EFFECT, "EffectPF2e");
                if (!source) return;

                actor.createEmbeddedDocuments("Item", [source]);

                break;
            }
        }
    }
}

async function rollStatistic(
    actor: ActorPF2e,
    event: MouseEvent,
    { variant, agile, map, option, actionId, statistic, dc }: StatisticData,
    {
        requireVariants,
        onRoll,
    }: { requireVariants?: boolean | SidebarDragData; onRoll?: Function } = {}
) {
    if ((actionId === "recall-knowledge" && !statistic) || actionId === "earnIncome") {
        return;
    }

    const action: Action | Function | undefined =
        game.pf2e.actions.get(actionId) ?? game.pf2e.actions[actionId];

    const rollOptions = option ? [`action:${option}`] : undefined;
    if (rollOptions && variant) rollOptions.push(`action:${option}:${variant}`);

    if (actionId === "aid") {
        requireVariants = true;
        dc = 15;
    }

    if (requireVariants) {
        if (
            typeof dc !== "number" &&
            isInstanceOf<SingleCheckAction>(action, "SingleCheckAction") &&
            typeof action.difficultyClass === "object"
        ) {
            dc = action.difficultyClass.value;
        }

        const variants = await getStatisticVariants(actor, actionId, {
            dc,
            statistic,
            agile: map ? agile : undefined,
            dragData: typeof requireVariants === "object" ? requireVariants : undefined,
        });
        if (!variants) return;

        dc = variants.dc;
        agile = variants.agile;
        statistic = variants.statistic;
        event = variants.event ?? event;
    }

    const options = {
        event,
        actors: [actor],
        variant,
        rollOptions,
        modifiers: [] as ModifierPF2e[],
        difficultyClass: dc ? { value: dc } : undefined,
    } satisfies Partial<ActionVariantUseOptions> &
        (SingleCheckActionVariantData | SkillActionOptions);

    if (map) {
        const modifier = new game.pf2e.Modifier({
            label: "PF2E.MultipleAttackPenalty",
            modifier: getMapValue(map, agile),
        });
        options.modifiers.push(modifier);
    }

    if (!action) {
        actor.getStatistic(statistic ?? "")?.roll(options);
    } else if (isInstanceOf<Action>(action, "BaseAction")) {
        (options as SingleCheckActionVariantData).statistic = statistic;
        action.use(options);
    } else if (action) {
        (options as SkillActionOptions).skill = statistic;
        action(options);
    }

    onRoll?.();
}

let STATISTICS: { value: string; label: string }[] | undefined;
function getStatistics(actor: ActorPF2e) {
    STATISTICS ??= (() => {
        const obj = getTranslatedSkills() as Record<SkillSlug | "perception", string>;

        const arr = R.pipe(
            R.entries(obj),
            R.map(([slug, label]) => ({ value: slug, label }))
        );

        arr.push({ value: "perception", label: game.i18n.localize("PF2E.PerceptionLabel") });

        return arr;
    })();

    const statistics = STATISTICS.slice();

    for (const lore of actor.itemTypes.lore) {
        statistics.push({
            value: getLoreSlug(lore),
            label: lore.name,
        });
    }

    return R.sortBy(statistics, R.prop("label"));
}

function getLoreSlug(lore: LorePF2e) {
    const rawLoreSlug = game.pf2e.system.sluggify(lore.name);
    return /\blore\b/.test(rawLoreSlug) ? rawLoreSlug : `${rawLoreSlug}-lore`;
}

async function getStatisticVariants(
    actor: ActorPF2e,
    actionId: string,
    {
        dc,
        statistic,
        agile,
        dragData,
    }: {
        dc?: number;
        statistic?: string;
        agile?: boolean;
        dragData?: SidebarDragData;
    }
) {
    if (actionId === "initiative") {
        actionLabels["initiative"] ??= game.i18n.localize("PF2E.InitiativeLabel");
    }

    return promptDialog<StatisticVariantData>(
        {
            title: actionLabels[actionId] ?? localize("dialogs.variants.title"),
            content: "dialogs/variants",
            classes: ["pf2e-hud-skills"],
            data: {
                i18n: templateLocalize("dialogs.variants"),
                statistics: getStatistics(actor),
                statistic,
                agile,
                dc,
            },
            render: (event, html) => {
                if (!dragData) return;

                const { data, imgSrc } = dragData;
                const dcEl = htmlQuery<HTMLInputElement>(html, "[name='dc']");
                const agileEl = htmlQuery<HTMLInputElement>(html, "[name='agile']");
                const statisticEl = htmlQuery<HTMLInputElement>(html, "[name='statistic']");

                const img = createHTMLElement("img", {
                    classes: ["drag-img"],
                    dataset: { tooltip: localize("dialogs.variants.drag") },
                });

                img.draggable = true;
                img.src = imgSrc;

                htmlQuery(html, ".form-footer")?.append(img);

                img.addEventListener("dragstart", (event) => {
                    const newStatistic = statisticEl?.value;
                    const newAgile = agileEl?.checked;
                    const newDc = dcEl?.valueAsNumber;

                    if (R.isString(statistic)) {
                        data.statistic = newStatistic;
                    }

                    if (R.isNumber(newDc)) {
                        data.dc = newDc;
                    }

                    if (R.isBoolean(newAgile)) {
                        data.agile = newAgile;
                    }

                    setupDragElement(event, img, imgSrc, data, {
                        classes: ["pf2e-hud-draggable"],
                    });
                });
            },
            callback: async (event, btn, html) => {
                const data = createFormData(html) as StatisticVariantData;

                if (event instanceof MouseEvent) {
                    data.event = event;
                }

                return data;
            },
        },
        { width: 280 }
    );
}

function getSkillVariantName(actionId: string, variant: string) {
    const variantLabel = ACTION_VARIANTS[actionId]?.[variant]?.label;
    if (variantLabel) {
        return game.i18n.localize(variantLabel);
    }

    const prefix = SF2E_VARIANTS.includes(actionId) ? "SF2E" : "PF2E";
    const actionKey = game.pf2e.system.sluggify(actionId, { camel: "bactrian" });
    const variantKey = game.pf2e.system.sluggify(variant, { camel: "bactrian" });

    return game.i18n.localize(`${prefix}.Actions.${actionKey}.${variantKey}.Title`);
}

function getMapValue(map: 1 | 2, agile = false) {
    map = Number(map) as 1 | 2;
    return map === 1 ? (agile ? -4 : -5) : agile ? -8 : -10;
}

function getMapLabel(map: 1 | 2, agile: boolean) {
    return game.i18n.format("PF2E.MAPAbbreviationLabel", {
        penalty: getMapValue(map, agile),
    });
}

function getStatisticDataFromElement(el: HTMLElement): StatisticData {
    const actionElement = htmlClosest(el, ".item.statistic");
    const { agile, map, variant, dc } = el.dataset as SkillVariantDataset;

    return {
        ...(actionElement?.dataset as SkillActionDataset),
        map: map ? (Number(map) as 1 | 2) : undefined,
        agile: agile === true || agile === "true",
        variant,
        dc,
    };
}

type SkillActionEvent = "roll-skill" | "roll-statistic-action" | "follow-the-expert";

interface PF2eHudSidebarSkills {
    get actor(): CreaturePF2e;
}

type StatisticData = SkillActionDataset & {
    map?: 1 | 2;
    variant?: string;
    agile?: boolean;
    dc?: number;
};

type StatisticVariantData = {
    statistic: string;
    agile?: boolean;
    dc?: number;
    event?: MouseEvent;
};

type SkillActionDataset = {
    actionId: string;
    itemUuid: string;
    statistic?: SkillSlug | string;
    option?: string;
};

type SkillVariantDataset = {
    variant?: string;
    map?: "1" | "2";
    agile?: StringBoolean | boolean;
    dc?: number;
};

type SharedAction = keyof typeof SHARED_ACTIONS;

type FinalizedSkill = Omit<PreparedSkill, "actions"> & {
    mod: number;
    rank: ZeroToFour;
    rankLabel: string;
    proficient: boolean;
    actions: FinalizedSkillAction[];
};

type FinalizedSkillAction = Omit<PreparedSkillAction, "dataset"> & {
    proficient: boolean;
    dataset: string;
    hasInstance: boolean;
};

type PreparedSkill = {
    slug: string;
    label: string;
    actions: PreparedSkillAction[];
    filterValue: string;
};

type MapVariant = {
    label: string;
    tooltip: string;
    map?: number;
    agile?: boolean;
};

type ActionVariant = {
    slug: string;
    label: string;
    tooltip: string;
};

type PreparedSkillAction = Omit<RawSkillAction, "variants"> & {
    label: string;
    tooltip: string;
    filterValue: string;
    variants: (MapVariant | ActionVariant)[] | undefined;
    dataset: SkillActionDataset;
    dragImg: string;
};

type RawSkillAction = {
    actionId: string;
    uuid: string;
    exclude?: boolean;
    useInstance?: boolean;
    cost?: ActionCost["value"] | ActionCost["type"];
    map?: true;
    agile?: true;
    label?: string;
    trained?: true;
    variants?: string[];
    rollOption?: string;
    condition?: (actor: ActorPF2e) => boolean;
};

type RawSkill = {
    slug: SkillSlug | SkillSlugSfe2 | "perception";
    actions: (SharedAction | RawSkillAction)[];
    sf2e?: boolean;
};

type LoreSkill = {
    modifier: string;
    label: string;
    uuid: string;
    slug: string;
    rank: ZeroToFour;
    rankLabel: string;
    dragImg: string;
};

type SkillsContext = SidebarContext & {
    isCharacter: boolean;
    skills: FinalizedSkill[];
    lores: Maybe<{
        list: LoreSkill[];
        modifierWidth: number;
        filterValue: string;
    }>;
    follow: {
        uuid: string;
        active: boolean;
    };
};

export {
    ACTION_IMAGES,
    ACTION_VARIANTS,
    PF2eHudSidebarSkills,
    SHARED_ACTIONS,
    SKILL_ACTIONS_UUIDS,
    getLoreSlug,
    getMapLabel,
    getSkillVariantName,
    getStatisticDataFromElement,
    getStatisticDragDataFromElement,
    getStatisticVariants,
    getStatistics,
    prepareStatisticAction,
    rollStatistic,
};
export type { FinalizedSkillAction, PreparedSkillAction, RawSkillAction, SkillVariantDataset };
