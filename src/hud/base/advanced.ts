import { useResolve } from "actions";
import {
    ActorPF2e,
    addEnterKeyListeners,
    addListener,
    CharacterPF2e,
    EffectPF2e,
    getSkillLabel,
    HeldShieldData,
    localize,
    MODULE,
    MovementType,
    NPCPF2e,
    R,
    setFlag,
    signedInteger,
    TokenPF2e,
    ValueAndMax,
} from "foundry-helpers";
import {
    addSidebarsListeners,
    addTextNumberInputListeners,
    calculateActorHealth,
    COVER_UUID,
    createSlider,
    getAllSpeeds,
    getCoverEffect,
    getSidebars,
    HealthData,
    HudSpeed,
    NpcNotesHudPopup,
    processSliderEvent,
    SidebarMenu,
    SidebarPF2eHUD,
    SliderData,
} from "hud";
import { getGlobalSetting } from "settings";
import { BaseActorPF2eHUD } from ".";

const ALLIANCE_TYPES = ["party", "neutral", "opposition"] as const;

const ALLIANCE: Record<AllianceType, AllianceData> = {
    neutral: {
        icon: "fa-solid fa-face-meh",
        label: "PF2E.Actor.Creature.Alliance.Neutral",
        value: 2,
    },
    opposition: {
        icon: "fa-solid fa-face-angry-horns",
        label: "PF2E.Actor.Creature.Alliance.Opposition",
        value: 3,
    },
    party: {
        icon: "fa-solid fa-face-smile-halo",
        label: "PF2E.Actor.Creature.Alliance.Party",
        value: 1,
    },
};

const STATISTICS = [
    { slug: "fortitude", icon: "fa-solid fa-chess-rook" },
    { slug: "reflex", icon: "fa-solid fa-person-running" },
    { slug: "will", icon: "fa-solid fa-brain" },
    { slug: "perception", icon: "fa-solid fa-eye" },
    { slug: "stealth", icon: "fa-solid fa-mask" },
    { slug: "athletics", icon: "fa-solid fa-hand-fist" },
] as const;

const INFOS = [
    {
        slug: "languages",
        label: "PF2E.Actor.Creature.Language.Plural",
        icon: "fa-solid fa-message-dots",
        tooltipEntries: (actor) => {
            if (!actor.isOfType("creature")) return [];
            return actor.system.details.languages.value.map((lang) => game.i18n.localize(CONFIG.PF2E.languages[lang]));
        },
    },
    {
        slug: "senses",
        label: "PF2E.Actor.Creature.Sense.Plural",
        icon: "fa-solid fa-signal-stream",
        tooltipEntries: (actor) => {
            return actor.perception?.senses.map((sense) => sense.label).filter(R.isTruthy) ?? [];
        },
    },
    {
        icon: "fa-solid fa-ankh",
        label: "PF2E.ImmunitiesLabel",
        slug: "immunities",
        tooltipEntries: (actor) => {
            return actor.attributes.immunities.map((immunity) => immunity.label);
        },
    },
    {
        icon: "fa-solid fa-shield-virus",
        label: "PF2E.ResistancesLabel",
        slug: "resistances",
        tooltipEntries: (actor) => {
            return actor.attributes.resistances.map((resistance) => resistance.label);
        },
    },
    {
        icon: "fa-solid fa-heart-crack",
        label: "PF2E.WeaknessesLabel",
        slug: "weaknesses",
        tooltipEntries: (actor) => {
            return actor.attributes.weaknesses.map((weakness) => weakness.label);
        },
    },
] as const satisfies InfoDetails[];

function makeAdvancedHUD<TBase extends AbstractConstructorOf<any>>(
    Base: TBase,
): TBase & AbstractConstructorOf<AdvancedPF2eHUD> {
    type ThisAdvancedHUD = BaseActorPF2eHUD & AdvancedPF2eHUD & { get token(): TokenPF2e | undefined };

    abstract class AdvancedPF2eHUD extends Base {
        protected async _prepareContext(
            this: ThisAdvancedHUD,
            _: fa.ApplicationRenderOptions,
        ): Promise<ReturnedAdvancedHudContext> {
            const actor = this.actor;
            if (!actor) {
                return { hasActor: false };
            }

            const health = calculateActorHealth(actor);
            const isNPC = actor.isOfType("npc");
            const isCharacter = actor.isOfType("character");
            const isCombatant = isCharacter || isNPC;

            const sidebars = getSidebars(actor, SidebarPF2eHUD.isParent(this) ? SidebarPF2eHUD.current : null);

            return {
                ac: actor.attributes.ac?.value,
                alliance: isCombatant ? getAllianceData(actor) : undefined,
                hasActor: true,
                hasCover: !!getCoverEffect(actor),
                health,
                infoSections: getInfoSections(actor),
                isCharacter,
                isCombatant,
                isNPC,
                knowledge: isNPC ? getKnowledge(actor) : undefined,
                level: actor.level,
                name: actor.name,
                npcTags: isNPC ? getNpcTags(actor) : undefined,
                partial: (key: string) => MODULE.templatePath("partials", key),
                resolve: isCharacter ? actor.system.resources.resolve : undefined,
                resources: isCharacter ? getResources(actor) : undefined,
                shield: isCombatant ? actor.attributes.shield : undefined,
                sidebars,
                speed: getSpeed(actor),
                statistics: getAdvancedStatistics(actor),
            } satisfies AdvancedHudContext;
        }

        protected _replaceHTML(
            this: ThisAdvancedHUD,
            _result: string,
            content: HTMLElement,
            _options: fa.ApplicationRenderOptions,
        ): void {
            content.dataset.tooltipClass = "pf2e-hud-element";
            content.dataset.tooltipDirection = "UP";
            content.classList.add("advanced");

            this.#activateListeners(content);
        }

        protected _onClickAction(this: ThisAdvancedHUD, event: PointerEvent, target: HTMLElement): void {
            const actor = this.actor;
            const action = target.dataset.action as EventAction;

            if (action === "slider") {
                processSliderEvent(event, target, this.#onSlider.bind(this));
            } else if (action === "update-alliance") {
                this.#updateAlliance(event);
            }

            if (event.button !== 0) return;

            if (action === "change-speed") {
                this.#changeSpeed(target);
            } else if (action === "raise-shield") {
                game.pf2e.actions.raiseAShield({ actors: [actor], event });
            } else if (action === "recovery-check") {
                if (actor?.isOfType("character")) {
                    actor.rollRecovery(event);
                }
            } else if (action === "roll-statistic") {
                this.#rollStatistic(event, target);
            } else if (action === "show-notes") {
                if (actor?.isOfType("npc")) {
                    new NpcNotesHudPopup(actor).render(true);
                }
            } else if (action === "take-cover") {
                this.#takeCover(event);
            } else if (action === "use-resolve") {
                useResolve(actor);
            }
        }

        #onSlider(this: ThisAdvancedHUD, action: "hero" | "wounded" | "dying" | "mythic", direction: 1 | -1) {
            const actor = this.actor;
            if (!actor) return;

            if (actor.isOfType("character")) {
                if (["hero", "mythic"].includes(action)) {
                    const resource = getMythicOrHeroPoints(actor);
                    const newValue = Math.clamp(resource.value + direction, 0, resource.max);

                    if (newValue !== resource.value) {
                        actor.update({ [`system.resources.${resource.name}.value`]: newValue });
                    }

                    return;
                }

                if (action === "dying" || action === "wounded") {
                    const max = actor.system.attributes[action].max;

                    if (direction === 1) {
                        actor.increaseCondition(action, { max });
                    } else {
                        actor.decreaseCondition(action);
                    }

                    return;
                }
            }

            this._onSlider?.(action, direction);
        }

        #rollStatistic(this: ThisAdvancedHUD, event: PointerEvent, target: HTMLElement) {
            const statistic = target.dataset.statistic as string;
            const rollOptions = {
                event,
                extraRollOptions: [] as string[],
            };

            if (["perception", "stealth"].includes(statistic)) {
                rollOptions.extraRollOptions.push("secret");
            }

            this.actor?.getStatistic(statistic)?.roll(rollOptions);
        }

        async #takeCover(this: ThisAdvancedHUD, event: PointerEvent) {
            const actor = this.actor;
            if (!actor?.isOfType("creature")) return;

            const existing = getCoverEffect(actor);

            if (existing) {
                existing.delete();
            } else {
                const source = (await fromUuid<EffectPF2e>(COVER_UUID()))?.toObject();

                if (source) {
                    actor.createEmbeddedDocuments("Item", [source]);
                }
            }
        }

        #changeSpeed(this: ThisAdvancedHUD, target: HTMLElement) {
            const actor = this.actor;
            if (!actor?.isOfType("creature")) return;

            const selected = target.dataset.speed as MovementType;
            const speeds: MovementType[] = R.pipe(
                R.values(actor.movement.speeds),
                R.filter((speed) => R.isTruthy(speed) && speed.type !== "travel"),
                R.map((speed): MovementType => speed!.type as MovementType),
            );

            const speedIndex = speeds.indexOf(selected);
            const newSpeed = speeds[(speedIndex + 1) % speeds.length];

            setFlag(actor, "speed", newSpeed);
        }

        #updateAlliance(this: ThisAdvancedHUD, event: PointerEvent) {
            const actor = this.actor;
            if (!actor?.isOfType("character", "npc") || ![0, 2].includes(event.button)) return;

            const currentAlliance = getAlliance(actor);
            const newAlliance = getListLoopValue(event, ALLIANCE_TYPES, currentAlliance);
            if (newAlliance === currentAlliance) return;

            actor.update({
                "system.details.alliance": newAlliance === "neutral" ? null : newAlliance,
            });
        }

        #activateListeners(this: ThisAdvancedHUD, html: HTMLElement) {
            const actor = this.actor;
            if (!actor) return;

            addSidebarsListeners(this as any, html);
            addEnterKeyListeners(html);
            addTextNumberInputListeners(actor, html);

            addListener(html, `input[type="number"].shield`, "change", (el: HTMLInputElement) => {
                const heldShield = actor.heldShield;
                if (!heldShield) return;

                const { max, value } = heldShield.hitPoints;
                const newValue = Math.clamp(el.valueAsNumber, 0, max);

                if (newValue === value) {
                    el.value = String(value);
                } else {
                    el.value = String(newValue);
                    heldShield.update({ "system.hp.value": newValue });
                }
            });
        }
    }

    return AdvancedPF2eHUD;
}

function getListLoopValue<T>(event: PointerEvent, list: ReadonlyArray<T>, current: T): T {
    if (![0, 2].includes(event.button)) {
        return current;
    }

    if (event.shiftKey) {
        return list.at(event.button === 0 ? list.length - 1 : 0) as T;
    }

    const direction = event.button === 0 ? 1 : -1;
    const currentIndex = list.indexOf(current);

    return list.at((currentIndex + direction) % list.length) as T;
}

function getInfoSections(actor: ActorPF2e) {
    return INFOS.map((info): InfoSection => {
        const tooltipData = R.pipe(
            info.tooltipEntries(actor),
            R.filter(R.isTruthy),
            R.map((row) => `<li>${row}</li>`),
        );

        const tooltip = tooltipData.length
            ? `<h4>${game.i18n.localize(info.label)}</h4><ul>${tooltipData.join("")}</ul>`
            : info.label;

        return {
            ...info,
            active: tooltipData.length > 0,
            tooltip,
        };
    });
}

function getMythicOrHeroPoints(actor: CharacterPF2e): ValueAndMax & { name: "mythicPoints" | "heroPoints" } {
    const name = actor.system.resources.mythicPoints.max ? "mythicPoints" : "heroPoints";
    const resource = name === "mythicPoints" ? actor.system.resources.mythicPoints : actor.system.resources.heroPoints;

    return {
        ...resource,
        name,
    };
}

function getResources(actor: CharacterPF2e): HudResources {
    const mythic = actor.system.resources.mythicPoints;
    const hero = mythic.max
        ? { ...createSlider("mythic", mythic), mythic: true }
        : createSlider("hero", actor.heroPoints);

    return {
        dying: createSlider("dying", actor.attributes.dying),
        hero,
        wounded: createSlider("wounded", actor.attributes.wounded),
    };
}

function getKnowledge(actor: NPCPF2e): AdvancedHudContext["knowledge"] {
    const skills = actor.identificationDCs.skills.map((skill) => getSkillLabel(skill));
    const label = game.i18n.localize("PF2E.RecallKnowledge.Label");
    const tooltip = `${label} (${skills.join(", ")})`;

    return {
        tooltip,
        dc: actor.identificationDCs.standard.dc,
    };
}

function getNpcTags(actor: NPCPF2e): string | undefined {
    const whitelist = R.keys(CONFIG.PF2E.creatureTraits);
    const traits = R.pipe(
        [...actor.traits],
        R.filter((trait) => R.isIncludedIn(trait, whitelist)),
        R.map((trait) => {
            const label = game.i18n.localize(CONFIG.PF2E.creatureTraits[trait]);
            return `<li>${label}</li>`;
        }),
    );

    if (traits.length) {
        return `<h4>${game.i18n.localize("PF2E.Traits")}</h4><ul>${traits.join("")}</ul>`;
    }
}

function getSpeed(actor: ActorPF2e): AdvancedHudContext["speed"] {
    if (!actor.isOfType("creature")) return;

    const allSpeeds = getAllSpeeds(actor);
    if (!allSpeeds) return;

    const { mainSpeed, speeds } = allSpeeds;
    const otherSpeeds = speeds
        .map((speed) => `<li><i class="${speed.icon}"></i> <span>${speed.total}</span></li>`)
        .join("");

    return {
        main: mainSpeed,
        others: otherSpeeds ? `<ul>${otherSpeeds}</ul>` : undefined,
    };
}

function getAdvancedStatistics(actor: ActorPF2e): AdvancedStatistic[] {
    const useModifiers = getGlobalSetting("useModifiers");

    return R.pipe(
        STATISTICS,
        R.map(({ slug, icon }): AdvancedStatistic | undefined => {
            const statistic = actor.getStatistic(slug);
            if (!statistic) return;
            return {
                slug,
                icon,
                label: statistic.label,
                value: useModifiers ? signedInteger(statistic.mod) : statistic.dc.value,
            };
        }),
        R.filter(R.isTruthy),
    );
}

function getAlliance(actor: CharacterPF2e | NPCPF2e): AllianceType {
    const details = actor._source.system.details;
    const allianceSource = "alliance" in details ? details.alliance : undefined;
    const alliance = allianceSource === null ? "neutral" : (allianceSource ?? "default");

    return alliance === "default" ? (actor.hasPlayerOwner ? "party" : "opposition") : alliance;
}

function getAllianceData(actor: CharacterPF2e | NPCPF2e): AllianceData {
    const alliance = getAlliance(actor);
    const data = ALLIANCE[alliance] as AllianceData;
    data.tooltip ??= localize("actor-hud.alliance", { value: game.i18n.localize(data.label) });

    return data;
}

interface IAdvancedPF2eHUD {
    get sidebarCoords(): SidebarCoords;
    get sidebarCeption(): boolean;
}

interface AdvancedPF2eHUD {
    _onSlider(action: string, direction: 1 | -1): void;
    _prepareContext(options: fa.ApplicationRenderOptions): Promise<AdvancedHudContext | {}>;
    _replaceHTML(result: unknown, content: HTMLElement, options: fa.ApplicationRenderOptions): void;
}

type EventAction =
    | "change-speed"
    | "raise-shield"
    | "recovery-check"
    | "roll-statistic"
    | "show-notes"
    | "slider"
    | "take-cover"
    | "use-resolve"
    | "update-alliance";

type SidebarCoords = {
    origin: Point;
    limits: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
};

type ReturnedAdvancedHudContext = AdvancedHudContext | (fa.ApplicationRenderContext & { hasActor: false });

type AdvancedHudContext = fa.ApplicationRenderContext & {
    ac: number | undefined;
    alliance: AllianceData | undefined;
    hasActor: true;
    hasCover: boolean;
    health: HealthData | undefined;
    infoSections: InfoSection[];
    isCharacter: boolean;
    isCombatant: boolean;
    isNPC: boolean;
    knowledge: { tooltip: string; dc: number } | undefined;
    level: number;
    name: string;
    npcTags: string | undefined;
    partial: (key: string) => string;
    resolve: ValueAndMax | undefined;
    resources: HudResources | undefined;
    shield: HeldShieldData | undefined;
    sidebars: SidebarMenu[];
    speed: { main: HudSpeed; others: string | undefined } | undefined;
    statistics: AdvancedStatistic[];
};

type HudResources = {
    dying: SliderData;
    hero: SliderData & { mythic?: boolean };
    wounded: SliderData;
};

type AdvancedStatistic = {
    slug: string;
    icon: string;
    label: string;
    value: string | number | undefined;
};

type AllianceType = (typeof ALLIANCE_TYPES)[number];

type AllianceData = {
    icon: string;
    label: string;
    value: number;
    tooltip?: string;
};

type InfoDetails = {
    icon: string;
    label: string;
    slug: string;
    tooltipEntries: (actor: ActorPF2e) => string[];
};

type InfoSlug = (typeof INFOS)[number]["slug"];

type InfoSection = {
    icon: string;
    label: string;
    active: boolean;
    tooltip: string;
    slug: InfoSlug;
};

export { getAdvancedStatistics, makeAdvancedHUD };
export type {
    AdvancedHudContext,
    AdvancedPF2eHUD,
    AdvancedStatistic,
    IAdvancedPF2eHUD,
    ReturnedAdvancedHudContext,
    SidebarCoords,
};
