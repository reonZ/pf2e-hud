import {
    addListenerAll,
    getEnrichedDescriptions,
    getFirstActiveToken,
    getRemainingDurationLabel,
    htmlClosest,
    isInstanceOf,
    PersistentDamageDialog,
} from "foundry-pf2e";
import { PersistentContext, PersistentRenderOptions, PF2eHudPersistent } from "../persistent";

async function prepareEffectsContext(
    this: PF2eHudPersistent,
    context: PersistentContext,
    options: PersistentRenderOptions
): Promise<PersistentContext | EffectsContext> {
    const actor = this.actor;
    if (!actor) return context;

    const expiredLabel = game.i18n.localize("PF2E.EffectPanel.Expired");
    const untileEndLabel = game.i18n.localize("PF2E.EffectPanel.UntilEncounterEnds");
    const unlimitedLabel = game.i18n.localize("PF2E.EffectPanel.UnlimitedDuration");

    const effects = actor.itemTypes.effect.map((effect) => {
        const duration = effect.totalDuration;
        const { system } = effect;
        if (duration === Infinity) {
            if (system.duration.unit === "encounter") {
                system.remaining = system.expired ? expiredLabel : untileEndLabel;
            } else {
                system.remaining = unlimitedLabel;
            }
        } else {
            const duration = effect.remainingDuration;
            system.remaining = system.expired
                ? expiredLabel
                : getRemainingDurationLabel(
                      duration.remaining,
                      system.start.initiative ?? 0,
                      system.duration.expiry
                  );
        }
        return effect;
    });

    const conditions = actor.conditions.active;
    const afflictions = actor.itemTypes.affliction ?? [];

    const descriptions = {
        afflictions: await getEnrichedDescriptions(afflictions),
        conditions: await getEnrichedDescriptions(conditions),
        effects: await getEnrichedDescriptions(effects),
    };

    const instructions = this.getSetting("shiftEffects")
        ? this.effectsShiftInstructions
        : this.effectsInstructions;

    const data: EffectsContext = {
        ...context,
        afflictions,
        conditions,
        descriptions,
        effects,
        actor,
        instructions,
        user: { isGM: context.isGM },
    };

    return data;
}

function activateEffectsListeners(this: PF2eHudPersistent, html: HTMLElement) {
    const actor = this.actor as ActorPF2e;
    if (!actor) return;

    const getEffect = (el: HTMLElement) => {
        const itemId = htmlClosest(el, "[data-item-id]")!.dataset.itemId ?? "";
        return actor.conditions.get(itemId) ?? actor?.items.get(itemId);
    };

    addListenerAll(html, ".effect-item[data-item-id] .icon", "mousedown", (event, el) => {
        if (![0, 2].includes(event.button)) return;

        if (!event.shiftKey && this.getSetting("shiftEffects")) return;

        const effect = getEffect(el);
        if (!effect) return;

        const isAbstract = isInstanceOf(effect, "AbstractEffectPF2e");

        if (event.button === 0) {
            if (effect.isOfType("condition") && effect.slug === "persistent-damage") {
                const token = getFirstActiveToken(actor, false, true);
                effect.onEndTurn({ token });
            } else if (isAbstract) {
                effect.increase();
            }
        } else if (event.button === 2) {
            if (isAbstract) {
                effect.decrease();
            } else {
                // Failover in case of a stale effect
                this.render();
            }
        }
    });

    addListenerAll(html, "[data-action=recover-persistent-damage]", (event, el) => {
        const effect = getEffect(el);
        if (effect?.isOfType("condition")) {
            effect.rollRecovery();
        }
    });

    addListenerAll(html, "[data-action=edit]", (event, el) => {
        const effect = getEffect(el);
        if (!effect) return;

        if (effect.isOfType("condition") && effect.slug === "persistent-damage") {
            new PersistentDamageDialog(actor, { editing: effect.id }).render(true);
        } else {
            effect.sheet.render(true);
        }
    });

    addListenerAll(html, "[data-action=send-to-chat]", (event, el) => {
        const effect = getEffect(el);
        effect?.toMessage();
    });
}

type EffectsContext = PersistentContext & {
    afflictions: AfflictionPF2e[];
    conditions: ConditionPF2e[];
    effects: EffectPF2e[];
    descriptions: {
        afflictions: string[];
        conditions: string[];
        effects: string[];
    };
    instructions: Record<string, string>;
    user: { isGM: boolean };
};

export type { EffectsContext };
export { activateEffectsListeners, prepareEffectsContext };