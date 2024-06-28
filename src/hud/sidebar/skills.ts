import { addListenerAll, elementDataset, hasItemWithSourceId } from "foundry-pf2e";
import { PF2eHudSidebar, SidebarContext, SidebarName, SidebarRenderOptions } from "./base";

const BON_MOT_UUID = "Compendium.pf2e.feats-srd.Item.0GF2j54roPFIDmXf";
const NATURAL_MEDICINE_UUID = "Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu";

const SHARED = {
    "recall-knowledge": {
        cost: 1,
        uuid: "Compendium.pf2e.actionspf2e.Item.1OagaWtBpVXExToo",
    },
    "decipher-writing": {
        uuid: "Compendium.pf2e.actionspf2e.Item.d9gbpiQjChYDYA2L",
    },
    "identify-magic": {
        uuid: "Compendium.pf2e.actionspf2e.Item.eReSHVEPCsdkSL4G",
    },
    "learn-a-spell": {
        uuid: "Compendium.pf2e.actionspf2e.Item.Q5iIYCFdqJFM31GW",
    },
    earnIncome: {
        uuid: "Compendium.pf2e.actionspf2e.Item.QyzlsLrqM0EEwd7j",
    },
    subsist: {
        uuid: "Compendium.pf2e.actionspf2e.Item.49y9Ec4bDii8pcD3",
    },
};

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
        ],
        trained: [
            {
                id: "maneuver-in-flight",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.Qf1ylAbdVi1rkc8M",
            },
            {
                id: "squeeze",
                uuid: "Compendium.pf2e.actionspf2e.Item.kMcV8e5EZUxa6evt",
            },
        ],
    },
    {
        slug: "arcana",
        actions: ["recall-knowledge"],
        trained: [
            {
                id: "borrow-arcane-spell",
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
        ],
        trained: [
            {
                id: "disarm",
                cost: 1,
                map: true,
                agile: true,
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
        ],
        trained: [
            {
                id: "craft",
                uuid: "Compendium.pf2e.actionspf2e.Item.rmwa3OyhTZ2i2AHl",
            },
            "earnIncome",
            {
                id: "identify-alchemy",
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
        ],
        trained: [
            {
                id: "feint",
                cost: 1,
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
                condition: (actor) => hasItemWithSourceId(actor, BON_MOT_UUID, "feat"),
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
        ],
        trained: [
            {
                id: "treat-disease",
                uuid: "Compendium.pf2e.actionspf2e.Item.TC7OcDa7JlWbqMaN",
            },
            {
                id: "treat-poison",
                cost: 1,
                uuid: "Compendium.pf2e.actionspf2e.Item.KjoCEEmPGTeFE4hh",
            },
            {
                id: "treatWounds",
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
        ],
        trained: [
            {
                id: "treatWounds",
                condition: (actor) => hasItemWithSourceId(actor, NATURAL_MEDICINE_UUID, "feat"),
                uuid: "Compendium.pf2e.feats-srd.Item.WC4xLBGmBsdOdHWu",
            },
            "identify-magic",
            "learn-a-spell",
        ],
    },
    {
        slug: "occultism",
        actions: ["recall-knowledge"],
        trained: ["decipher-writing", "identify-magic", "learn-a-spell"],
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
                    "keyboards",
                    "oratory",
                    "percussion",
                    "singing",
                    "strings",
                    "winds",
                ],
                uuid: "Compendium.pf2e.actionspf2e.Item.EEDElIyin4z60PXx",
            },
        ],
        trained: ["earnIncome"],
    },
    {
        slug: "religion",
        actions: ["recall-knowledge"],
        trained: ["decipher-writing", "identify-magic", "learn-a-spell"],
    },
    {
        slug: "society",
        actions: ["recall-knowledge", "subsist"],
        trained: [
            {
                id: "create-forgery",
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
        ],
        trained: [
            {
                id: "cover-tracks",
                uuid: "Compendium.pf2e.actionspf2e.Item.SB7cMECVtE06kByk",
            },
            {
                id: "track",
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
        ],
        trained: [
            {
                id: "disable-device",
                cost: 2,
                uuid: "Compendium.pf2e.actionspf2e.Item.cYdz2grcOcRt4jk6",
            },
            {
                id: "pick-a-lock",
                cost: 2,
                uuid: "Compendium.pf2e.actionspf2e.Item.2EE4aF4SZpYf0R6H",
            },
        ],
    },
];

class PF2eHudSidebarSkills extends PF2eHudSidebar {
    get key(): SidebarName {
        return "skills";
    }

    // _getDragData(
    //     { actionIndex, element }: DOMStringMap,
    //     baseDragData: Record<string, JSONValue>,
    //     item: Maybe<ItemPF2e<ActorPF2e>>
    // ) {
    //     return { frominventory: true };
    // }

    async _prepareContext(options: SidebarRenderOptions): Promise<SkillsContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);

        const skills = SKILLS.map(({ slug, actions, trained }) => {
            const { label, mod, rank } = actor.getStatistic(slug)!;

            return {
                mod,
                rank: rank ?? 1,
                slug,
                label,
            };
        });

        const data: SkillsContext = {
            ...parentData,
            skills,
        };

        return data;
    }

    _activateListeners(html: HTMLElement) {
        const actor = this.actor;

        addListenerAll(html, "[data-action='roll-skill']", (event, el) => {
            const { slug } = elementDataset<SkillDataset>(el);
            actor.getStatistic(slug)?.roll({ event });
            this.parentHUD.closeIf("roll-skill");
        });
    }
}

type SkillDataset = {
    slug: SkillSlug;
};

type ShareSkill = keyof typeof SHARED;

type RawSkillAction = {
    id: string;
    uuid: string;
    cost?: 1 | 2;
    map?: true;
    agile?: true;
    variants?: string[];
    rollOption?: string;
    condition?: (actor: ActorPF2e) => boolean;
};

type RawSkill = {
    slug: SkillSlug;
    actions: (ShareSkill | RawSkillAction)[];
    trained?: (ShareSkill | RawSkillAction)[];
};

type SkillsContext = SidebarContext & {
    skills: {
        slug: SkillSlug;
        label: string;
        mod: number;
        rank: ZeroToFour;
    }[];
};

export { PF2eHudSidebarSkills };
