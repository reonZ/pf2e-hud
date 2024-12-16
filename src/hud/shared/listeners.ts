import {
    ActionUseOptions,
    ActorPF2e,
    CharacterPF2e,
    CreaturePF2e,
    MovementType,
    NPCPF2e,
    R,
    StatisticRollParameters,
    TokenPF2e,
    addListener,
    addListenerAll,
    elementDataset,
    getAlliance,
    getMythicOrHeroPoints,
    isValidClickEvent,
    render,
    setFlag,
    traitSlugToObject,
} from "module-helpers";
import { useResolve } from "../../actions/resolve";
import { PF2eHudTextPopup } from "../popup/text";
import { getCoverEffect } from "./advanced";

const ADJUSTMENTS_INDEX = ["weak", null, "elite"] as const;
const ALLIANCES_INDEX = ["party", "neutral", "opposition"] as const;

function addEnterKeyListeners(html: HTMLElement) {
    addListenerAll(html, "input", "keyup", (event, el) => {
        if (event.key === "Enter") el.blur();
    });
}

function addStatsHeaderListeners(actor: ActorPF2e, html: HTMLElement, token?: TokenPF2e | null) {
    addEnterKeyListeners(html);

    const textNumbers = html.querySelectorAll<HTMLInputElement>("input[type='text'].text-number");
    for (const el of textNumbers) {
        const cursor = foundry.utils.getProperty(actor, el.name);
        if (cursor === undefined) continue;

        const cursorIsObject =
            R.isObjectType<{ value: number; max: number } | null>(cursor) &&
            "value" in cursor &&
            "max" in cursor;

        const path = cursorIsObject ? `${el.name}.value` : el.name;
        const min = Number(el.dataset.min) || 0;
        const step = Number(el.dataset.step) || 1;
        const max = cursorIsObject ? cursor.max : Number(el.dataset.max) || Infinity;

        const wheelListener = (event: WheelEvent) => {
            const value = Number(el.value);
            const direction = event.deltaY >= 0 ? -1 : +1;
            const newValue = Math.clamp(value + step * direction, min, max);

            el.value = String(newValue);
        };

        el.addEventListener("focus", (event) => {
            el.setSelectionRange(0, -1);
            el.addEventListener("wheel", wheelListener);
        });

        el.addEventListener("blur", (event) => {
            el.removeEventListener("wheel", wheelListener);

            const input = el.value;
            const current: number = foundry.utils.getProperty(actor, path) ?? 0;
            const isNegative = input.startsWith("-");
            const isDelta = input.startsWith("+") || isNegative;
            const isPercent = input.endsWith("%");
            const valueStr = input.slice(isDelta ? 1 : 0, isPercent ? -1 : undefined);
            const valueNum = Math.abs(Number(valueStr));

            if (isNaN(valueNum)) {
                el.value = String(current);
                return;
            }

            const calculatedValue = isPercent
                ? cursorIsObject
                    ? Math.floor(max * (valueNum / 100))
                    : Math.floor(Math.abs(current) * (valueNum / 100))
                : valueNum;

            const processedValue = isDelta
                ? current + calculatedValue * (isNegative ? -1 : 1)
                : calculatedValue;

            const value = Math.clamp(processedValue, min, max);

            if (value === current) {
                el.value = String(current);
                return;
            }

            el.value = String(value);

            if (path === "system.attributes.shield.hp.value") {
                const heldShield = actor.heldShield;
                if (heldShield) {
                    heldShield.update({ "system.hp.value": value });
                }
            } else {
                actor.update({ [path]: value });
            }
        });
    }

    addListenerAll(html, "[data-action]:not(.disabled)", async (event, el) => {
        const action = el.dataset.action as StatsHeaderActionEvent;

        switch (action) {
            case "show-notes": {
                const rollData = actor.getRollData();
                const system = (actor as NPCPF2e).system;
                const title = `${actor.name} - ${game.i18n.localize("PF2E.NPC.NotesTab")}`;
                const whitelist = Object.keys(CONFIG.PF2E.creatureTraits);

                const publicNotes = await TextEditor.enrichHTML(system.details.publicNotes, {
                    rollData,
                    secrets: actor.isOwner,
                });
                const privateNotes = await TextEditor.enrichHTML(system.details.privateNotes, {
                    rollData,
                });

                const traits = R.pipe(
                    system.traits.value,
                    R.filter((trait) => whitelist.includes(trait)),
                    R.map((trait) => traitSlugToObject(trait, CONFIG.PF2E.creatureTraits))
                );

                const content = await render("popup/show-notes", {
                    traits,
                    blurb: system.details.blurb.trim(),
                    publicNotes: publicNotes.trim(),
                    privateNotes: actor.isOwner && privateNotes.trim(),
                });

                new PF2eHudTextPopup({ actor, content, event, title }).render(true);
                break;
            }

            case "use-resolve": {
                useResolve(actor as CharacterPF2e);
                break;
            }

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
        addAllianceListener(actor, html);

        addListener(html, "[data-step-action='adjustment']", "mousedown", (event) => {
            if (![0, 2].includes(event.button)) return;

            const direction = event.button === 0 ? 1 : -1;
            const currentAdjustment = actor.attributes.adjustment ?? null;
            const currentIndex = ADJUSTMENTS_INDEX.indexOf(currentAdjustment);
            const adjustment = ADJUSTMENTS_INDEX[Math.clamp(currentIndex + direction, 0, 2)];

            if (adjustment !== currentAdjustment) {
                actor.applyAdjustment(adjustment);
            }
        });
    }
}

function addAllianceListener(actor: CharacterPF2e | NPCPF2e, html: HTMLElement) {
    addListener(html, "[data-step-action='alliance']", "mousedown", (event) => {
        if (![0, 2].includes(event.button)) return;

        const direction = (event.button === 0 ? 1 : -1) * (event.shiftKey ? 2 : 1);
        const alliance = getAlliance(actor);
        const currentIndex = ALLIANCES_INDEX.indexOf(alliance);
        const newAlliance = ALLIANCES_INDEX[Math.clamp(currentIndex + direction, 0, 2)];
        if (newAlliance === alliance) return;

        actor.update({
            "system.details.alliance": newAlliance === "neutral" ? null : newAlliance,
        });
    });
}

function addStatsAdvancedListeners(actor: ActorPF2e, html: HTMLElement) {
    addListenerAll(html, "[data-action]:not(.disabled)", (event, el) => {
        const action = el.dataset.action as StatsAdvancedActionEvent;

        switch (action) {
            case "roll-statistic": {
                const { statistic } = elementDataset(el);
                const extraRollOptions = ["perception", "stealth"].includes(statistic)
                    ? ["secret"]
                    : [];

                actor
                    .getStatistic(statistic)
                    ?.roll({ event, extraRollOptions } as StatisticRollParameters);
                break;
            }
            case "change-speed": {
                const selected = el.dataset.speed as MovementType;
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

    if (actor.isOfType("character")) {
        addAllianceListener(actor, html);

        addListener(html, "[data-action='recovery-check']:not(.disabled)", (event) => {
            actor.rollRecovery(event);
        });

        addListenerAll(html, "[data-slider-action]:not(.disabled)", "mousedown", (event, el) => {
            if (!isValidClickEvent(event)) return;

            const action = el.dataset.sliderAction as StatsAdvancedSliderEvent;
            const direction = event.button === 0 ? 1 : -1;

            switch (action) {
                case "mythic":
                case "hero": {
                    const resource = getMythicOrHeroPoints(actor);
                    const newValue = Math.clamp(resource.value + direction, 0, resource.max);
                    if (newValue !== resource.value) {
                        actor.update({ [`system.resources.${resource.name}.value`]: newValue });
                    }
                    break;
                }

                case "dying":
                case "wounded": {
                    const max = actor.system.attributes[action].max;
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
}

type StatsHeaderActionEvent = "take-cover" | "raise-shield" | "show-notes" | "use-resolve";

type StatsAdvancedActionEvent = "roll-statistic" | "change-speed";

type StatsAdvancedSliderEvent = "hero" | "wounded" | "dying" | "mythic";

export { addEnterKeyListeners, addStatsAdvancedListeners, addStatsHeaderListeners };
