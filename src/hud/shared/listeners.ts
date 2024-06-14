import { R, addListener, addListenerAll, elementDataset, htmlClosest, setFlag } from "foundry-pf2e";
import { getCoverEffect } from "./advanced";
import { getItemFromElement } from "./base";

const ADJUSTMENTS_INDEX = ["weak", null, "elite"] as const;

function addEnterKeyListeners(html: HTMLElement) {
    addListenerAll(html, "input", "keyup", (event, el) => {
        if (event.key === "Enter") el.blur();
    });
}

function addStatsHeaderListeners(actor: ActorPF2e, html: HTMLElement, token?: TokenPF2e | null) {
    addEnterKeyListeners(html);

    addListenerAll(html, "input[type='number']", "change", (event, el: HTMLInputElement) => {
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
            const heldShield = actor.heldShield;
            if (heldShield) {
                heldShield.update({ "system.hp.value": value });
            }
        } else {
            actor.update({ [path]: value });
        }
    });

    addListenerAll(html, "[data-action]:not(.disabled)", (event, el) => {
        const action = el.dataset.action as StatsHeaderActionEvent;

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

function addStatsAdvancedListeners(actor: ActorPF2e, html: HTMLElement) {
    addListenerAll(html, "[data-action]:not(.disabled)", (event, el) => {
        const action = el.dataset.action as StatsAdvancedActionEvent;

        switch (action) {
            case "roll-statistic": {
                const { statistic } = elementDataset(el);
                actor.getStatistic(statistic)?.roll({ event });
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
        addListenerAll(html, "[data-slider-action]:not(.disabled)", "mousedown", (event, el) => {
            if (![0, 2].includes(event.button)) return;

            const action = el.dataset.sliderAction as StatsAdvancedSliderEvent;
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
}

function addSendItemToChatListeners(
    actor: ActorPF2e,
    html: HTMLElement,
    onSendToChat?: () => void
) {
    addListenerAll(html, "[data-action='send-to-chat']", async (event, el) => {
        const item = await getItemFromElement(actor, el);
        if (!item) return;

        if (item.isOfType("spell")) {
            const castRank = Number(htmlClosest(el, "[data-cast-rank]")?.dataset.castRank ?? NaN);
            item.toMessage(event, { data: { castRank } });
        } else {
            item.toMessage(event);
        }

        onSendToChat?.();
    });
}

type StatsHeaderActionEvent = "take-cover" | "raise-shield";

type StatsAdvancedActionEvent =
    | "use-resolve"
    | "show-notes"
    | "recovery-chec"
    | "recall-knowledge"
    | "roll-statistic"
    | "open-sidebar"
    | "change-speed";

type StatsAdvancedSliderEvent = "hero" | "wounded" | "dying";

export {
    addEnterKeyListeners,
    addSendItemToChatListeners,
    addStatsAdvancedListeners,
    addStatsHeaderListeners,
};
