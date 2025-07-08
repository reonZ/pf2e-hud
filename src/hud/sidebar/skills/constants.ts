import { R } from "module-helpers";
import { RawBaseActionData, StatisticType } from "..";

const FOLLOW_THE_EXPERT = "Compendium.pf2e.actionspf2e.Item.tfa4Sh7wcxCEqL29";
const FOLLOW_THE_EXPERT_EFFECT = "Compendium.pf2e.other-effects.Item.VCSpuc3Tf3XWMkd3";

const CHIRURGEON = "Compendium.pf2e.classfeatures.Item.eNZnx4LISDNftbx2";

const UNTRAINED_IMPROVISATION = [
    "Compendium.pf2e.feats-srd.Item.KcbSxOPYC5CUqbZQ", // Cleaver Improviser
    "Compendium.pf2e.feats-srd.Item.73JyUrJnH3nOQJM5", // Ceremony of Knowledge
    "Compendium.pf2e.feats-srd.Item.jNrpvEqfncdGZPak", // Halfling Ingenuity
    "Compendium.pf2e.feats-srd.Item.TOyqtUUnOkOLl1Pm", // Eclectic Skill
];

const SHARED_ACTIONS = {
    "recall-knowledge": {
        actionCost: 1,
        sourceId: "Compendium.pf2e.actionspf2e.Item.1OagaWtBpVXExToo",
    },
    "decipher-writing": {
        sourceId: "Compendium.pf2e.actionspf2e.Item.d9gbpiQjChYDYA2L",
        requireTrained: true,
    },
    "identify-magic": {
        sourceId: "Compendium.pf2e.actionspf2e.Item.eReSHVEPCsdkSL4G",
        requireTrained: true,
    },
    "learn-a-spell": {
        sourceId: "Compendium.pf2e.actionspf2e.Item.Q5iIYCFdqJFM31GW",
        requireTrained: true,
    },
    "disable-device": {
        actionCost: 2,
        sourceId: "Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6",
        requireTrained: true,
    },
    subsist: {
        sourceId: "Compendium.pf2e.actionspf2e.Item.49y9Ec4bDii8pcD3",
    },
} satisfies Record<string, Omit<SkillActionData, "key">>;

const RAW_STATISTICS: RawStatisticActionGroup[] = [
    {
        statistic: "perception",
        actions: [
            {
                key: "seek",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.BlAOM2X92SI6HMtJ",
            },
            {
                key: "sense-motive",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.1xRFPTFtWtGJ9ELw",
            },
        ],
    },
    {
        statistic: "acrobatics",
        actions: [
            {
                key: "balance",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.M76ycLAqHoAgbcej",
            },
            {
                key: "tumble-through",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.21WIfSu7Xd7uKqV8",
            },
            {
                key: "maneuver-in-flight",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.Qf1ylAbdVi1rkc8M",
                requireTrained: true,
            },
            {
                key: "squeeze",
                sourceId: "Compendium.pf2e.actionspf2e.Item.kMcV8e5EZUxa6evt",
                requireTrained: true,
            },
        ],
    },
    {
        statistic: "arcana",
        actions: [
            {
                key: "borrow-arcane-spell",
                sourceId: "Compendium.pf2e.actionspf2e.Item.OizxuPb44g3eHPFh",
                label: "borrowArcaneSpell",
                requireTrained: true,
            },
            "recall-knowledge",
            "decipher-writing",
            "identify-magic",
            "learn-a-spell",
        ],
    },
    {
        statistic: "athletics",
        actions: [
            {
                key: "climb",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.pprgrYQ1QnIDGZiy",
            },
            {
                key: "force-open",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.SjmKHgI7a5Z9JzBx",
                variants: { agile: false },
            },
            {
                key: "grapple",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.PMbdMWc2QroouFGD",
                variants: { agile: true },
            },
            {
                key: "high-jump",
                actionCost: 2,
                sourceId: "Compendium.pf2e.actionspf2e.Item.2HJ4yuEFY1Cast4h",
            },
            {
                key: "long-jump",
                actionCost: 2,
                sourceId: "Compendium.pf2e.actionspf2e.Item.JUvAvruz7yRQXfz2",
            },
            {
                key: "reposition",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.lOE4yjUnETTdaf2T",
                variants: { agile: true },
            },
            {
                key: "shove",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.7blmbDrQFNfdT731",
                variants: { agile: true },
            },
            {
                key: "swim",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.c8TGiZ48ygoSPofx",
            },
            {
                key: "trip",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.ge56Lu1xXVFYUnLP",
                variants: { agile: true },
            },
            {
                key: "disarm",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.Dt6B1slsBy8ipJu9",
                requireTrained: true,
                variants: { agile: true },
            },
        ],
    },
    {
        statistic: "computers",
        actions: [
            {
                key: "access-infosphere",
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.Yn4jLPVWVE1vtAaF",
            },
            {
                key: "hack",
                requireTrained: true,
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.RF8xNJ8QsMwogerB",
            },
            {
                key: "program",
                requireTrained: true,
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.9zvazWNY5tKbMFnC",
            },
            "recall-knowledge",
            "decipher-writing",
            "disable-device",
        ],
        sf2e: true,
    },
    {
        statistic: "crafting",
        actions: [
            {
                key: "repair",
                sourceId: "Compendium.pf2e.actionspf2e.Item.bT3skovyLUtP22ME",
            },
            {
                key: "craft",
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.rmwa3OyhTZ2i2AHl",
            },
            {
                key: "identify-alchemy",
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.Q4kdWVOf2ztIBFg1",
            },
            "recall-knowledge",
        ],
    },
    {
        statistic: "deception",
        actions: [
            {
                key: "create-a-diversion",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.GkmbTGfg8KcgynOA",
                variants: ["distracting-words", "gesture", "trick"],
            },
            {
                key: "impersonate",
                sourceId: "Compendium.pf2e.actionspf2e.Item.AJstokjdG6iDjVjE",
            },
            {
                key: "lie",
                sourceId: "Compendium.pf2e.actionspf2e.Item.ewwCglB7XOPLUz72",
            },
            {
                key: "feint",
                actionCost: 1,
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.QNAVeNKtHA0EUw4X",
            },
        ],
    },
    {
        statistic: "diplomacy",
        actions: [
            {
                key: "bonMot",
                actionCost: 1,
                sourceId: "Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf",
                useInstance: true,
            },
            {
                key: "gather-information",
                sourceId: "Compendium.pf2e.actionspf2e.Item.plBGdZhqq5JBl1D8",
            },
            {
                key: "make-an-impression",
                sourceId: "Compendium.pf2e.actionspf2e.Item.OX4fy22hQgUHDr0q",
            },
            {
                key: "request",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.DCb62iCBrJXy0Ik6",
            },
        ],
    },
    {
        statistic: "intimidation",
        actions: [
            {
                key: "coerce",
                sourceId: "Compendium.pf2e.actionspf2e.Item.tHCqgwjtQtzNqVvd",
            },
            {
                key: "demoralize",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.2u915NdUyQan6uKF",
            },
        ],
    },
    {
        statistic: "medicine",
        actions: [
            {
                key: "administer-first-aid",
                actionCost: 2,
                variants: ["stabilize", "stop-bleeding"],
                rollOptions: ["administer-first-aid"],
                sourceId: "Compendium.pf2e.actionspf2e.Item.MHLuKy4nQO2Z4Am1",
            },
            {
                key: "treat-disease",
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.TC7OcDa7JlWbqMaN",
            },
            {
                key: "treat-poison",
                actionCost: 1,
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.KjoCEEmPGTeFE4hh",
            },
            {
                key: "treatWounds",
                label: "PF2E.Actions.TreatWounds.Label",
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.1kGNdIIhuglAjIp9",
            },
            "recall-knowledge",
        ],
    },
    {
        statistic: "nature",
        actions: [
            {
                key: "command-an-animal",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.q9nbyIF0PEBqMtYe",
            },
            {
                key: "treatWounds",
                requireTrained: true,
                label: "PF2E.Actions.TreatWounds.Label",
                sourceId: "Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu",
                useInstance: true,
            },
            "recall-knowledge",
            "identify-magic",
            "learn-a-spell",
        ],
    },
    {
        statistic: "occultism",
        actions: [
            "recall-knowledge", //
            "decipher-writing",
            "identify-magic",
            "learn-a-spell",
        ],
    },
    {
        statistic: "performance",
        actions: [
            {
                key: "perform",
                actionCost: 1,
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
                sourceId: "Compendium.pf2e.actionspf2e.Item.EEDElIyin4z60PXx",
            },
        ],
    },
    {
        statistic: "piloting",
        actions: [
            "recall-knowledge",
            {
                key: "drive",
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.OxF2dvUCdTYHrnIm",
                variants: ["drive1", "drive2", "drive3"],
            },
            {
                key: "navigate",
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.hsUKPqTdAvWwsqH2",
            },
            {
                key: "plot-course",
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.LXqcXRayK58inaKo",
            },
            {
                key: "run-over",
                actionCost: 3,
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.FisNbAu9pdMnz6vF",
            },
            {
                key: "stop",
                actionCost: 1,
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.3oL5ap2Qb00Saaz9",
            },
            {
                key: "stunt",
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.ailFBRjKuGCOAsCR",
                actionCost: 1,
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
                key: "take-control",
                actionCost: 1,
                sourceId: "Compendium.starfinder-field-test-for-pf2e.actions.Item.9Msf0P33UR5mNRuz",
            },
        ],
        sf2e: true,
    },
    {
        statistic: "religion",
        actions: [
            "recall-knowledge", //
            "decipher-writing",
            "identify-magic",
            "learn-a-spell",
        ],
    },
    {
        statistic: "society",
        actions: [
            {
                key: "create-forgery",
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.ftG89SjTSa9DYDOD",
            },
            "recall-knowledge",
            "subsist",
            "decipher-writing",
        ],
    },
    {
        statistic: "stealth",
        actions: [
            {
                key: "avoid-notice",
                sourceId: "Compendium.pf2e.actionspf2e.Item.IE2nThCmoyhQA0Jn",
            },
            {
                key: "conceal-an-object",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.qVNVSmsgpKFGk9hV",
            },
            {
                key: "hide",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.XMcnh4cSI32tljXa",
            },
            {
                key: "sneak",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.VMozDqMMuK5kpoX4",
            },
        ],
    },
    {
        statistic: "survival",
        actions: [
            {
                key: "sense-direction",
                sourceId: "Compendium.pf2e.actionspf2e.Item.fJImDBQfqfjKJOhk",
            },
            "subsist",
            {
                key: "cover-tracks",
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.SB7cMECVtE06kByk",
            },
            {
                key: "track",
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.EA5vuSgJfiHH7plD",
            },
        ],
    },
    {
        statistic: "thievery",
        actions: [
            {
                key: "palm-an-object",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.ijZ0DDFpMkWqaShd",
            },
            {
                key: "steal",
                actionCost: 1,
                sourceId: "Compendium.pf2e.actionspf2e.Item.RDXXE7wMrSPCLv5k",
            },
            "disable-device",
            {
                key: "pick-a-lock",
                actionCost: 2,
                requireTrained: true,
                sourceId: "Compendium.pf2e.actionspf2e.Item.2EE4aF4SZpYf0R6H",
            },
        ],
    },
];

const SKILLS_KEYS = RAW_STATISTICS.flatMap(({ actions }) => {
    return actions.map((action) => {
        return R.isString(action) ? action : action.key;
    });
});

const SKILLS_TYPES: StatisticType[] = [];

function getSkillKeys(): string[] {
    return SKILLS_KEYS.slice();
}

function getStatisticTypes(): StatisticType[] {
    if (!SKILLS_TYPES.length) {
        SKILLS_TYPES.push(
            ...R.keys(CONFIG.PF2E.skills),
            ...(["perception", "computers", "piloting"] as const)
        );
    }

    return SKILLS_TYPES;
}

type SkillActionData = RawBaseActionData & {
    img?: ImageFilePath;
    label?: string;
    requireTrained?: boolean;
    sf2e?: boolean;
    /** the item must be present on the actor to show up */
    useInstance?: boolean;
};

type RawStatisticActionGroup = {
    actions: (SkillActionData | SharedActionKey)[];
    statistic: StatisticType;
    sf2e?: boolean;
};

type SharedActionKey = keyof typeof SHARED_ACTIONS;

export {
    CHIRURGEON,
    FOLLOW_THE_EXPERT,
    FOLLOW_THE_EXPERT_EFFECT,
    getSkillKeys,
    getStatisticTypes,
    RAW_STATISTICS,
    SHARED_ACTIONS,
    UNTRAINED_IMPROVISATION,
};
export type { SkillActionData };
