import {
    R,
    addListener,
    addListenerAll,
    elementData,
    getFlag,
    saveTypes,
    setFlag,
    signedInteger,
} from "pf2e-api";

const COVER_UUID = "Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi";

const SHARED_PARTIALS = [
    "numbers",
    "slider",
    "infos",
    "armor",
    "statistics",
    "stamina",
    "health",
    "level",
    "sidebars",
];

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

const IWR_DATA = {
    immunities: { icon: "fa-solid fa-ankh", label: "PF2E.ImmunitiesLabel" },
    resistances: { icon: "fa-solid fa-shield-virus", label: "PF2E.ResistancesLabel" },
    weaknesses: { icon: "fa-solid fa-heart-crack", label: "PF2E.WeaknessesLabel" },
};
const IWR_SLUGS = R.keys.strict(IWR_DATA);

const INFOS = {
    languages: {
        label: "PF2E.Actor.Creature.Language.Plural",
        icon: "fa-solid fa-message-dots",
        createTooltip: (actor: ActorPF2e) => {
            if (!actor.isOfType("creature")) return [];
            return actor.system.details.languages.value.map((lang) =>
                game.i18n.localize(CONFIG.PF2E.languages[lang])
            );
        },
    },
    senses: {
        label: "PF2E.Actor.Creature.Sense.Plural",
        icon: "fa-solid fa-signal-stream",
        createTooltip: (actor: ActorPF2e) =>
            actor.perception?.senses.map((sense) => sense.label) ?? [],
    },
    immunities: {
        ...IWR_DATA.immunities,
        createTooltip: (actor: ActorPF2e) =>
            actor.attributes.immunities.map((immunity) => immunity.label),
    },
    resistances: {
        ...IWR_DATA.resistances,
        createTooltip: (actor: ActorPF2e) =>
            actor.attributes.resistances.map((resistance) => resistance.label),
    },
    weaknesses: {
        ...IWR_DATA.weaknesses,
        createTooltip: (actor: ActorPF2e) =>
            actor.attributes.weaknesses.map((weakness) => weakness.label),
    },
};
const INFO_SLUGS = R.keys.strict(INFOS);

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
    return actor.testUserPermission(game.user, "OBSERVER");
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

    const calculateRation = (value: number, max: number) => {
        const ratio = value / max;
        return {
            ratio,
            hue: ratio * ratio * 122 + 3,
        };
    };

    return {
        value: currentHP,
        max: hp.max,
        ...calculateRation(currentHP, hp.max),
        temp: hp.temp,
        sp: {
            value: currentSP,
            max: maxSP,
            ...calculateRation(currentSP, maxSP),
        },
        useStamina,
        total: {
            value: currentTotal,
            max: maxTotal,
            ...calculateRation(currentTotal, maxTotal),
        },
    };
}

function getDefaultData(actor: ActorPF2e, useModifier?: boolean): BaseActorData {
    const isOwner = actor.isOwner;
    const isObserver = canObserve(actor);
    const isNPC = actor.isOfType("npc");
    const isArmy = actor.isOfType("army");
    const isHazard = actor.isOfType("hazard");
    const isVehicle = actor.isOfType("vehicle");
    const isCreature = actor.isOfType("creature");
    const isCharacter = actor.isOfType("character");

    const getStatistics = (statistics: ReadonlyArray<string>, icons: Record<string, string>) => {
        return R.pipe(
            statistics,
            R.map((slug) => {
                const statistic = actor.getStatistic(slug);
                if (!statistic) return;

                const mod = signedInteger(statistic.mod);
                const dc = statistic.dc.value;

                return {
                    dc,
                    mod,
                    slug,
                    label: statistic.label,
                    icon: icons[statistic.slug],
                    value: useModifier ? mod : useModifier === false ? dc : undefined,
                };
            }),
            R.compact
        );
    };

    const speeds = isCreature
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

    const speedNote = isNPC
        ? actor.attributes.speed.details
        : isVehicle
        ? actor.system.details.speed
        : undefined;

    return {
        isOwner,
        isObserver,
        isNPC,
        isArmy,
        isHazard,
        isVehicle,
        isCreature,
        isCharacter,
        speedNote,
        speeds,
        saves: isCreature || isVehicle ? getStatistics(saveTypes, SAVES_ICONS) : [],
        others: isCreature ? getStatistics(OTHER_SLUGS, OTHER_ICONS) : [],
        recall: isNPC ? actor.identificationDCs.standard.dc : undefined,
        heroPoints: isCharacter ? actor.heroPoints : undefined,
    };
}

function getAdvancedHealthData(actor: ActorPF2e): AdvancedHealthData {
    const isNPC = actor.isOfType("npc");
    const isCharacter = actor.isOfType("character");

    return {
        hasCover: !!getCoverEffect(actor),
        ac: actor.isOfType("army") ? actor.system.ac.value : actor.attributes.ac?.value,
        resolve: isCharacter ? actor.system.resources.resolve : undefined,
        shield: isCharacter || isNPC ? actor.attributes.shield : undefined,
        adjustment: (isNPC && ADJUSTMENTS[actor.attributes.adjustment ?? "normal"]) || undefined,
    };
}

function addUpdateActorFromInput(parent: HTMLElement, actor: ActorPF2e) {
    addListenerAll(parent, "input[type='number']", "keyup", (event, el) => {
        if (event.key === "Enter") {
            el.blur();
        }
    });

    addListenerAll(parent, "input[type='number']", "change", (event, el: HTMLInputElement) => {
        let path = el.name;
        let value = Math.max(el.valueAsNumber, 0);

        const cursor = foundry.utils.getProperty(actor, path);
        if (cursor === undefined || Number.isNaN(value)) return;

        if (
            R.isObjectType<{ value: number; max: number } | null>(cursor) &&
            "value" in cursor &&
            "max" in cursor
        ) {
            path += ".value";
            value = Math.min(el.valueAsNumber, cursor.max);
        }

        if (path === "system.attributes.shield.hp.value") {
            const heldShield = actor.isOfType("creature") ? actor.heldShield : undefined;
            if (heldShield) {
                heldShield.update({ "system.hp.value": value });
            }
        } else {
            actor.update({ [path]: value });
        }
    });
}

function addSharedListeners(html: HTMLElement, actor: ActorPF2e) {
    addListenerAll(html, "[data-action]:not(.disabled)", (event, el) => {
        const action = elementData<{ action: ActionEvent }>(el).action;

        switch (action) {
            case "roll-statistic": {
                const slug = elementData<{ statistic: string }>(el).statistic;
                actor.getStatistic(slug)?.roll({ event });
                break;
            }
            case "change-speed": {
                const selected = elementData<{ speed: MovementType }>(el).speed;
                const speeds: MovementType[] = [
                    "land",
                    ...(actor as CreaturePF2e).attributes.speed.otherSpeeds.map(
                        (speed) => speed.type
                    ),
                ];
                const speedIndex = speeds.indexOf(selected);
                const newSpeed = speeds[(speedIndex + 1) % speeds.length];
                setFlag(actor, "speed", newSpeed);
                break;
            }
        }
    });

    addListenerAll(html, "[data-slider-action]:not(.disabled)", "mousedown", (event, el) => {
        if (![0, 2].includes(event.button)) return;

        const action = elementData<{ sliderAction: SliderEvent }>(el).sliderAction;
        const direction = event.button === 0 ? 1 : -1;

        switch (action) {
            case "hero": {
                const { max, value } = (actor as CharacterPF2e).heroPoints;
                const newValue = Math.clamp(value + direction, 0, max);
                if (newValue !== value) {
                    actor.update({ "system.resources.heroPoints.value": newValue });
                }
                break;
            }
            case "dying":
            case "wounded": {
                const max = (actor as CharacterPF2e).system.attributes[action].max;
                if (direction === 1) {
                    actor.increaseCondition(action, { max });
                } else {
                    actor.decreaseCondition(action);
                }
                break;
            }
        }
    });
}

function addArmorListeners(html: HTMLElement, actor: ActorPF2e, token?: TokenPF2e | null) {
    addListenerAll(html, "[data-action]:not(.disabled)", (event, el) => {
        const action = elementData<{ action: AmorEvent }>(el).action;

        switch (action) {
            case "raise-shield": {
                game.pf2e.actions.raiseAShield({ actors: [actor], event });
                break;
            }
            case "take-cover": {
                const existing = getCoverEffect(actor);
                if (existing) {
                    existing.delete();
                } else {
                    const options: Partial<ActionUseOptions> = { actors: [actor], event };
                    if (token) options.tokens = [token];
                    game.pf2e.actions.get("take-cover")?.use(options);
                }
                break;
            }
        }
    });

    if (actor.isOfType("npc")) {
        addListener(html, "[data-slider-action='adjustment']", "mousedown", (event) => {
            if (![0, 2].includes(event.button)) return;

            const direction = event.button === 0 ? 1 : -1;
            const currentAdjustment = actor.attributes.adjustment ?? null;
            const currentIndex = ADJUSTMENTS_INDEX.indexOf(currentAdjustment);
            const adjustment = ADJUSTMENTS_INDEX[Math.clamp(currentIndex + direction, 0, 2)];

            if (adjustment !== currentAdjustment) {
                return actor.applyAdjustment(adjustment);
            }
        });
    }
}

function getCoverEffect(actor: ActorPF2e) {
    return actor?.itemTypes.effect.find((effect) => effect.flags.core?.sourceId === COVER_UUID);
}

function getAdvancedData(
    actor: ActorPF2e,
    { speeds }: BaseActorData,
    { fontSize, useHighestSpeed }: { fontSize: number; useHighestSpeed: boolean }
): AdvancedActorData {
    const isCharacter = actor.isOfType("character");

    const mainSpeed = ((): AdvancedMainSpeed | undefined => {
        if (!speeds?.length) return;

        const selectedSpeed = getFlag<MovementType>(actor, "speed");
        if (selectedSpeed) {
            const index = speeds.findIndex((speed) => speed.type === selectedSpeed);
            if (index !== -1) return speeds.splice(index, 1)[0];
        }

        const landSpeed = speeds[0];
        if (!useHighestSpeed) return speeds.shift();

        const [_, highestSpeeds] =
            speeds.length === 1
                ? ["", speeds]
                : R.pipe(
                      speeds,
                      R.groupBy((x) => x.total),
                      R.toPairs.strict,
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

    const infoSections = INFO_SLUGS.map((section): AdvancedInfoSection => {
        const info = INFOS[section];
        const tooltipData = R.compact(info.createTooltip(actor)).map((row) => `<li>${row}</li>`);

        const tooltip = tooltipData.length
            ? `<div class="pf2e-hud-left">
            <h4>${game.i18n.localize(info.label)}</h4>
            <ul>${tooltipData.join("")}</ul>
        </div>`
            : info.label;

        return {
            section,
            tooltip,
            active: tooltipData.length > 0,
            icon: info.icon,
            label: info.label,
        };
    });

    return {
        dying: isCharacter ? actor.attributes.dying : undefined,
        wounded: isCharacter ? actor.attributes.wounded : undefined,
        mainSpeed,
        infoSections,
        otherSpeeds: otherSpeeds
            ? `<div class="pf2e-hud-iconed-list" style="--font-size: ${fontSize}px">${otherSpeeds}</div>`
            : undefined,
    };
}

type AdvancedActorData = {
    otherSpeeds: string | undefined;
    dying: ValueAndMax | undefined;
    wounded: ValueAndMax | undefined;
    infoSections: AdvancedInfoSection[];
    mainSpeed: AdvancedMainSpeed | undefined;
};

type AdvancedInfoSection = {
    icon: string;
    label: string;
    active: boolean;
    tooltip: string;
    section: "languages" | "immunities" | "weaknesses" | "resistances" | "senses";
};

type AdvancedMainSpeed = {
    icon: string;
    total: number;
    label: string;
    type: "land" | "burrow" | "climb" | "fly" | "swim";
};

type AdvancedHealthData = {
    ac: number | undefined;
    hasCover: boolean;
    resolve: ValueAndMax | undefined;
    adjustment: (typeof ADJUSTMENTS)[keyof typeof ADJUSTMENTS] | undefined;
    shield: HeldShieldData | undefined;
};

type ActionEvent =
    | "use-resolve"
    | "show-notes"
    | "recovery-chec"
    | "recall-knowledge"
    | "roll-statistic"
    | "open-sidebar"
    | "change-speed";

type SliderEvent = "hero" | "wounded" | "dying";

type AmorEvent = "take-cover" | "raise-shield";

type StatisticData = {
    slug: string;
    label: string;
    icon: string;
    mod: string;
    dc: number;
    value?: string | number;
};

type BaseActorData = {
    isNPC: boolean;
    isArmy: boolean;
    isHazard: boolean;
    isVehicle: boolean;
    isCreature: boolean;
    isCharacter: boolean;
    isOwner: boolean;
    isObserver: boolean;
    speedNote: string | undefined;
    saves: StatisticData[];
    others: StatisticData[];
    recall: number | undefined;
    heroPoints: ValueAndMax | undefined;
    speeds: {
        icon: string;
        total: number;
        label: string;
        type: "land" | "burrow" | "climb" | "fly" | "swim";
    }[];
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
    ADJUSTMENTS,
    ADJUSTMENTS_INDEX,
    ALLIANCES_ICONS,
    IWR_DATA,
    IWR_SLUGS,
    OTHER_ICONS,
    OTHER_SLUGS,
    SAVES_ICONS,
    SHARED_PARTIALS,
    SPEEDS_ICONS,
    addArmorListeners,
    addSharedListeners,
    addUpdateActorFromInput,
    canObserve,
    getAdvancedData,
    getAdvancedHealthData,
    getAlliance,
    getCoverEffect,
    getDefaultData,
    getHealth,
};
export type { AdvancedActorData, AdvancedHealthData, BaseActorData, HealthData };
