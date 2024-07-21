import { DegreeOfSuccess, R, render, signedInteger, templateLocalize } from "foundry-pf2e";

const SKILLS = [
    "arcana",
    "crafting",
    "medicine",
    "nature",
    "occultism",
    "religion",
    "society",
] as const;

const SUCCESS = {
    0: {
        icon: '<i class="fa-solid fa-xmark-large"></i><i class="fa-solid fa-xmark-large"></i>',
        name: "criticalFailure",
    },
    1: { icon: '<i class="fa-solid fa-xmark-large"></i>', name: "failure" },
    2: { icon: '<i class="fa-solid fa-check"></i>', name: "success" },
    3: {
        icon: '<i class="fa-solid fa-check"></i><i class="fa-solid fa-check"></i>',
        name: "criticalSuccess",
    },
} as const;

async function rollRecallKnowledge(actor: CreaturePF2e) {
    const roll = await new Roll("1d20").evaluate();
    const dieResult = roll.dice[0].total!;
    const dieSuccess = dieResult === 1 ? "0" : dieResult === 20 ? "3" : "";
    const lores = Object.values(actor.skills).filter((skill) => skill.lore);

    const target = (() => {
        const target = R.only([...game.user.targets])?.actor;
        return target?.isOfType("npc") ? target : undefined;
    })();

    const templateData = {
        dieSuccess,
        dieResult,
        target,
        i18n: templateLocalize("actions.recall-knowledge"),
    } as RecallKnowledgeTemplateData;

    if (target) {
        const { standard, skills, lore } = target.identificationDCs;

        let skillsDCs = standard.progression.slice();
        skillsDCs.length = 4;
        skillsDCs = [...skillsDCs];

        const loresDCs = lore.map(({ progression }) => {
            const dcs = progression;
            dcs.length = 6;
            return [...dcs];
        });

        templateData.skillsDCs = skillsDCs;
        templateData.loresDCs = loresDCs;

        templateData.skills = await Promise.all(
            skills.map((slug) => {
                const skill = actor.skills[slug];
                return rollStatistic(skill, dieResult, skillsDCs);
            })
        );

        templateData.lores = await Promise.all(lores.map((lore) => rollStatistic(lore, dieResult)));
    } else {
        templateData.skills = await Promise.all(
            [...SKILLS.map((slug) => actor.skills[slug]), ...lores].map((skill) =>
                rollStatistic(skill, dieResult)
            )
        );
    }

    const isSecret = !game.pf2e.settings.metagame.secretChecks;

    ChatMessage.create({
        flavor: await render("chat/recall-knowledge", templateData),
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: isSecret ? ChatMessage.getWhisperRecipients("GM") : undefined,
        blind: isSecret,
        rolls: [roll],
    });
}

async function rollStatistic(
    statistic: Statistic,
    dieResult: number,
    dcs?: number[]
): Promise<RolledStatisticData> {
    const { rank, label } = statistic;

    const roll = (await statistic.roll({
        createMessage: false,
        skipDialog: true,
        extraRollOptions: [
            "action:recall-knowledge",
            "skill-check",
            `skill:rank:${rank}`,
            `action:recall-knowledge:${statistic.slug}`,
        ],
    }))!;

    const mod = roll.total - roll.dice[0].total!;

    const fakeRoll = {
        dieValue: dieResult,
        modifier: mod,
    };

    return {
        mod,
        rank: rank ?? 0,
        label,
        total: dieResult + mod,
        modifier: signedInteger(mod),
        rankLabel: game.i18n.localize(`PF2E.ProficiencyLevel${rank ?? 0}`),
        checks: dcs?.map((dc) => {
            if (!dc) return "-";
            const success = new DegreeOfSuccess(fakeRoll, dc).value;
            return {
                ...SUCCESS[success],
                success,
            };
        }),
    };
}

type RecallKnowledgeTemplateData = {
    dieSuccess: string;
    dieResult: number;
    target: NPCPF2e | undefined;
    i18n: ReturnType<typeof templateLocalize>;
    skillsDCs?: number[];
    loresDCs?: number[][];
    skills: RolledStatisticData[];
    lores?: RolledStatisticData[];
};

type RolledStatisticData = {
    mod: number;
    rank: ZeroToFour;
    label: string;
    total: number;
    modifier: string;
    rankLabel: string;
    checks: Maybe<(string | RolledStatisticChecksData)[]>;
};

type RolledStatisticChecksData = {
    success: ZeroToThree;
    icon: string;
    name: string;
};

export { rollRecallKnowledge };
