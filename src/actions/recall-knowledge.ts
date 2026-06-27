import {
    CreaturePF2e,
    NPCPF2e,
    R,
    render,
    signedInteger,
    Statistic,
    SYSTEM,
    ZeroToFour,
    ZeroToThree,
} from "foundry-helpers";
import { DegreeOfSuccess } from "foundry-helpers/dist";

const SKILLS = ["arcana", "computers", "crafting", "medicine", "nature", "occultism", "religion", "society"] as const;

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

let _existingSkills: string[] | undefined;

async function rollRecallKnowledge(actor: CreaturePF2e) {
    const roll = await new Roll("1d20").evaluate({ allowInteractive: false });
    const dieResult = roll.dice[0].total ?? 0;
    const dieSuccess = dieResult === 1 ? "0" : dieResult === 20 ? "3" : "";
    const lores = R.pipe(
        R.values(actor.skills),
        R.filter((skill) => !!skill.lore),
        R.sortBy(R.prop("label")),
    );

    const target = (() => {
        const target = R.only([...game.user.targets])?.actor;
        return target?.isOfType("npc") ? target : undefined;
    })();

    const templateData = {
        dieSuccess,
        dieResult,
        target,
    } as RecallKnowledgeTemplateData;

    if (target) {
        const { standard, skills, lore } = target.identificationDCs;

        const skillsDCs = R.times(4, (i) => standard.progression[i]);
        const loresDCs = lore.map(({ progression }) => R.times(6, (i) => progression[i]));

        const marks = R.map(
            (target.token && actor.synthetics.tokenMarks.get(target.token.uuid)) || [],
            (mark) => `target:mark:${mark}`,
        );

        templateData.skillsDCs = skillsDCs;
        templateData.loresDCs = loresDCs;
        templateData.skills = await Promise.all(
            skills.map((slug) => {
                const skill = actor.skills[slug];
                return rollStatistic(skill, dieResult, { dcs: skillsDCs, marks });
            }),
        );
        templateData.lores = await Promise.all(
            lores.map((lore) => {
                return rollStatistic(lore, dieResult, { marks });
            }),
        );
    } else {
        const skills = R.map(
            (_existingSkills ??= R.filter(SKILLS, (slug) => slug in CONFIG.PF2E.skills)),
            (slug) => actor.skills[slug],
        );

        templateData.skills = await Promise.all([...skills, ...lores].map((skill) => rollStatistic(skill, dieResult)));
    }

    const ChatMessagePF2e = getDocumentClass("ChatMessage");
    const isSecret = !game.pf2e.settings.metagame.secretChecks;

    ChatMessagePF2e.create({
        flavor: await render("recall-knowledge", templateData),
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: isSecret ? (ChatMessage.getWhisperRecipients("GM") as any) : undefined,
        blind: isSecret,
        rolls: [roll] as any,
    });
}

async function rollStatistic(
    statistic: Statistic,
    dieResult: number,
    { dcs, marks = [] }: { dcs?: number[]; marks?: string[] } = {},
): Promise<RolledStatisticData> {
    const { rank, label } = statistic;

    const extraRollOptions = [
        "action:recall-knowledge",
        "skill-check",
        `skill:rank:${rank}`,
        `action:recall-knowledge:${statistic.slug}`,
        ...marks,
    ];

    return new Promise((resolve) => {
        statistic.roll({
            callback: (roll, _, message) => {
                const mod = roll?.options.totalModifier ?? 0;

                const fakeRoll = {
                    dieValue: dieResult,
                    modifier: mod,
                };

                console.log(message.flags[SYSTEM.id]);

                const modifiers = R.map(message.flags[SYSTEM.id].modifiers ?? [], ({ label, modifier }) => {
                    return `${label} ${signedInteger(modifier)}`;
                });

                resolve({
                    checks: dcs?.map((dc) => {
                        if (!dc) return "-";
                        const success = new DegreeOfSuccess(fakeRoll, dc).value;
                        return {
                            ...SUCCESS[success],
                            success,
                        };
                    }),
                    label,
                    mod,
                    modifier: signedInteger(mod),
                    rank: rank ?? 0,
                    rankLabel: game.i18n.localize(`PF2E.ProficiencyLevel${rank ?? 0}`),
                    tooltip: modifiers.join("<br>"),
                    total: dieResult + mod,
                });
            },
            createMessage: false,
            extraRollOptions,
            messageMode: "blind",
            skipDialog: true,
        });
    });
}

type RecallKnowledgeTemplateData = {
    dieResult: number;
    dieSuccess: string;
    lores?: RolledStatisticData[];
    loresDCs?: number[][];
    skills: RolledStatisticData[];
    skillsDCs?: number[];
    target: NPCPF2e | undefined;
};

type RolledStatisticData = {
    checks: Maybe<(string | RolledStatisticChecksData)[]>;
    label: string;
    mod: number;
    modifier: string;
    rank: ZeroToFour;
    rankLabel: string;
    tooltip: string;
    total: number;
};

type RolledStatisticChecksData = {
    icon: string;
    name: string;
    success: ZeroToThree;
};

export { rollRecallKnowledge };
