import {
    AbstractEffectPF2e,
    addListenerAll,
    AfflictionPF2e,
    ConditionPF2e,
    createHTMLElement,
    CreaturePF2e,
    EffectPF2e,
    EffectsPanelViewData,
    ErrorPF2e,
    getFirstActiveToken,
    isInstanceOf,
} from "module-helpers";
import { PersistentPF2eHUD } from ".";

/**
 * repurposed version of
 * https://github.com/foundryvtt/pf2e/blob/7baadf276f3d3f13fd77adf411387312ab287042/src/module/apps/effects-panel.ts#L70
 */
async function renderEffectsPanel(this: PersistentPF2eHUD): Promise<HTMLElement | null> {
    const actor = this.actor;
    if (!actor) return null;

    const data: EffectsPanelViewData = {
        afflictions: await getViewData(actor.itemTypes.affliction ?? []),
        conditions: await getViewData(actor.conditions.active),
        effects: await getViewData(actor.itemTypes.effect),
        actor,
        user: { isGM: game.user.isGM },
    };

    return createHTMLElement("div", {
        content: await foundry.applications.handlebars.renderTemplate(
            "systems/pf2e/templates/system/effects/panel.hbs",
            data
        ),
        dataset: {
            panel: "effects",
        },
    });
}

function activateEffectsListeners(this: PersistentPF2eHUD) {
    const actor = this.actor as CreaturePF2e;
    const effectsPanel = this.effectsPanel;
    if (!effectsPanel || !actor) return;

    const effectElements = effectsPanel.querySelectorAll<HTMLElement>(".effect-item[data-item-id]");

    for (const target of effectElements) {
        target.addEventListener("click", (event) => {
            if (!event.shiftKey) return;
            onEffectClick.call(this, target, "increase");
        });

        target.addEventListener("contextmenu", (event) => {
            if (!event.shiftKey) return;
            onEffectClick.call(this, target, "decrease");
        });

        target.addEventListener("pointerenter", async () => {
            onPointerEnter(target, actor);
        });
    }
}

/**
 * https://github.com/foundryvtt/pf2e/blob/7baadf276f3d3f13fd77adf411387312ab287042/src/module/apps/effects-panel.ts#L47
 */
async function onEffectClick(
    this: PersistentPF2eHUD,
    target: HTMLElement,
    direction: "increase" | "decrease"
) {
    const actor = this.actor as CreaturePF2e;
    const itemId = target.dataset.itemId ?? "";
    const effect = actor?.conditions.get(itemId) ?? actor?.items.get(itemId);

    if (direction === "increase") {
        // Increase or render persistent-damage dialog on left click
        if (actor && effect?.isOfType("condition") && effect.slug === "persistent-damage") {
            await effect.onEndTurn({ token: getFirstActiveToken(actor) });
        } else if (isInstanceOf(effect, "AbstractEffectPF2e")) {
            await (effect as AbstractEffectPF2e).increase();
        }
    } else {
        // Remove effect or decrease its badge value on right-click
        if (isInstanceOf(effect, "AbstractEffectPF2e")) {
            await (effect as AbstractEffectPF2e).decrease();
        } else {
            // Failover in case of a stale effect
            this.updateEffectsPanel();
        }
    }
}

/**
 * very loosely inspired by
 * https://github.com/foundryvtt/pf2e/blob/7baadf276f3d3f13fd77adf411387312ab287042/src/module/apps/effects-panel.ts#L179
 * https://github.com/foundryvtt/pf2e/blob/7baadf276f3d3f13fd77adf411387312ab287042/src/module/sheet/helpers.ts#L166
 */
async function onPointerEnter(target: HTMLElement, actor: CreaturePF2e) {
    const itemId = target.dataset.itemId ?? "";
    const effect = actor.conditions.get(itemId) ?? actor.items.get(itemId);
    if (!effect) return null;

    const viewData = (await getViewData([effect]))[0];
    if (!viewData) throw ErrorPF2e("Error creating view data for effect");

    const content = createHTMLElement("div", {
        content: await foundry.applications.handlebars.renderTemplate(
            "systems/pf2e/templates/system/effects/tooltip.hbs",
            viewData
        ),
    }).firstElementChild;
    if (!(content instanceof HTMLElement)) return null;

    addListenerAll(content, `[data-action]`, (el) => {
        const action = el.dataset.action as EventAction;

        if (action === "edit") {
            if (effect.isOfType("condition") && effect.slug === "persistent-damage") {
                // new PersistentDamageEditor({ actor, selectedItemId: effect.id }).render({
                //     force: true,
                // });
            } else {
                effect.sheet.render(true);
            }
        } else if (action === "recover-persistent-damage") {
            if (effect.isOfType("condition")) {
                effect.rollRecovery();
            }
        } else if (action === "send-to-chat") {
            effect.toMessage();
        }
    });

    game.tooltip.dismissLockedTooltips();

    game.tooltip.activate(target, {
        html: content,
        locked: true,
        direction: "UP",
        cssClass: "pf2e effect-info application",
    });
}

/**
 * https://github.com/foundryvtt/pf2e/blob/7baadf276f3d3f13fd77adf411387312ab287042/src/module/apps/effects-panel.ts#L164
 */
async function getViewData(
    effects: AfflictionPF2e[] | EffectPF2e[] | ConditionPF2e[]
): Promise<EffectViewData[]> {
    return Promise.all(
        effects.map(async (effect) => ({
            effect,
            description: (await effect.getDescription()).value,
            remaining: isInstanceOf(effect, "EffectPF2e")
                ? getRemainingDurationLabel(effect)
                : null,
        }))
    );
}

/**
 * https://github.com/foundryvtt/pf2e/blob/7baadf276f3d3f13fd77adf411387312ab287042/src/module/apps/effects-panel.ts#L91
 */
function getRemainingDurationLabel(effect: EffectPF2e): string {
    const system = effect.system;
    if (effect.totalDuration === Infinity) {
        if (system.duration.unit === "encounter") {
            return system.expired
                ? game.i18n.localize("PF2E.EffectPanel.Expired")
                : game.i18n.localize("PF2E.EffectPanel.UntilEncounterEnds");
        } else {
            return game.i18n.localize("PF2E.EffectPanel.UnlimitedDuration");
        }
    } else if (system.expired) {
        return game.i18n.localize("PF2E.EffectPanel.Expired");
    }

    const remaining = effect.remainingDuration.remaining;
    const initiative = system.start.initiative ?? 0;
    const expiry = system.duration.expiry;

    if (remaining >= 63_072_000) {
        // two years
        return game.i18n.format("PF2E.EffectPanel.RemainingDuration.MultipleYears", {
            years: Math.floor(remaining / 31_536_000),
        });
    } else if (remaining >= 31_536_000) {
        // one year
        return game.i18n.localize("PF2E.EffectPanel.RemainingDuration.SingleYear");
    } else if (remaining >= 1_209_600) {
        // two weeks
        return game.i18n.format("PF2E.EffectPanel.RemainingDuration.MultipleWeeks", {
            weeks: Math.floor(remaining / 604_800),
        });
    } else if (remaining > 604_800) {
        // one week
        return game.i18n.localize("PF2E.EffectPanel.RemainingDuration.SingleWeek");
    } else if (remaining >= 172_800) {
        // two days
        return game.i18n.format("PF2E.EffectPanel.RemainingDuration.MultipleDays", {
            days: Math.floor(remaining / 86_400),
        });
    } else if (remaining > 7_200) {
        // two hours
        return game.i18n.format("PF2E.EffectPanel.RemainingDuration.MultipleHours", {
            hours: Math.floor(remaining / 3_600),
        });
    } else if (remaining > 120) {
        // two minutes
        return game.i18n.format("PF2E.EffectPanel.RemainingDuration.MultipleMinutes", {
            minutes: Math.floor(remaining / 60),
        });
    } else if (remaining >= 12) {
        // two rounds
        return game.i18n.format("PF2E.EffectPanel.RemainingDuration.MultipleRounds", {
            rounds: Math.floor(remaining / 6),
        });
    } else if (remaining >= 6) {
        // one round
        return game.i18n.localize("PF2E.EffectPanel.RemainingDuration.SingleRound");
    } else if (remaining >= 2) {
        // two seconds
        return game.i18n.format("PF2E.EffectPanel.RemainingDuration.MultipleSeconds", {
            seconds: remaining,
        });
    } else if (remaining === 1) {
        // one second
        return game.i18n.localize("PF2E.EffectPanel.RemainingDuration.SingleSecond");
    } else {
        // zero rounds
        const key =
            expiry === "turn-end"
                ? "PF2E.EffectPanel.RemainingDuration.ZeroRoundsExpireTurnEnd"
                : "PF2E.EffectPanel.RemainingDuration.ZeroRoundsExpireTurnStart";
        return game.i18n.format(key, { initiative });
    }
}

type EventAction = "edit" | "recover-persistent-damage" | "send-to-chat";

type EffectViewData = EffectsPanelViewData["afflictions"][number];

export { activateEffectsListeners, renderEffectsPanel };
