import { R, getSetting } from "pf2e-api";

const SPEEDS_ICONS = {
    land: "fa-solid fa-shoe-prints",
    burrow: "fa-solid fa-chevrons-down",
    climb: "fa-solid fa-spider",
    fly: "fa-solid fa-feather",
    swim: "fa-solid fa-person-swimming",
};

const SAVES_ICONS = {
    fortitude: "fa-solid fa-chess-rook",
    reflex: "fa-solid fa-person-running",
    will: "fa-solid fa-brain",
};

const OTHER_ICONS = {
    perception: "fa-solid fa-eye",
    stealth: "fa-duotone fa-eye-slash",
    athletics: "fa-solid fa-hand-fist",
};

const OTHER_SLUGS = R.keys.strict(OTHER_ICONS);

const TARGET_ICONS = {
    selected: "fa-solid fa-expand",
    targeted: "fa-solid fa-crosshairs-simple",
    persistent: "fa-solid fa-image-user",
    character: "fa-solid fa-user",
};

const IWR = {
    immunities: { icon: "fa-solid fa-ankh", label: "PF2E.ImmunitiesLabel" },
    resistances: { icon: "fa-solid fa-heart-crack", label: "PF2E.WeaknessesLabel" },
    weaknesses: { icon: "fa-solid fa-shield-virus", label: "PF2E.ResistancesLabel" },
};

const IWR_SLUGS = R.keys.strict(IWR);

const ADJUSTMENTS = {
    normal: { icon: "fa-regular fa-alien-8bit", label: "PF2E.NPC.Adjustment.NormalLabel" },
    weak: { icon: "fa-thin fa-alien-8bit", label: "PF2E.NPC.Adjustment.WeakLabel" },
    elite: { icon: "fa-solid fa-alien-8bit", label: "PF2E.NPC.Adjustment.EliteLabel" },
};

const ADJUSTMENTS_INDEX = ["weak", null, "elite"] as const;

const ALLIANCES_ICONS = {
    opposition: "fa-solid fa-face-angry-horns",
    party: "fa-solid fa-face-smile-halo",
    neutral: "fa-solid fa-face-meh",
};

function canObserve(actor: ActorPF2e | null | undefined) {
    if (!actor) return false;
    return (
        actor.testUserPermission(game.user, "OBSERVER") ||
        (getSetting("partyObserved") && actor.system.details.alliance === "party")
    );
}

function getAlliance(actor: ActorPF2e): {
    defaultAlliance: "party" | "opposition";
    originalAlliance: "party" | "opposition" | "neutral" | "default";
    alliance: "party" | "opposition" | "neutral";
    icon: string;
    label: string;
} {
    const allianceSource = actor._source.system.details?.alliance;
    const originalAlliance = allianceSource === null ? "neutral" : allianceSource ?? "default";
    const defaultAlliance = actor.hasPlayerOwner ? "party" : "opposition";
    const alliance = originalAlliance === "default" ? defaultAlliance : originalAlliance;
    const localizedAlliance = game.i18n.localize(
        `PF2E.Actor.Creature.Alliance.${alliance.capitalize()}`
    );
    const label =
        originalAlliance === "default"
            ? game.i18n.format("PF2E.Actor.Creature.Alliance.Default", {
                  alliance: game.i18n.localize(localizedAlliance),
              })
            : localizedAlliance;

    return {
        defaultAlliance,
        originalAlliance,
        alliance,
        icon: ALLIANCES_ICONS[alliance],
        label,
    };
}

export {
    ADJUSTMENTS,
    ADJUSTMENTS_INDEX,
    ALLIANCES_ICONS,
    IWR,
    IWR_SLUGS,
    OTHER_ICONS,
    OTHER_SLUGS,
    SAVES_ICONS,
    SPEEDS_ICONS,
    TARGET_ICONS,
    canObserve,
    getAlliance,
};
