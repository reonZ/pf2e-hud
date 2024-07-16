import {
    R,
    addListener,
    addListenerAll,
    elementDataset,
    getAlliance,
    hasItemWithSourceId,
    htmlClosest,
    isOwnedItem,
    localize,
    promptDialog,
    render,
    setFlag,
    templateLocalize,
    unownedItemtoMessage,
    warn,
} from "foundry-pf2e";
import { PF2eHudTextPopup } from "../popup/text";
import { getCoverEffect } from "./advanced";
import { getItemFromElement } from "./base";

const RESOLVE_UUID = "Compendium.pf2e.feats-srd.Item.jFmdevE4nKevovzo";
const ADJUSTMENTS_INDEX = ["weak", null, "elite"] as const;
const ALLIANCES_INDEX = ["party", "neutral", "opposition"] as const;

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
                    R.map((trait) => ({
                        label: game.i18n.localize(CONFIG.PF2E.creatureTraits[trait]) ?? trait,
                        description:
                            game.i18n.localize(CONFIG.PF2E.traitsDescriptions[trait]) ?? "",
                    }))
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

function addAllianceListener(actor: ActorPF2e, html: HTMLElement) {
    addListener(html, "[data-step-action='alliance']", "mousedown", (event) => {
        if (![0, 2].includes(event.button)) return;

        const direction = (event.button === 0 ? 1 : -1) * (event.shiftKey ? 2 : 1);
        const { defaultAlliance, alliance } = getAlliance(actor);
        const currentIndex = ALLIANCES_INDEX.indexOf(alliance);
        const newAlliance = ALLIANCES_INDEX[Math.clamp(currentIndex + direction, 0, 2)];
        if (newAlliance === alliance) return;

        if (newAlliance === defaultAlliance) {
            actor.update({ "system.details.-=alliance": true });
        } else {
            actor.update({
                "system.details.alliance": newAlliance === "neutral" ? null : newAlliance,
            });
        }
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

                actor.getStatistic(statistic)?.roll({ event, extraRollOptions });
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

async function useResolve(actor: CharacterPF2e) {
    const name = actor.name;

    const checkCurrentData = () => {
        const stamina = actor.attributes.hp.sp;
        if (!stamina || stamina.value >= stamina.max) {
            warn("hud.resolve.full", { name });
            return null;
        }

        const resolve = actor.system.resources.resolve;
        if (!resolve || resolve.value < 1) {
            const warning = game.i18n.format("PF2E.Actions.SteelYourResolve.NoStamina", { name });
            ui.notifications.warn(warning);
            return null;
        }

        return { stamina, resolve };
    };

    if (!checkCurrentData()) return;

    const data = await promptDialog<{ pick: "breather" | "steel" }>({
        classes: ["pf2e-hud-resolve"],
        title: localize("hud.resolve.title"),
        content: "dialogs/resolve",
        data: {
            i18n: templateLocalize("dialogs.resolve"),
            hasSteel: hasItemWithSourceId(actor, RESOLVE_UUID, "feat"),
        },
    });
    if (!data) return;

    const stats = checkCurrentData();
    if (!stats) return;

    const ratio = `${stats.stamina.value}/${stats.stamina.max}`;

    const [updates, message] = (() => {
        if (data.pick === "breather") {
            return [
                {
                    "system.attributes.hp.sp.value": stats.stamina.max,
                    "system.resources.resolve.value": stats.resolve.value - 1,
                },
                localize("hud.resolve.breather.used", { name, ratio }),
            ];
        } else {
            const newSP = stats.stamina.value + Math.floor(stats.stamina.max / 2);
            return [
                {
                    "system.attributes.hp.sp.value": Math.min(newSP, stats.stamina.max),
                    "system.resources.resolve.value": stats.resolve.value - 1,
                },
                game.i18n.format("PF2E.Actions.SteelYourResolve.RecoverStamina", { name, ratio }),
            ];
        }
    })();

    const ChatMessagePF2e = getDocumentClass("ChatMessage");
    ChatMessagePF2e.create({
        content: message,
        author: game.user.id,
        speaker: ChatMessagePF2e.getSpeaker({ actor }),
    });

    actor.update(updates);
}

function addSendItemToChatListeners(
    actor: ActorPF2e,
    html: HTMLElement,
    onSendToChat?: () => void
) {
    addListenerAll(html, "[data-action='send-to-chat']", async (event, el) => {
        const item = await getItemFromElement(el, actor);
        if (!item) return;

        if (!isOwnedItem(item)) {
            unownedItemtoMessage(actor, item, event);
        } else if (item.isOfType("spell")) {
            const castRank = Number(htmlClosest(el, "[data-cast-rank]")?.dataset.castRank ?? NaN);
            item.toMessage(event, { data: { castRank } });
        } else {
            item.toMessage(event);
        }

        onSendToChat?.();
    });
}

type StatsHeaderActionEvent = "take-cover" | "raise-shield" | "show-notes" | "use-resolve";

type StatsAdvancedActionEvent = "roll-statistic" | "change-speed";

type StatsAdvancedSliderEvent = "hero" | "wounded" | "dying";

export {
    addEnterKeyListeners,
    addSendItemToChatListeners,
    addStatsAdvancedListeners,
    addStatsHeaderListeners,
};
