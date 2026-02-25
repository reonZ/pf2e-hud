import { FilterValue, getNpcStrikeImage, StrikeShortcutData } from "hud";
import { ActionsSidebarPF2eHUD } from ".";
import { BaseSidebarItem } from "..";
import {
    ActorPF2e,
    addListenerAll,
    AttackAction,
    AttackAmmunitionData,
    createButtonElement,
    ErrorPF2e,
    getFlag,
    htmlClosest,
    htmlQuery,
    ImageFilePath,
    localize,
    MeleePF2e,
    objectHasKey,
    R,
    StrikeData,
    SYSTEM,
    tupleHasValue,
    WeaponAuxiliaryAction,
    WeaponPF2e,
} from "foundry-helpers";

class ActionsSidebarStrike extends BaseSidebarItem<MeleePF2e<ActorPF2e> | WeaponPF2e<ActorPF2e>, AttackAction> {
    #options: ActionsSidebarStrikeOptions;
    #formula: StrikeFormulas;
    #img?: ImageFilePath;

    constructor(data: AttackAction, formula: StrikeFormulas, options: ActionsSidebarStrikeOptions) {
        super(data);

        this.#options = options;
        this.#formula = formula;
    }

    get actor(): ActorPF2e {
        return this.item.actor;
    }

    get category(): StrikeActionCategory | undefined {
        const actor = this.actor;
        return actor.isOfType("character") ? getActionCategory(actor, this.item) : undefined;
    }

    get index(): number | undefined {
        return this.#options.index;
    }

    get formula(): StrikeFormulas {
        return this.#formula;
    }

    get altStrikes(): ActionsSidebarStrike[] {
        return this.#options.altStrikes ?? [];
    }

    get isAltUsage(): boolean {
        return R.isNumber(this.#options.altIndex);
    }

    get altIndex(): number | undefined {
        return this.#options.altIndex;
    }

    get img(): ImageFilePath {
        return (this.#img ??= this.actor.isOfType("npc") ? getNpcStrikeImage(this) : this.item.img);
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

    executeAuxiliaryAction(index: number, selection: string | undefined | null = null) {
        if ("auxiliaryActions" in this) {
            (this.auxiliaryActions as WeaponAuxiliaryAction[]).at(index)?.execute({ selection });
        }
    }

    toShortcut(): StrikeShortcutData {
        return {
            attachment: !!(this.item as WeaponPF2e).isAttachable,
            img: this.img,
            itemId: this.id,
            name: this.item._source.name,
            slug: this.slug,
            type: "strike",
        };
    }
}
interface ActionsSidebarStrike extends Readonly<StrikeData> {}

async function getFormula(strike: AttackAction): Promise<StrikeFormulas> {
    return {
        damage: String(await strike.damage?.({ getFormula: true })),
        critical: String(await strike.critical?.({ getFormula: true })),
    };
}

async function getSidebarStrikeData(this: ActionsSidebarPF2eHUD): Promise<StrikesContext | undefined> {
    const actor = this.actor;

    const strikesPromise = getStrikeActions(actor).map(async (strike, index) => {
        if ("visible" in strike && strike.visible === false) return;

        const strikeFormula = await getFormula(strike);

        const altStrikes = await Promise.all(
            (strike.altUsages ?? [])?.map(async (usage, altIndex) => {
                const usageFormula = await getFormula(usage);
                return new ActionsSidebarStrike(usage, usageFormula, { altIndex });
            }),
        );

        const strikeKey = `${strike.item.id}-${index}`;
        const args: ActionsSidebarStrikeArgs = [strike, strikeFormula, { altStrikes, index }];
        return this.addSidebarItem(ActionsSidebarStrike, strikeKey, args[0], args[1], args[2]);
    });

    const strikes = R.filter(await Promise.all(strikesPromise), R.isTruthy);

    const isCharacter = actor.isOfType("character");
    if (!strikes.length && !isCharacter) return;

    const showShields = !isCharacter || !!getFlag(actor, "showShields");
    const actions = !showShields ? strikes.filter((strike) => !("shield" in strike.item)) : strikes;

    return {
        actions,
        filterValue: new FilterValue(...strikes),
        shields: showShields,
        stowed: !!actor.getFlag(SYSTEM.id, "hideStowed"),
    };
}

function getStrikeActions(actor: ActorPF2e, options?: StrikeActionOptions): AttackAction[] {
    const actorStrikes = actor.system.actions ?? [];

    if (!options) {
        return actorStrikes;
    }

    const exactMatch = actorStrikes.find((strike) => strike.item.id === options.id && strike.slug === options.slug);

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
    options: StrikeActionOptions,
): WeaponStrike | undefined {
    return (actor.system.actions ?? []).find((other): other is WeaponStrike => {
        return other !== strike && other.slug === options.slug && isAlchemicalStrike(other) && other.item.quantity > 0;
    });
}

function getActionCategory(
    actor: ActorPF2e,
    item: WeaponPF2e<ActorPF2e> | MeleePF2e<ActorPF2e>,
): StrikeActionCategory | undefined {
    if (item.isMelee) {
        const reach = actor.getReach({ action: "attack", weapon: item });

        return {
            type: "melee",
            value: String(reach),
            tooltip: localize("sidebar.actions.reach", { reach }),
        };
    }

    const range = item.range;
    if (!range) return;

    const isThrown = item.isThrown;
    const key = isThrown ? "thrown" : range.increment ? "rangedWithIncrement" : "ranged";

    return {
        type: isThrown ? "thrown" : "ranged",
        value: isThrown || range.increment ? `${range.increment}/${range.max}` : String(range.max),
        tooltip: localize("sidebar.actions", key, range),
    };
}

function isAlchemicalStrike(strike: AttackAction): strike is WeaponStrike {
    return strike.item.isOfType("weapon") && strike.item.isAlchemical && strike.item.traits.has("bomb");
}

function activateActionsListeners(this: ActionsSidebarPF2eHUD, html: HTMLElement) {
    addListenerAll(html, `[data-action="link-ammo"]`, "change", (el: HTMLSelectElement) => {
        const sidebarItem = this.getSidebarItemFromElement<ActionsSidebarStrike>(el);
        sidebarItem?.linkAmmo(el.value);
    });

    addListenerAll(html, `[data-action="auxiliary-action"]`, "change", (_el, event) => {
        event.stopImmediatePropagation();
    });

    const actor = this.actor;
    if (!actor.isOfType("character")) return;

    addListenerAll(html, `[data-action="change-ammo-quantity"]`, "change", (el: HTMLInputElement) => {
        const strike = this.getSidebarItemFromElement(el);
        const weapon = strike instanceof ActionsSidebarStrike ? strike.item : null;
        if (!itemIsWeapon(weapon)) return;

        const ammoId = htmlClosest(el, "[data-ammo-id]")?.dataset.ammoId;
        const item = weapon.subitems.get(ammoId, { strict: true });
        if (!item.isOfType("ammo", "weapon")) return;

        const value = el.valueAsNumber;
        if (value === 0) {
            item.delete();
        } else if (item.isOfType("ammo") && item.system.uses.max > 1) {
            item.update({ "system.uses.value": value });
        } else {
            item.update({ "system.quantity": value });
        }
    });
}

function onStrikeClickAction(
    event: PointerEvent,
    sidebarItem: ActionsSidebarStrike,
    action: StrikeEventAction | (string & {}),
    target: HTMLElement,
) {
    const altUsageIndex = "altUsage" in target.dataset ? Number(target.dataset.altUsage) : null;
    const foundStrike = R.isNumber(altUsageIndex) ? (sidebarItem.altStrikes.at(altUsageIndex) ?? null) : sidebarItem;
    const strike = foundStrike?.ready || action !== "strike-attack" ? foundStrike : null;
    if (!strike) return;

    const altUsage = tupleHasValue(["thrown", "melee"] as const, target.dataset.altUsage)
        ? target.dataset.altUsage
        : null;

    switch (action) {
        case "auxiliary-action": {
            const index = Number(target.dataset.auxiliaryActionIndex);
            const selected = htmlQuery(target, "select")?.value;
            return sidebarItem.executeAuxiliaryAction(index, selected);
        }

        case "reload": {
            strike.ammunition;
            return simulateReload(strike, target);
        }

        /**
         * https://github.com/foundryvtt/pf2e/blob/002ba0bf6d15dfc0d87a96009f02fb0743fb000b/src/module/actor/character/sheet.ts#L925
         */
        case "select-ammo": {
            const weapon = strike.item;
            const ammoId = htmlClosest(target, "[data-ammo-id]")?.dataset.ammoId;
            if (!itemIsWeapon(weapon) || !ammoId || !weapon.subitems?.size) return;

            // Sort the selected ammo to the top, and remove any 0 quantity ammo while we're at it (they may be out)
            // The sorted sources have the same references, but we persist the original to maintain ordering
            const ammoSubItems = weapon.subitems.filter((i) => i.isOfType("ammo", "weapon") && i.isAmmoFor(weapon));
            const purgedItems = ammoSubItems.filter((i) => !i.quantity).map((i) => i.id);
            const sources = R.sortBy(foundry.utils.deepClone(weapon._source.system.subitems), (s) => s.sort).filter(
                (i) => !purgedItems.includes(i._id ?? ""),
            );
            const sourcesSorted = R.pipe(
                sources,
                R.sortBy((i) => i.sort),
                R.sortBy((i) => (!ammoSubItems.some((a) => a.id === i._id) ? 0 : i._id === ammoId ? 1 : 2)),
            );
            for (const [idx, item] of sourcesSorted.entries()) {
                item.sort = idx;
            }
            return weapon.update({ "system.subitems": sources });
        }

        case "strike-attack": {
            const variantIndex = Number(target.dataset.variantIndex);
            return strike.variants[variantIndex]?.roll({ event, altUsage });
        }

        case "strike-critical":
        case "strike-damage": {
            const type = action === "strike-damage" ? "damage" : "critical";
            return strike[type]?.({ event, altUsage });
        }

        case "toggle-weapon-trait": {
            const { trait, value } = target.dataset;
            return trait && strike.toggleWeaponTrait(trait, value);
        }

        case "unload": {
            const weapon = strike.item;
            if (!itemIsWeapon(weapon)) return;

            const ammoId = htmlClosest(target, "[data-ammo-id]")?.dataset.ammoId;
            return weapon.subitems.get(ammoId, { strict: true }).detach();
        }
    }
}

function simulateReload(
    {
        index,
        item,
        actor,
        ammunition,
    }: {
        ammunition?: AttackAmmunitionData | null;
        index?: number;
        item: Maybe<WeaponPF2e | MeleePF2e>;
        actor: Maybe<ActorPF2e>;
    },
    target: Maybe<HTMLElement>,
) {
    if (!R.isNumber(index) || !item || !actor || !target || !ammunition?.remaining) return;

    const nbCompatible = ammunition.compatible.length;
    const { left, top, width, height } = target.getBoundingClientRect();
    const btn = createButtonElement({
        dataset: {
            action: "reload",
            actionIndex: index,
            anchorId: `${item.uuid}-actions`,
        },
        label: "",
        style: {
            position: "absolute",
            left: `${left - 150}px`,
            top: `${top - height / 2 - nbCompatible * 22}px`,
            minHeight: "0",
            height: `${height}px`,
            width: `${width}px`,
            opacity: "0",
            visibility: "hidden",
        },
    });

    document.body.appendChild(btn);
    actor.sheet["activateClickListener"](btn);
    btn.click();

    requestAnimationFrame(() => {
        btn.remove();
    });
}

function itemIsWeapon(item: MeleePF2e | WeaponPF2e | null): item is WeaponPF2e {
    return item instanceof Item && item.isOfType("weapon");
}

type StrikeEventAction =
    | "auxiliary-action"
    | "reload"
    | "select-ammo"
    | "strike-attack"
    | "strike-critical"
    | "strike-damage"
    | "toggle-weapon-trait"
    | "unload";

type StrikeActionOptions = {
    id: string;
    slug: string;
};

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
    index?: number;
    altIndex?: number;
};

type ActionsSidebarStrikeArgs = [data: AttackAction, formula: StrikeFormulas, options: ActionsSidebarStrikeOptions];

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
    getActionCategory,
    getSidebarStrikeData,
    getStrikeActions,
    onStrikeClickAction,
    simulateReload,
};
export type { StrikesContext };
