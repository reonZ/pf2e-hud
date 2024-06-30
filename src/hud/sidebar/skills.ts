import {
    dataToDatasetString,
    elementDataset,
    getActionIcon,
    getItemWithSourceId,
    getSetting,
    hasItemWithSourceId,
    htmlClosest,
    isInstanceOf,
} from "foundry-pf2e";
import { PF2eHudSidebar, SidebarContext, SidebarName, SidebarRenderOptions } from "./base";

const BON_MOT = "Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf";
const NATURAL_MEDICINE = "Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu";
const FOLLOW_THE_EXPERT = "Compendium.pf2e.actionspf2e.Item.tfa4Sh7wcxCEqL29";
const FOLLOW_THE_EXPERT_EFFECT = "Compendium.pf2e.other-effects.Item.VCSpuc3Tf3XWMkd3";

const SHARED = {
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
    earnIncome: {
        trained: true,
        uuid: "Compendium.pf2e.actionspf2e.Item.QyzlsLrqM0EEwd7j",
    },
    subsist: {
        uuid: "Compendium.pf2e.actionspf2e.Item.49y9Ec4bDii8pcD3",
    },
} satisfies Record<string, Omit<RawSkillAction, "id">>;

const SKILLS: RawSkill[] = [
    {
        slug: "acrobatics",
        actions: [
            {
                id: "balance",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.M76ycLAqHoAgbcej",
            },
            {
                id: "tumble-through",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.21WIfSu7Xd7uKqV8",
            },
            {
                id: "maneuver-in-flight",
                trained: true,
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.Qf1ylAbdVi1rkc8M",
            },
            {
                id: "squeeze",
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
                id: "borrow-arcane-spell",
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
                id: "climb",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.pprgrYQ1QnIDGZiy",
            },
            {
                id: "force-open",
                cost: 1,
                map: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.SjmKHgI7a5Z9JzBx",
            },
            {
                id: "grapple",
                cost: 1,
                map: true,
                agile: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.PMbdMWc2QroouFGD",
            },
            {
                id: "high-jump",
                cost: 2,
                uuid: "Compendium.pf2e.actionspf2e.Item.2HJ4yuEFY1Cast4h",
            },
            {
                id: "long-jump",
                cost: 2,
                uuid: "Compendium.pf2e.actionspf2e.Item.JUvAvruz7yRQXfz2",
            },
            {
                id: "reposition",
                cost: 1,
                map: true,
                agile: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.lOE4yjUnETTdaf2T",
            },
            {
                id: "shove",
                cost: 1,
                map: true,
                agile: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.7blmbDrQFNfdT731",
            },
            {
                id: "swim",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.c8TGiZ48ygoSPofx",
            },
            {
                id: "trip",
                cost: 1,
                map: true,
                agile: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.ge56Lu1xXVFYUnLP",
            },
            {
                id: "disarm",
                cost: 1,
                map: true,
                agile: true,
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.Dt6B1slsBy8ipJu9",
            },
        ],
    },
    {
        slug: "crafting",
        actions: [
            "recall-knowledge",
            {
                id: "repair",
                uuid: "Compendium.pf2e.actionspf2e.Item.bT3skovyLUtP22ME",
            },
            {
                id: "craft",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.rmwa3OyhTZ2i2AHl",
            },
            "earnIncome",
            {
                id: "identify-alchemy",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.Q4kdWVOf2ztIBFg1",
            },
        ],
    },
    {
        slug: "deception",
        actions: [
            {
                id: "create-a-diversion",
                cost: 1,
                variants: ["distracting-words", "gesture", "trick"],
                uuid: "Compendium.pf2e.actionspf2e.Item.GkmbTGfg8KcgynOA",
            },
            {
                id: "impersonate",
                uuid: "Compendium.pf2e.actionspf2e.Item.AJstokjdG6iDjVjE",
            },
            {
                id: "lie",
                uuid: "Compendium.pf2e.actionspf2e.Item.ewwCglB7XOPLUz72",
            },
            {
                id: "feint",
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
                id: "bonMot",
                cost: 1,
                condition: (actor) => hasItemWithSourceId(actor, BON_MOT, "feat"),
                uuid: "Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf",
            },
            {
                id: "gather-information",
                uuid: "Compendium.pf2e.actionspf2e.Item.plBGdZhqq5JBl1D8",
            },
            {
                id: "make-an-impression",
                uuid: "Compendium.pf2e.actionspf2e.Item.OX4fy22hQgUHDr0q",
            },
            {
                id: "request",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.DCb62iCBrJXy0Ik6",
            },
        ],
    },
    {
        slug: "intimidation",
        actions: [
            {
                id: "coerce",
                uuid: "Compendium.pf2e.actionspf2e.Item.tHCqgwjtQtzNqVvd",
            },
            {
                id: "demoralize",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.2u915NdUyQan6uKF",
            },
        ],
    },
    {
        slug: "medicine",
        actions: [
            {
                id: "administer-first-aid",
                cost: 2,
                variants: ["stabilize", "stop-bleeding"],
                rollOption: "administer-first-aid",
                uuid: "Compendium.pf2e.actionspf2e.Item.MHLuKy4nQO2Z4Am1",
            },
            "recall-knowledge",
            {
                id: "treat-disease",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.TC7OcDa7JlWbqMaN",
            },
            {
                id: "treat-poison",
                cost: 1,
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.KjoCEEmPGTeFE4hh",
            },
            {
                id: "treatWounds",
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
                id: "command-an-animal",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.q9nbyIF0PEBqMtYe",
            },
            "recall-knowledge",
            {
                id: "treatWounds",
                trained: true,
                label: "PF2E.Actions.TreatWounds.Label",
                condition: (actor) => hasItemWithSourceId(actor, NATURAL_MEDICINE, "feat"),
                uuid: "Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu",
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
                id: "perform",
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
            "earnIncome",
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
                id: "create-forgery",
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
                id: "conceal-an-object",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.qVNVSmsgpKFGk9hV",
            },
            {
                id: "hide",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.XMcnh4cSI32tljXa",
            },
            {
                id: "sneak",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.VMozDqMMuK5kpoX4",
            },
        ],
    },
    {
        slug: "survival",
        actions: [
            {
                id: "sense-direction",
                uuid: "Compendium.pf2e.actionspf2e.Item.fJImDBQfqfjKJOhk",
            },
            "subsist",
            {
                id: "cover-tracks",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.SB7cMECVtE06kByk",
            },
            {
                id: "track",
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.EA5vuSgJfiHH7plD",
            },
        ],
    },
    {
        slug: "thievery",
        actions: [
            {
                id: "palm-an-object",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.ijZ0DDFpMkWqaShd",
            },
            {
                id: "steal",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.RDXXE7wMrSPCLv5k",
            },
            {
                id: "disable-device",
                cost: 2,
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6",
            },
            {
                id: "pick-a-lock",
                cost: 2,
                trained: true,
                uuid: "Compendium.pf2e.actionspf2e.Item.2EE4aF4SZpYf0R6H",
            },
        ],
    },
];

let skillsCache: PreparedSkill[] | null = null;
function getSkills(actor: ActorPF2e): FinalizedSkill[] {
    skillsCache ??= SKILLS.map((raw) => {
        const actions = raw.actions.map((rawAction) => {
            const [id, action]: [string, Omit<RawSkillAction, "id">] =
                typeof rawAction === "string"
                    ? [rawAction, SHARED[rawAction]]
                    : [rawAction.id, rawAction];

            const actionKey = game.pf2e.system.sluggify(id, { camel: "bactrian" });
            const label = game.i18n.localize(action.label ?? `PF2E.Actions.${actionKey}.Title`);

            const variants: ActionVariant[] | MapVariant[] | undefined = (() => {
                if (action.map) {
                    return [
                        {
                            label: game.i18n.localize("PF2E.Roll.Normal"),
                        },
                        {
                            map: 1,
                            agile: action.agile,
                            label: getMapLabel(1, !!action.agile),
                        },
                        {
                            map: 2,
                            agile: !!action.agile,
                            label: getMapLabel(2, !!action.agile),
                        },
                    ] satisfies MapVariant[];
                }

                return action.variants?.map((slug) => {
                    return {
                        slug,
                        label: getSkillVariantName(id, slug),
                    } satisfies ActionVariant;
                });
            })();

            const dataset = dataToDatasetString<keyof SkillActionDataset>({
                id,
                skillSlug: raw.slug,
                itemUuid: action.uuid,
                option: action.rollOption,
            });

            return {
                ...action,
                variants,
                id,
                label,
                dataset,
                dragImg: getActionIcon(action.cost ?? null),
            } satisfies PreparedSkillAction;
        });

        const label = game.i18n.localize(CONFIG.PF2E.skillList[raw.slug]);

        return {
            actions,
            slug: raw.slug,
            label,
        } satisfies PreparedSkill;
    });

    const isCharacter = actor.isOfType("character");
    const hideUntrained = getSetting("hideUntrained");

    return skillsCache.map((skill) => {
        const { mod, rank, proficient } = actor.getStatistic(skill.slug)!;
        const rankLabel = game.i18n.localize(`PF2E.ProficiencyLevel${rank ?? 0}`);

        const actions = skill.actions
            .filter((action) => {
                if (!isCharacter) {
                    return typeof action.condition !== "function";
                }

                return (
                    (!action.trained || !hideUntrained) &&
                    (typeof action.condition === "function" ? action.condition(actor) : true)
                );
            })
            .map((action) => {
                return {
                    ...action,
                    proficient: !isCharacter || proficient || !action.trained,
                } satisfies FinalizedSkillAction;
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

class PF2eHudSidebarSkills extends PF2eHudSidebar {
    get key(): SidebarName {
        return "skills";
    }

    _getDragData(
        target: HTMLElement,
        baseDragData: Record<string, JSONValue>,
        item: Maybe<ItemPF2e<ActorPF2e>>
    ) {
        const { itemUuid, id, skillSlug } = elementDataset<SkillActionDataset>(
            htmlClosest(target, ".item")!
        );

        return {
            ...target.dataset,
            type: "Item",
            uuid: itemUuid,
            itemType: "action",
            actorLess: true,
            actionId: id,
            skillSlug,
        };
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<SkillsContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);
        const skills = getSkills(actor);
        const follow = {
            uuid: FOLLOW_THE_EXPERT,
            active: hasItemWithSourceId(actor, FOLLOW_THE_EXPERT_EFFECT, "effect"),
        };

        const data: SkillsContext = {
            ...parentData,
            isCharacter: actor.isOfType("character"),
            follow,
            skills,
        };

        return data;
    }

    async _onClickAction(event: PointerEvent, target: HTMLElement) {
        const actor = this.actor;
        const action = target.dataset.action as ActionType;

        const getActionData = () => {
            const actionElement = htmlClosest(target, "[data-skill-slug]")!;
            return actionElement.dataset as SkillActionDataset;
        };

        switch (action) {
            case "roll-skill": {
                const { slug } = elementDataset<{ slug: SkillSlug }>(target);
                actor.getStatistic(slug)?.roll({ event });
                this.parentHUD.closeIf("roll-skill");
                break;
            }

            case "roll-skill-action": {
                const { id, skillSlug, option } = getActionData();

                rollSkillAction(actor, event, skillSlug, id, {
                    ...(target.dataset as SkillVariantDataset),
                    option,
                });

                break;
            }

            case "follow-the-expert": {
                const exist = getItemWithSourceId(actor, FOLLOW_THE_EXPERT_EFFECT, "effect");
                if (exist) {
                    return exist.delete();
                }

                const source = (await fromUuid<EffectPF2e>(FOLLOW_THE_EXPERT_EFFECT))?.toObject();
                if (!source) return;

                actor.createEmbeddedDocuments("Item", [source]);

                break;
            }
        }
    }
}

function rollSkillAction(
    actor: ActorPF2e,
    event: PointerEvent,
    skillSlug: SkillSlug,
    actionId: string,
    { variant, agile, map, option }: SkillVariantDataset & { option?: string }
) {
    const action = game.pf2e.actions.get(actionId) ?? game.pf2e.actions[actionId];

    const rollOptions = option ? [`action:${option}`] : undefined;
    if (rollOptions && variant) rollOptions.push(`action:${option}:${variant}`);

    const options = {
        event,
        actors: [actor],
        variant,
        rollOptions,
        modifiers: [] as ModifierPF2e[],
    } satisfies Partial<ActionVariantUseOptions>;

    if (map) {
        const modifier = new game.pf2e.Modifier({
            label: "PF2E.MultipleAttackPenalty",
            modifier: getMapValue(map, agile === "true"),
        });
        options.modifiers.push(modifier);
    }

    if (!action) {
        actor.getStatistic(skillSlug)?.roll(options);
        return;
    }

    if (isInstanceOf<BaseAction>(action, "BaseAction")) {
        (options as SingleCheckActionVariantData).statistic = skillSlug;
        action.use(options);
    } else if (action) {
        (options as SkillActionOptions).skill = skillSlug;
        action(options);
    }
}

function getSkillVariantName(actionId: string, variant: string) {
    const actionKey = game.pf2e.system.sluggify(actionId, { camel: "bactrian" });
    const variantKey = game.pf2e.system.sluggify(variant, { camel: "bactrian" });
    return game.i18n.localize(`PF2E.Actions.${actionKey}.${variantKey}.Title`);
}

function getMapValue(map: 1 | 2 | "1" | "2", agile: boolean) {
    map = Number(map) as 1 | 2;
    return map === 1 ? (agile ? -4 : -5) : agile ? -8 : -10;
}

function getMapLabel(map: 1 | 2, agile: boolean) {
    return game.i18n.format("PF2E.MAPAbbreviationLabel", {
        penalty: getMapValue(map, agile),
    });
}

type ActionType = "roll-skill" | "roll-skill-action" | "follow-the-expert";

type SkillActionDataset = {
    id: string;
    itemUuid: string;
    skillSlug: SkillSlug;
    option?: string;
};

type SkillVariantDataset = {
    variant?: string;
    map?: "1" | "2";
    agile?: StringBoolean;
};

type ShareSkill = keyof typeof SHARED;

type FinalizedSkill = Omit<PreparedSkill, "actions"> & {
    mod: number;
    rank: ZeroToFour;
    rankLabel: string;
    proficient: boolean;
    actions: FinalizedSkillAction[];
};

type FinalizedSkillAction = PreparedSkillAction & {
    proficient: boolean;
};

type PreparedSkill = {
    slug: string;
    label: string;
    actions: PreparedSkillAction[];
};

type MapVariant = {
    label: string;
    map?: number;
    agile?: boolean;
};

type ActionVariant = {
    slug: string;
    label: string;
};

type PreparedSkillAction = Omit<RawSkillAction, "variants"> & {
    label: string;
    variants: (MapVariant | ActionVariant)[] | undefined;
    dataset: string;
    dragImg: string;
};

type RawSkillAction = {
    id: string;
    uuid: string;
    cost?: 1 | 2;
    map?: true;
    agile?: true;
    label?: string;
    trained?: true;
    variants?: string[];
    rollOption?: string;
    condition?: (actor: ActorPF2e) => boolean;
};

type RawSkill = {
    slug: SkillSlug;
    actions: (ShareSkill | RawSkillAction)[];
};

type SkillsContext = SidebarContext & {
    isCharacter: boolean;
    skills: FinalizedSkill[];
    follow: {
        uuid: string;
        active: boolean;
    };
};

export { PF2eHudSidebarSkills, getMapLabel, getSkillVariantName };
export type { SkillVariantDataset };
