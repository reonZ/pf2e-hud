import { R, getAlliance, getFlag, getItemWithSourceId, getSetting, localize } from "foundry-pf2e";
import { IWR_DATA, StatsSpeed, StatsStatistic, getSpeeds, getStatistics } from "./base";

const COVER_UUID = "Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi";

const ADJUSTMENTS = {
    normal: {
        value: 2,
        icon: "fa-regular fa-alien-8bit",
        label: "PF2E.NPC.Adjustment.NormalLabel",
    },
    weak: {
        value: 1,
        icon: "fa-thin fa-alien-8bit",
        label: "PF2E.NPC.Adjustment.WeakLabel",
    },
    elite: {
        value: 3,
        icon: "fa-solid fa-alien-8bit",
        label: "PF2E.NPC.Adjustment.EliteLabel",
    },
} as const;

const ALLIANCES = {
    opposition: {
        value: 3,
        icon: "fa-solid fa-face-angry-horns",
        label: "PF2E.Actor.Creature.Alliance.Opposition",
    },
    party: {
        value: 1,
        icon: "fa-solid fa-face-smile-halo",
        label: "PF2E.Actor.Creature.Alliance.Party",
    },
    neutral: {
        value: 2,
        icon: "fa-solid fa-face-meh",
        label: "PF2E.Actor.Creature.Alliance.Neutral",
    },
} as const;

const INFOS = [
    {
        slug: "languages",
        label: "PF2E.Actor.Creature.Language.Plural",
        icon: "fa-solid fa-message-dots",
        tooltipEntries: (actor: ActorPF2e) => {
            if (!actor.isOfType("creature")) return [];
            return actor.system.details.languages.value.map((lang) =>
                game.i18n.localize(CONFIG.PF2E.languages[lang])
            );
        },
    },
    {
        slug: "senses",
        label: "PF2E.Actor.Creature.Sense.Plural",
        icon: "fa-solid fa-signal-stream",
        tooltipEntries: (actor: ActorPF2e) =>
            actor.perception?.senses.map((sense) => sense.label) ?? [],
    },
    {
        slug: "immunities",
        ...IWR_DATA[0],
        tooltipEntries: (actor: ActorPF2e) =>
            actor.attributes.immunities.map((immunity) => immunity.label),
    },
    {
        slug: "resistances",
        ...IWR_DATA[1],
        tooltipEntries: (actor: ActorPF2e) =>
            actor.attributes.resistances.map((resistance) => resistance.label),
    },
    {
        slug: "weaknesses",
        ...IWR_DATA[2],
        tooltipEntries: (actor: ActorPF2e) =>
            actor.attributes.weaknesses.map((weakness) => weakness.label),
    },
] as const;

function getCoverEffect(actor: ActorPF2e) {
    return getItemWithSourceId(actor, COVER_UUID, "effect");
}

function threeStep(action: "adjustment" | "alliance", step: string): ThreeStep {
    const { icon, label, value } =
        action === "adjustment"
            ? ADJUSTMENTS[step as keyof typeof ADJUSTMENTS]
            : ALLIANCES[step as keyof typeof ALLIANCES];

    return {
        icon,
        value,
        action,
        tooltip: localize("hud", action, { value: game.i18n.localize(label) }),
    };
}

function getStatsHeaderExtras(actor: ActorPF2e, hud: AdvancedHUD): StatsHeaderExtras {
    const isNPC = actor.isOfType("npc");
    const isFamiliar = actor.isOfType("familiar");
    const isCharacter = actor.isOfType("character");

    const adjustment = isNPC
        ? threeStep("adjustment", actor.attributes.adjustment ?? "normal")
        : undefined;

    const data: StatsHeaderExtras = {
        isNPC,
        isFamiliar,
        isCharacter,
        isCombatant: isCharacter || isNPC,
        hasCover: !!getCoverEffect(actor),
        resolve: isCharacter ? actor.system.resources.resolve : undefined,
        shield: isCharacter || isNPC ? actor.attributes.shield : undefined,
        adjustment,
    };

    if (isNPC && hud.getSetting("showAlliance")) {
        data.alliance = threeStep("alliance", getAlliance(actor));
    }

    return data;
}

function getAdvancedStats(actor: ActorPF2e, hud: AdvancedHUD): StatsAdvanced {
    const isNPC = actor.isOfType("npc");
    const isArmy = actor.isOfType("army");
    const isHazard = actor.isOfType("hazard");
    const isVehicle = actor.isOfType("vehicle");
    const isCharacter = actor.isOfType("character");
    const isCombatant = isCharacter || isNPC;

    const infoSections = INFOS.map(({ tooltipEntries, label, slug, icon }): InfoSection => {
        const tooltipData = R.pipe(
            tooltipEntries(actor),
            R.filter(R.isTruthy),
            R.map((row) => `<li>${row}</li>`)
        );

        const tooltip = tooltipData.length
            ? `<h4>${game.i18n.localize(label)}</h4><ul>${tooltipData.join("")}</ul>`
            : label;

        return {
            slug,
            icon,
            label,
            tooltip,
            active: tooltipData.length > 0,
        };
    });

    const speeds = getSpeeds(actor).speeds;
    const mainSpeed = ((): StatsSpeed | undefined => {
        if (!speeds?.length) return;

        const selectedSpeed = getFlag<MovementType>(actor, "speed");
        if (selectedSpeed) {
            const index = speeds.findIndex((speed) => speed.type === selectedSpeed);
            if (index !== -1) return speeds.splice(index, 1)[0];
        }

        const landSpeed = speeds[0];
        if (!getSetting("highestSpeed")) return speeds.shift();

        const [_, highestSpeeds] =
            speeds.length === 1
                ? ["", speeds]
                : R.pipe(
                      speeds,
                      R.groupBy((x) => x.total),
                      R.entries(),
                      R.sortBy([(x) => Number(x[0]), "desc"]),
                      R.first()
                  )!;
        if (highestSpeeds.includes(landSpeed)) return speeds.shift();

        const highestSpeed = highestSpeeds[0];
        const index = speeds.findIndex((speed) => speed === highestSpeed);

        return speeds.splice(index, 1)[0];
    })();

    const otherSpeeds = speeds
        ?.map((speed) => `<i class="${speed.icon}"></i> <span>${speed.total}</span>`)
        .join("");

    const data: StatsAdvanced = {
        isNPC,
        isArmy,
        isHazard,
        isVehicle,
        isCharacter,
        isCombatant,
        infoSections,
        mainSpeed,
        level: actor.level,
        dying: isCharacter ? actor.attributes.dying : undefined,
        wounded: isCharacter ? actor.attributes.wounded : undefined,
        recall: isNPC ? actor.identificationDCs.standard.dc : undefined,
        heroPoints: isCharacter ? actor.heroPoints : undefined,
        statistics: getStatistics(actor),
        otherSpeeds: otherSpeeds || undefined,
    };

    if (isCharacter && hud.getSetting("showAlliance")) {
        data.alliance = threeStep("alliance", getAlliance(actor));
    }

    return data;
}

function addDragoverListener(html: HTMLElement) {
    html.addEventListener(
        "dragover",
        () => {
            html.style.setProperty("pointer-events", "none");
            window.addEventListener("dragend", () => html.style.removeProperty("pointer-events"), {
                once: true,
                capture: true,
            });
        },
        true
    );
}

type InfoSection = {
    icon: string;
    label: string;
    active: boolean;
    tooltip: string;
    slug: "languages" | "immunities" | "weaknesses" | "resistances" | "senses";
};

type StatsAdvanced = {
    level: number;
    isNPC: boolean;
    isArmy: boolean;
    isHazard: boolean;
    isVehicle: boolean;
    isCharacter: boolean;
    isCombatant: boolean;
    alliance?: ThreeStep;
    recall: number | undefined;
    dying: ValueAndMax | undefined;
    wounded: ValueAndMax | undefined;
    heroPoints: ValueAndMax | undefined;
    mainSpeed: StatsSpeed | undefined;
    statistics: StatsStatistic[];
    infoSections: InfoSection[];
    otherSpeeds: string | undefined;
};

type ThreeStep = {
    value: 1 | 2 | 3;
    action: string;
    icon: string;
    tooltip: string;
};

type AdvancedHUD = { getSetting(setting: "showAlliance"): boolean };

type StatsHeaderExtras = {
    isNPC: boolean;
    isFamiliar: boolean;
    isCharacter: boolean;
    isCombatant: boolean;
    hasCover: boolean;
    resolve: ValueAndMax | undefined;
    adjustment: ThreeStep | undefined;
    alliance?: ThreeStep;
    shield: HeldShieldData | undefined;
};

export { addDragoverListener, getAdvancedStats, getCoverEffect, getStatsHeaderExtras, threeStep };
export type { StatsAdvanced, StatsHeaderExtras, ThreeStep };
