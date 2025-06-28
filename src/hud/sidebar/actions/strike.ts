import { FilterValue, getNpcStrikeImage } from "hud";
import {
    ActorPF2e,
    addListenerAll,
    CharacterStrike,
    ErrorPF2e,
    getFlag,
    htmlQuery,
    localize,
    MeleePF2e,
    NPCStrike,
    objectHasKey,
    R,
    StrikeData,
    tupleHasValue,
    WeaponAuxiliaryAction,
    WeaponPF2e,
} from "module-helpers";
import { ActionsSidebarPF2eHUD } from ".";
import { BaseSidebarItem } from "..";

class ActionsSidebarStrike extends BaseSidebarItem<
    MeleePF2e<ActorPF2e> | WeaponPF2e<ActorPF2e>,
    StrikeData | CharacterStrike | NPCStrike
> {
    #options: ActionsSidebarStrikeOptions;
    #formula: StrikeFormulas;
    #img?: ImageFilePath;

    constructor(
        data: StrikeData | CharacterStrike | NPCStrike,
        formula: StrikeFormulas,
        options: ActionsSidebarStrikeOptions
    ) {
        super(data);

        this.#options = options;
        this.#formula = formula;
    }

    get actor(): ActorPF2e {
        return this.item.actor;
    }

    get category() {
        const actor = this.actor;
        return actor.isOfType("character") ? getActionCategory(actor, this.item) : undefined;
    }

    get formula() {
        return this.#formula;
    }

    get altStrikes(): ActionsSidebarStrike[] {
        return this.#options.altStrikes ?? [];
    }

    get isAltUsage(): boolean {
        return !!this.#options.isAltUsage;
    }

    get altUsage(): NonNullable<StrikeAltUsage> {
        return this.item.isThrown ? "thrown" : "melee";
    }

    get img(): ImageFilePath {
        return (this.#img ??= this.actor.isOfType("npc") ? getNpcStrikeImage(this) : this.item.img);
    }

    getStrike(altUsage: StrikeAltUsage, readyOnly = false): ActionsSidebarStrike | null {
        const strike = altUsage
            ? this.altStrikes?.find((s) =>
                  altUsage === "thrown" ? s.item.isThrown : s.item.isMelee
              ) ?? null
            : this;

        return strike?.ready || !readyOnly ? strike : null;
    }

    /**
     * modified version of
     * https://github.com/foundryvtt/pf2e/blob/334bd18d448b1e8e99a1788a460ba7fd178b798b/src/module/actor/character/sheet.ts#L845
     */
    toggleWeaponTrait(trait: string, value?: string) {
        const weapon = this.item;
        if (!weapon.isOfType("weapon")) return;

        const errorMessage = "Unexpected failure while toggling weapon trait";

        if (trait === "double-barrel") {
            const selected = !weapon?.system.traits.toggles.doubleBarrel.selected;
            if (!weapon.traits.has("double-barrel")) throw ErrorPF2e(errorMessage);
            return weapon.system.traits.toggles.update({ trait, selected });
        } else if (trait === "versatile") {
            const selectionIsValid = objectHasKey(CONFIG.PF2E.damageTypes, value) || value === null;
            if (selectionIsValid) {
                return weapon.system.traits.toggles.update({ trait, selected: value });
            }
        }

        throw ErrorPF2e(errorMessage);
    }

    linkAmmo(id: string) {
        const weapon = this.item;
        if (!weapon.isOfType("weapon")) return;

        const ammo = this.actor.items.get(id);
        weapon.update({ system: { selectedAmmoId: ammo?.id ?? null } });
    }

    auxiliaryAction(index: number, selection: string | undefined | null = null) {
        if ("auxiliaryActions" in this) {
            (this.auxiliaryActions as WeaponAuxiliaryAction[]).at(index)?.execute({ selection });
        }
    }
}
interface ActionsSidebarStrike extends Readonly<StrikeData> {}

async function getFormula(strike: StrikeData): Promise<StrikeFormulas> {
    return {
        damage: String(await strike.damage?.({ getFormula: true })),
        critical: String(await strike.critical?.({ getFormula: true })),
    };
}

async function getSidebarStrikeData(
    this: ActionsSidebarPF2eHUD
): Promise<StrikesContext | undefined> {
    const actor = this.actor;
    const strikeActions = getStrikeActions(actor).filter((strike) => {
        return !("visible" in strike) || strike.visible !== false;
    });

    const strikes = await Promise.all(
        strikeActions.map(async (strike) => {
            const strikeFormula = await getFormula(strike);

            const altStrikes = await Promise.all(
                (strike.altUsages ?? [])?.map(async (usage) => {
                    const usageFormula = await getFormula(usage);
                    return new ActionsSidebarStrike(usage, usageFormula, { isAltUsage: true });
                })
            );

            const args: ActionsSidebarStrikeArgs = [strike, strikeFormula, { altStrikes }];
            return this.addSidebarItem(ActionsSidebarStrike, "id", args[0], args[1], args[2]);
        })
    );

    const isCharacter = actor.isOfType("character");
    if (!strikes.length && !isCharacter) return;

    const showShields = !isCharacter || !!getFlag(actor, "showShields");
    const actions = !showShields ? strikes.filter((strike) => !("shield" in strike.item)) : strikes;

    return {
        actions,
        filterValue: new FilterValue(...strikes),
        shields: showShields,
        stowed: !!actor.flags.pf2e.hideStowed,
    };
}

function getStrikeActions(actor: ActorPF2e, options?: StrikeActionOptions): StrikeData[] {
    const actorStrikes = actor.system.actions ?? [];
    if (!options) return actorStrikes;

    const exactMatch = actorStrikes.find(
        (strike) => strike.item.id === options.id && strike.slug === options.slug
    );

    if (exactMatch) {
        if (!isAlchemicalStrike(exactMatch) || exactMatch.item.quantity) {
            return [exactMatch];
        }

        // we look for another alchemical strike with the same slug that has some quantity
        const other = otherAlchemicalStrike(actor, exactMatch, options);
        return other ? [other] : [exactMatch];
    }

    // we look for another strike with the same slug
    const matches = actorStrikes.filter((s) => s.slug === options.slug);
    const match = matches[0];
    if (!match) return [];

    if (isAlchemicalStrike(match)) {
        if (!match.item.quantity) {
            // again we look for another alchemical strike with some quantity
            const other = otherAlchemicalStrike(actor, match, options);

            if (other) {
                return [other];
            }
        }

        return [match];
    }

    // NPC stuff shouldn't normally reach here but just in case (also TS stuff)
    if (match.item.isOfType("melee")) {
        return [match];
    }

    // if the embedded item is different from the strike item then it is a virtual strike
    const realItem = actor.items.get(match.item.id);
    if (realItem && realItem.type !== match.item.type) {
        return [match];
    }

    // we prioritize the currently equipped weapon over others
    const equipped = matches.find((s) => (s.item as WeaponPF2e).isEquipped);
    return equipped ? [equipped] : [match];
}

function otherAlchemicalStrike(
    actor: ActorPF2e,
    strike: WeaponStrike,
    options: StrikeActionOptions
): WeaponStrike | undefined {
    return (actor.system.actions ?? []).find((other): other is WeaponStrike => {
        return (
            other !== strike &&
            other.slug === options.slug &&
            isAlchemicalStrike(other) &&
            other.item.quantity > 0
        );
    });
}

function getActionCategory(
    actor: ActorPF2e,
    item: WeaponPF2e<ActorPF2e> | MeleePF2e<ActorPF2e>
): StrikeActionCategory | undefined {
    if (item.isMelee) {
        const reach = actor.getReach({ action: "attack", weapon: item });

        return {
            type: "melee",
            value: String(reach),
            tooltip: localize("sidebar.actions.reach", { reach }),
        };
    }

    const range = item.range!;
    const isThrown = item.isThrown;
    const key = isThrown ? "thrown" : range.increment ? "rangedWithIncrement" : "ranged";

    return {
        type: isThrown ? "thrown" : "ranged",
        value: isThrown || range.increment ? `${range.increment}/${range.max}` : String(range.max),
        tooltip: localize("sidebar.actions", key, range),
    };
}

function isAlchemicalStrike(strike: StrikeData): strike is WeaponStrike {
    return (
        strike.item.isOfType("weapon") &&
        strike.item.isAlchemical &&
        strike.item.traits.has("bomb") &&
        strike.item.isTemporary
    );
}

function activateActionsListeners(this: ActionsSidebarPF2eHUD, html: HTMLElement) {
    addListenerAll(html, `[data-action="link-ammo"]`, "change", (el: HTMLSelectElement) => {
        const sidebarItem = this.getSidebarItemFromElement<ActionsSidebarStrike>(el);
        sidebarItem?.linkAmmo(el.value);
    });

    addListenerAll(html, `[data-action="auxiliary-action"]`, "change", (el, event) => {
        event.stopImmediatePropagation();
    });
}

function onStrikeClickAction(
    event: MouseEvent,
    sidebarItem: ActionsSidebarStrike,
    action: Stringptionel<StrikeEventAction>,
    target: HTMLElement
) {
    const altUsage = tupleHasValue(["thrown", "melee"] as const, target.dataset.altUsage)
        ? target.dataset.altUsage
        : null;

    const strike = sidebarItem.getStrike(altUsage, action === "strike-attack");
    if (!strike) return;

    if (action === "auxiliary-action") {
        const index = Number(target.dataset.auxiliaryActionIndex);
        const selected = htmlQuery(target, "select")?.value;
        sidebarItem.auxiliaryAction(index, selected);
    } else if (action === "strike-attack") {
        const variantIndex = Number(target.dataset.variantIndex);
        strike.variants[variantIndex]?.roll({ event, altUsage });
    } else if (R.isIncludedIn(action, ["strike-critical", "strike-damage"])) {
        const type = action === "strike-damage" ? "damage" : "critical";
        strike[type]?.({ event });
    } else if (action === "toggle-weapon-trait") {
        const { trait, value } = target.dataset;
        trait && strike.toggleWeaponTrait(trait, value);
    }
}

type StrikeEventAction =
    | "auxiliary-action"
    | "strike-attack"
    | "strike-critical"
    | "strike-damage"
    | "toggle-weapon-trait";

type StrikeActionOptions = {
    id: string;
    slug: string;
};

type StrikeAltUsage = "melee" | "thrown" | null;

type StrikeActionCategory = {
    type: "melee" | "thrown" | "ranged";
    value: string;
    tooltip: string;
};

type StrikeFormulas = {
    damage: string;
    critical: string;
};

type ActionsSidebarStrikeOptions = {
    altStrikes?: ActionsSidebarStrike[];
    isAltUsage?: boolean;
};

type ActionsSidebarStrikeArgs = [
    data: StrikeData,
    formula: StrikeFormulas,
    options: ActionsSidebarStrikeOptions
];

type WeaponStrike = StrikeData & { item: WeaponPF2e<ActorPF2e> };

type StrikesContext = {
    actions: ActionsSidebarStrike[];
    filterValue: FilterValue;
    shields: boolean;
    stowed: boolean;
};

export {
    ActionsSidebarStrike,
    activateActionsListeners,
    getSidebarStrikeData,
    onStrikeClickAction,
};
export type { StrikesContext };
