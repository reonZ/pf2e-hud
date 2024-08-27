import { R, canObserveActor, getSetting, htmlClosest, signedInteger } from "foundry-pf2e";

const IWR_DATA = [
    { type: "immunities", icon: "fa-solid fa-ankh", label: "PF2E.ImmunitiesLabel" },
    { type: "resistances", icon: "fa-solid fa-shield-virus", label: "PF2E.ResistancesLabel" },
    { type: "weaknesses", icon: "fa-solid fa-heart-crack", label: "PF2E.WeaknessesLabel" },
] as const;

const SPEEDS_ICONS = {
    land: "fa-solid fa-shoe-prints",
    burrow: "fa-solid fa-chevrons-down",
    climb: "fa-solid fa-spider",
    fly: "fa-solid fa-feather",
    swim: "fa-solid fa-person-swimming",
};

const STATISTICS = [
    { slug: "fortitude", icon: "fa-solid fa-chess-rook" },
    { slug: "reflex", icon: "fa-solid fa-person-running" },
    { slug: "will", icon: "fa-solid fa-brain" },
    { slug: "perception", icon: "fa-solid fa-eye" },
    { slug: "stealth", icon: "fa-solid fa-mask" },
    { slug: "athletics", icon: "fa-solid fa-hand-fist" },
] as const;

function getHealth(actor: ActorPF2e): HealthData | undefined {
    const hp = actor.attributes.hp as CharacterHitPoints | undefined;
    if (!hp?.max) return;

    const isCharacter = actor.isOfType("character");
    const useStamina = isCharacter && game.pf2e.settings.variants.stamina;
    const currentHP = Math.clamp(hp.value, 0, hp.max);
    const maxSP = (useStamina && hp.sp?.max) || 0;
    const currentSP = Math.clamp((useStamina && hp.sp?.value) || 0, 0, maxSP);
    const currentTotal = currentHP + currentSP;
    const maxTotal = hp.max + maxSP;

    const calculateRatio = (value: number, max: number) => {
        const ratio = value / max;
        return {
            ratio,
            hue: ratio * ratio * 122 + 3,
        };
    };

    return {
        value: currentHP,
        max: hp.max,
        ...calculateRatio(currentHP, hp.max),
        temp: hp.temp,
        sp: {
            value: currentSP,
            max: maxSP,
            ...calculateRatio(currentSP, maxSP),
        },
        useStamina,
        total: {
            value: currentTotal,
            max: maxTotal,
            ...calculateRatio(currentTotal, maxTotal),
        },
    };
}

function getStatsHeader(actor: ActorPF2e): StatsHeader {
    const isArmy = actor.isOfType("army");
    const data: StatsHeader = {
        health: getHealth(actor),
        ac: isArmy ? actor.system.ac.value : actor.attributes.ac?.value,
        scouting: isArmy ? signedInteger(actor.scouting.mod) : undefined,
        hardness: actor.isOfType("vehicle", "hazard") ? actor.attributes.hardness : undefined,
    };
    return data;
}

function getSpeeds(actor: ActorPF2e): StatsSpeeds {
    const speeds = actor.isOfType("creature")
        ? R.pipe(
              [actor.attributes.speed, ...actor.attributes.speed.otherSpeeds] as const,
              R.filter(
                  ({ total, type }) => type === "land" || (typeof total === "number" && total > 0)
              ),
              R.map(({ type, total, label }) => ({
                  icon: SPEEDS_ICONS[type],
                  total,
                  label,
                  type,
              }))
          )
        : [];

    const speedNote = actor.isOfType("npc")
        ? actor.attributes.speed.details
        : actor.isOfType("vehicle")
        ? actor.system.details.speed
        : undefined;

    return {
        speeds,
        speedNote,
    };
}

function getStatistics(actor: ActorPF2e) {
    const useModifiers = getSetting("useModifiers");

    return R.pipe(
        STATISTICS,
        R.map(({ slug, icon }): StatsStatistic | undefined => {
            const statistic = actor.getStatistic(slug);
            if (!statistic) return;
            return {
                slug,
                icon,
                label: statistic.label,
                value: useModifiers ? signedInteger(statistic.mod) : statistic.dc.value,
            };
        }),
        R.filter(R.isTruthy)
    );
}

function getItemFromElement<T extends ItemPF2e>(
    el: HTMLElement,
    actor: ActorPF2e
): T | null | Promise<T | null> {
    const element = htmlClosest(el, ".item");
    if (!element) return null;

    const { parentId, itemId, itemUuid, itemType, actionIndex, entryId } = element.dataset;

    const item = parentId
        ? actor.inventory.get(parentId, { strict: true }).subitems.get(itemId, { strict: true })
        : itemUuid
        ? fromUuid<T>(itemUuid)
        : entryId
        ? actor.spellcasting?.collections
              .get(entryId, { strict: true })
              .get(itemId, { strict: true }) ?? null
        : itemType === "condition"
        ? actor.conditions.get(itemId, { strict: true })
        : actionIndex
        ? actor.system.actions?.[Number(actionIndex)].item ?? null
        : actor.items.get(itemId ?? "") ?? null;

    return item as T | null | Promise<T | null>;
}

function userCanObserveActor(actor: ActorPF2e) {
    return (
        canObserveActor(actor, true) ||
        (getSetting("partyAsObserved") && actor?.system.details.alliance === "party")
    );
}

type StatsStatistic = {
    slug: string;
    icon: string;
    label: string;
    value: string | number | undefined;
};

type StatsSpeed = {
    icon: string;
    total: number | undefined;
    label: string | undefined;
    type: "land" | "burrow" | "climb" | "fly" | "swim";
};

type StatsSpeeds = {
    speeds: StatsSpeed[];
    speedNote: string | undefined;
};

type StatsHeader = {
    health: HealthData | undefined;
    ac: number | undefined;
    hardness: number | undefined;
    scouting: string | undefined;
};

type HealthData = {
    temp: number;
    sp: {
        ratio: number;
        hue: number;
        value: number;
        max: number;
    };
    useStamina: boolean;
    total: {
        ratio: number;
        hue: number;
        value: number;
        max: number;
    };
    ratio: number;
    hue: number;
    value: number;
    max: number;
};

export {
    IWR_DATA,
    getHealth,
    getItemFromElement,
    getSpeeds,
    getStatistics,
    getStatsHeader,
    userCanObserveActor,
};
export type { HealthData, StatsHeader, StatsSpeed, StatsSpeeds, StatsStatistic };
