import {
    ErrorPF2e,
    MODULE,
    R,
    actorItems,
    addListenerAll,
    canUseStances,
    createSelfEffectMessage,
    elementDataset,
    getActionGlyph,
    getActionImg,
    getActiveModule,
    getSourceId,
    getStances,
    htmlClosest,
    htmlQuery,
    isOwnedItem,
    localize,
    objectHasKey,
    toggleStance,
    tupleHasValue,
} from "foundry-pf2e";
import { eventToRollMode, getActionIcon } from "foundry-pf2e/src/pf2e";
import { getNpcStrikeImage } from "../../utils/npc-attacks";
import { PF2eHudTextPopup } from "../popup/text";
import { getItemFromElement } from "../shared/base";
import { PF2eHudSidebar, SidebarContext, SidebarName, SidebarRenderOptions } from "./base";
import { EXTRAS_ACTIONS_UUIDS } from "./extras";
import { SKILL_ACTIONS_UUIDS } from "./skills";

const ACTION_TYPES = {
    action: { sort: 0, label: "PF2E.ActionsActionsHeader" },
    reaction: { sort: 1, label: "PF2E.ActionsReactionsHeader" },
    free: { sort: 2, label: "PF2E.ActionsFreeActionsHeader" },
    passive: { sort: 3, label: "PF2E.NPC.PassivesLabel" },
    exploration: { sort: 3, label: "PF2E.TravelSpeed.ExplorationActivity" },
};

class PF2eHudSidebarActions extends PF2eHudSidebar {
    get key(): SidebarName {
        return "actions";
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<ActionsContext> {
        const actor = this.actor;
        const isCharacter = actor.isOfType("character");
        const parentData = await super._prepareContext(options);
        const toolbelt = getActiveModule("pf2e-toolbelt");

        const stances = isCharacter
            ? {
                  actions: R.sortBy(getStances(actor), R.prop("name")),
                  canUse: canUseStances(actor),
              }
            : undefined;

        const heroActions = (() => {
            if (!isCharacter || !toolbelt?.getSetting("heroActions.enabled")) return;

            const api = toolbelt.api.heroActions;
            const actions = api.getHeroActions(actor);
            const usesCount = api.usesCountVariant();
            const heroPoints = actor.heroPoints.value;
            const diff = heroPoints - actions.length;
            const mustDiscard = !usesCount && diff < 0;
            const mustDraw = !usesCount && diff > 0;

            return {
                actions: R.sortBy(actions, R.prop("name")),
                usesCount,
                mustDiscard,
                mustDraw,
                canUse: (usesCount && heroPoints > 0) || diff >= 0,
                canTrade: actions.length && !mustDiscard && !mustDraw && api.canTrade(),
                diff: Math.abs(diff),
            };
        })();

        const inParty = isCharacter ? actor.parties.size > 0 : false;
        const actionSections = await (async () => {
            const abilityTypes: ("action" | "feat")[] = ["action"];
            if (isCharacter) abilityTypes.push("feat");

            const actionableEnabled = !!toolbelt?.getSetting("actionable.enabled");
            const excludedUUIDS = [
                ...SKILL_ACTIONS_UUIDS,
                ...EXTRAS_ACTIONS_UUIDS,
                ...(stances?.actions.map((x) => x.actionUUID) ?? []),
            ];
            const hasKineticAura =
                isCharacter &&
                actor.flags.pf2e.kineticist &&
                !!actor.itemTypes.effect.find((x) => x.slug === "effect-kinetic-aura");

            const explorations = isCharacter ? actor.system.exploration : [];
            const sections = {} as Record<
                ActionType | "exploration",
                { type: ActionType | "exploration"; label: string; actions: ActionData[] }
            >;

            const useLabel = game.i18n.localize("PF2E.Action.Use");

            for (const ability of actorItems(actor, abilityTypes)) {
                const sourceId = getSourceId(ability);
                const traits = ability.system.traits.value;
                const isExploration = isCharacter && traits.includes("exploration");

                if (
                    (ability.slug === "elemental-blast" && hasKineticAura) ||
                    (sourceId && excludedUUIDS.includes(sourceId)) ||
                    (ability.isOfType("feat") && !ability.actionCost) ||
                    traits.includes("downtime") ||
                    (!inParty && isExploration)
                )
                    continue;

                const id = ability.id;
                const actionCost = ability.actionCost;
                const type =
                    actionCost?.type ??
                    (isCharacter ? (isExploration ? "exploration" : "free") : "passive");

                sections[type] ??= {
                    type,
                    label: ACTION_TYPES[type].label,
                    actions: [],
                };

                const frequency = getActionFrequency(ability);

                const usage = await (async () => {
                    if (isExploration) return;
                    if (
                        !frequency &&
                        !ability.system.selfEffect &&
                        (!actionableEnabled ||
                            !(await toolbelt!.api.actionable.getActionMacro(ability)))
                    )
                        return;

                    const disabled = frequency?.value === 0;
                    const label = (() => {
                        if (disabled) {
                            return MODULE.path("sidebars.actions.reset");
                        }

                        const costIcon = getActionGlyph(actionCost);
                        const costLabel = `<span class="action-glyph">${costIcon}</span>`;

                        return `${useLabel} ${costLabel}`;
                    })();

                    return {
                        disabled,
                        label,
                    };
                })();

                sections[type].actions.push({
                    id,
                    usage,
                    frequency,
                    isExploration,
                    name: ability.name,
                    img: getActionIcon(actionCost),
                    dragImg: getActionImg(ability, true),
                    isActive: isExploration && explorations.includes(id),
                    toggles: ability.system.traits.toggles.getSheetData(),
                });
            }

            return R.pipe(
                sections,
                R.values(),
                R.sortBy((x) => ACTION_TYPES[x.type].sort),
                R.forEach((x) => (x.actions = R.sortBy(x.actions, R.prop("name"))))
            );
        })();

        const filterValue: ActionsContext["filterValue"] = (
            list,
            { hash: { key, localize = false } }
        ) => {
            return list.map((x) => (localize ? game.i18n.localize(x[key]) : x[key])).join("|");
        };

        const blastActionCost = (() => {
            if (!isCharacter) return;

            const blastOption = actor.synthetics.toggles["elemental-blast"]?.["action-cost"];
            if (!blastOption) return;

            return blastOption.suboptions.map(({ selected, value, label }) => ({
                selected,
                cost: value,
                label: value === "1" ? "Ⅰ" : "Ⅱ",
                tooltip: label,
                itemId: blastOption.itemId,
            }));
        })();

        const stowedWeapons = (() => {
            if (!isCharacter) return;

            if (
                !actor.itemTypes.weapon.some((i) => i.isStowed) &&
                !actor.itemTypes.shield.some((i) => i.isStowed)
            )
                return;

            const hidden = !!actor.getFlag<boolean>("pf2e", "hideStowed");

            return {
                tooltip: MODULE.path("sidebars.actions.stowedWeapons", hidden ? "hidden" : "shown"),
                hidden,
            };
        })();

        const blasts = isCharacter ? await getBlastData(actor) : undefined;
        const strikes = await getStrikeData(actor);

        const data: ActionsContext = {
            ...parentData,
            inParty,
            stances,
            heroActions,
            stowedWeapons,
            actionSections,
            blasts: blasts?.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang)),
            strikes: strikes.sort((a, b) => a.index - b.index),
            blastActionCost,
            isCharacter,
            variantLabel,
            filterValue,
            showUnreadyStrikes: !!actor.getFlag("pf2e", "showUnreadyStrikes"),
        };

        return data;
    }

    _getDragData(
        target: HTMLElement,
        baseDragData: Record<string, JSONValue>,
        item: Maybe<ItemPF2e<ActorPF2e>>
    ) {
        const { actionIndex, element, effectUuid } = target.dataset;

        if (actionIndex) {
            return "itemType" in baseDragData && baseDragData.itemType === "melee"
                ? { index: Number(actionIndex) }
                : { type: "Action", index: Number(actionIndex) };
        } else if (element) {
            return {
                type: "Action",
                elementTrait: element,
            };
        } else if (effectUuid) {
            return {
                effectUuid,
            };
        }
    }

    _activateListeners(html: HTMLElement) {
        const actor = this.actor;
        const { elementTraits, damageTypes } = CONFIG.PF2E;

        const getBlast = (button: HTMLElement, itemRow: HTMLElement) => {
            const melee = button.dataset.melee === "true";
            const blast = new game.pf2e.ElementalBlast(actor as CharacterPF2e);
            const element = itemRow.dataset.element;
            const damageType = button.dataset.value || itemRow.dataset.damageType;

            if (!objectHasKey(elementTraits, element)) {
                throw ErrorPF2e("Unexpected error retrieve element");
            }
            if (!objectHasKey(damageTypes, damageType)) {
                throw ErrorPF2e("Unexpected error retrieving damage type");
            }

            return [blast, { element, damageType, melee }] as const;
        };

        const getStrike = <T extends StrikeData>(
            button: HTMLElement,
            readyOnly = false
        ): T | null => {
            const actionIndex = Number(htmlClosest(button, ".item")?.dataset.actionIndex ?? "NaN");
            const strike = this.actor.system.actions?.at(actionIndex) ?? null;
            return getStrikeVariant<T>(strike, button, readyOnly);
        };

        const getUUID = (button: HTMLElement) => {
            return elementDataset(htmlClosest(button, ".item")!).uuid;
        };

        addListenerAll(html, "[data-action]", async (event, button) => {
            const itemRow = htmlClosest(button, ".item")!;
            const action = button.dataset.action as Action;

            switch (action) {
                case "toggle-hide-stowed": {
                    actor.setFlag("pf2e", "hideStowed", !actor.getFlag("pf2e", "hideStowed"));
                    break;
                }

                case "toggle-blast-action-cost": {
                    const { itemId, cost } = button.dataset;
                    actor.toggleRollOption("elemental-blast", "action-cost", itemId, true, cost);
                    break;
                }

                case "toggle-trait": {
                    const item = await getItemFromElement(button, actor);
                    if (!isOwnedItem(item) || !item.isOfType("action", "feat")) return;

                    const trait = button.dataset.trait as "mindshift";
                    const toggle = item.system.traits.toggles[trait];
                    if (!toggle) return;

                    return item.system.traits.toggles.update({ trait, selected: !toggle.selected });
                }

                case "toggle-exploration": {
                    const actionId = htmlClosest(button, "[data-item-id]")?.dataset.itemId;
                    if (!actionId) return;

                    const exploration = (actor as CharacterPF2e).system.exploration.filter((id) =>
                        actor.items.has(id)
                    );
                    if (!exploration.findSplice((id) => id === actionId)) {
                        exploration.push(actionId);
                    }

                    return actor.update({ "system.exploration": exploration });
                }

                case "blast-attack": {
                    const [blast, data] = getBlast(button, itemRow);
                    const mapIncreases = Math.clamp(Number(button.dataset.mapIncreases), 0, 2);
                    return blast.attack({ ...data, mapIncreases, event });
                }

                case "blast-damage": {
                    const [blast, data] = getBlast(button, itemRow);
                    const outcome =
                        button.dataset.outcome === "success" ? "success" : "criticalSuccess";
                    return blast.damage({ ...data, outcome, event });
                }

                case "blast-set-damage-type": {
                    const [blast, data] = getBlast(button, itemRow);
                    return blast.setDamageType(data);
                }

                case "strike-attack": {
                    const altUsage = tupleHasValue(["thrown", "melee"], button.dataset.altUsage)
                        ? button.dataset.altUsage
                        : null;

                    const strike = getStrike(button, true);
                    const variantIndex = Number(button.dataset.variantIndex);
                    return strike?.variants[variantIndex]?.roll({ event, altUsage });
                }

                case "strike-damage":
                case "strike-critical": {
                    const strike = getStrike(button);
                    const method =
                        button.dataset.action === "strike-damage" ? "damage" : "critical";
                    return strike?.[method]?.({ event });
                }

                case "auxiliary-action": {
                    const auxiliaryActionIndex = Number(button.dataset.auxiliaryActionIndex ?? NaN);
                    const strike = getStrike<CharacterStrike>(button);
                    const selection = htmlQuery(button, "select")?.value ?? null;
                    strike?.auxiliaryActions?.at(auxiliaryActionIndex)?.execute({ selection });
                    break;
                }

                case "toggle-weapon-trait": {
                    const weapon = getStrike<CharacterStrike>(button)?.item;
                    const trait = button.dataset.trait;
                    const errorMessage = "Unexpected failure while toggling weapon trait";

                    if (trait === "double-barrel") {
                        const selected = !weapon?.system.traits.toggles.doubleBarrel.selected;
                        if (!weapon?.traits.has("double-barrel")) throw ErrorPF2e(errorMessage);
                        return weapon.system.traits.toggles.update({ trait, selected });
                    } else if (trait === "versatile") {
                        const baseType = weapon?.system.damage.damageType ?? null;
                        const value = button.dataset.value;
                        const selected =
                            button.classList.contains("selected") || value === baseType
                                ? null
                                : value;
                        const selectionIsValid =
                            objectHasKey(CONFIG.PF2E.damageTypes, selected) || selected === null;
                        if (weapon && selectionIsValid) {
                            return weapon.system.traits.toggles.update({ trait, selected });
                        }
                    }

                    throw ErrorPF2e(errorMessage);
                }

                case "toggle-stance": {
                    const uuid = elementDataset(htmlClosest(button, ".item")!).effectUuid;
                    toggleStance(actor as CharacterPF2e, uuid, event.ctrlKey);
                    break;
                }

                case "hero-action-description": {
                    const details = await getActiveModule(
                        "pf2e-toolbelt"
                    )?.api.heroActions?.getHeroActionDetails(getUUID(button));
                    if (!details) return;
                    new PF2eHudTextPopup({
                        actor,
                        event,
                        content: details.description,
                        title: details.name,
                    }).render(true);
                    break;
                }

                case "hero-action-discard": {
                    getActiveModule("pf2e-toolbelt")?.api.heroActions.discardHeroActions(
                        actor as CharacterPF2e,
                        getUUID(button)
                    );
                    break;
                }

                case "hero-action-use": {
                    getActiveModule("pf2e-toolbelt")?.api.heroActions.useHeroAction(
                        actor as CharacterPF2e,
                        getUUID(button)
                    );
                    break;
                }

                case "hero-actions-draw": {
                    getActiveModule("pf2e-toolbelt")?.api.heroActions.drawHeroActions(
                        actor as CharacterPF2e
                    );
                    break;
                }

                case "hero-actions-trade": {
                    getActiveModule("pf2e-toolbelt")?.api.heroActions.tradeHeroAction(
                        actor as CharacterPF2e
                    );
                    break;
                }

                case "send-hero-action-to-chat": {
                    getActiveModule("pf2e-toolbelt")?.api.heroActions.sendActionToChat(
                        actor as CharacterPF2e,
                        getUUID(button)
                    );
                    break;
                }

                case "use-action": {
                    const item = await getItemFromElement<ActionItem>(button, actor);
                    return item?.isOfType("feat", "action") && useAction(event, item);
                }

                case "reset-action": {
                    const item = await getItemFromElement<ActionItem>(button, actor);
                    const frequency = item?.frequency;
                    if (!item || !frequency?.max) return;
                    return item.update({ "system.frequency.value": frequency.max });
                }
            }
        });

        addListenerAll(
            html,
            "select[data-action='link-ammo']",
            "change",
            (event, ammoSelect: HTMLSelectElement) => {
                event.stopPropagation();
                const action = getStrike<CharacterStrike>(ammoSelect);
                const weapon = action?.item;
                const ammo = this.actor.items.get(ammoSelect.value);
                weapon?.update({ system: { selectedAmmoId: ammo?.id ?? null } });
            }
        );

        addListenerAll(html, "[data-action='auxiliary-action'] select", (event, button) => {
            event.stopPropagation();
        });
    }
}

async function getBlastData(
    actor: CharacterPF2e,
    elementTrait: ElementTrait
): Promise<ActionBlast | undefined>;
async function getBlastData(actor: CharacterPF2e, elementTrait?: undefined): Promise<ActionBlast[]>;
async function getBlastData(
    actor: CharacterPF2e,
    elementTrait?: ElementTrait
): Promise<ActionBlast | ActionBlast[] | undefined> {
    const blastData = new game.pf2e.ElementalBlast(actor);

    const configs = elementTrait
        ? R.filter([blastData.configs.find((c) => c.element === elementTrait)], R.isTruthy)
        : blastData.configs;

    const reach =
        actor.attributes.reach.base + (blastData.infusion?.traits.melee.includes("reach") ? 5 : 0);

    const blasts = await Promise.all(
        configs.map(async (config): Promise<ActionBlast> => {
            const damageType = config.damageTypes.find((dt) => dt.selected)?.value ?? "untyped";

            const formulaFor = (
                outcome: "success" | "criticalSuccess",
                melee: boolean
            ): Promise<string | null> =>
                blastData.damage({
                    element: config.element,
                    damageType,
                    melee,
                    outcome,
                    getFormula: true,
                });

            return {
                ...config,
                attack: (event: MouseEvent, mapIncreases: number, el: HTMLElement) => {
                    return blastData.attack({
                        event,
                        mapIncreases,
                        melee: el.dataset.melee === "true",
                        damageType,
                        element: config.element,
                    });
                },
                damage: (event: MouseEvent, el: HTMLElement) => {
                    return blastData.damage({
                        event,
                        damageType,
                        element: config.element,
                        melee: el.dataset.melee === "true",
                        outcome: el.dataset.outcome === "success" ? "success" : "criticalSuccess",
                    });
                },
                reach: localize("sidebars.actions.reach", { reach }),
                damageType,
                formula: {
                    melee: {
                        damage: await formulaFor("success", true),
                        critical: await formulaFor("criticalSuccess", true),
                    },
                    ranged: {
                        damage: await formulaFor("success", false),
                        critical: await formulaFor("criticalSuccess", false),
                    },
                },
            };
        })
    );

    return elementTrait ? blasts[0] : blasts;
}

async function getStrikeData(
    actor: ActorPF2e,
    options: { id: string; slug: string }
): Promise<ActionStrike | undefined>;
async function getStrikeData(actor: ActorPF2e, options?: undefined): Promise<ActionStrike[]>;
async function getStrikeData(
    actor: ActorPF2e,
    options?: { id: string; slug: string }
): Promise<ActionStrike | ActionStrike[] | undefined> {
    const rollData = actor.getRollData();

    const actions = (() => {
        const actorStrikes = actor.system.actions ?? [];
        if (!options) return actorStrikes;

        const exactMatch = actorStrikes.find(
            (s) => s.item.id === options.id && s.slug === options.slug
        );
        if (exactMatch) return [exactMatch];

        const match = actorStrikes.find((s) => s.slug === options.slug);
        if (!match) return [];

        const realItem = actor.items.get(match.item.id);
        return realItem && realItem.type !== match.item.type ? [match] : [];
    })();

    const isCharacter = actor.isOfType("character");
    const isNPC = actor.isOfType("npc");

    const strikes = await Promise.all(
        actions.map(async (strike, index): Promise<ActionStrike> => {
            const actionData = await getActionData(strike, actor);

            const description = await TextEditor.enrichHTML(strike.description, {
                secrets: true,
                rollData,
            });

            const altUsages = await Promise.all(
                (strike.altUsages ?? []).map((altUsage) => getActionData(altUsage, actor))
            );

            return {
                ...actionData,
                index,
                img: getStrikeImage(strike, isNPC),
                visible: !isCharacter || (strike as CharacterStrike).visible,
                description,
                altUsages,
            };
        })
    );

    return options ? strikes[0] : strikes;
}

function getStrikeImage(strike: StrikeData, isNPC: boolean) {
    return isNPC ? getNpcStrikeImage(strike) : strike.item.img;
}

function getActionCategory(actor: ActorPF2e, item: WeaponPF2e<ActorPF2e> | MeleePF2e<ActorPF2e>) {
    if (item.isMelee) {
        const reach = actor.getReach({ action: "attack", weapon: item });

        return {
            type: "melee",
            value: String(reach),
            tooltip: localize("sidebars.actions.reach", { reach }),
        };
    }

    const range = item.range!;
    const isThrown = item.isThrown;
    const key = isThrown ? "thrown" : range.increment ? "rangedWithIncrement" : "ranged";

    return {
        type: isThrown ? "thrown" : "ranged",
        value: isThrown || range.increment ? `${range.increment}/${range.max}` : String(range.max),
        tooltip: localize("sidebars.actions", key, range),
    };
}

async function getActionData(action: StrikeData, actor: ActorPF2e): Promise<ActionStrikeUsage> {
    return {
        ...action,
        damageFormula: String(await action.damage?.({ getFormula: true })),
        criticalFormula: String(await action.critical?.({ getFormula: true })),
        category: actor.isOfType("character") ? getActionCategory(actor, action.item) : undefined,
    };
}

function variantLabel(label: string) {
    return label.replace(/.+\((.+)\)/, "$1");
}

function getStrikeVariant<T extends StrikeData>(
    strike: Maybe<StrikeData>,
    el: HTMLElement,
    readyOnly = false
) {
    const altUsage = tupleHasValue(["thrown", "melee"], el?.dataset.altUsage)
        ? el?.dataset.altUsage
        : null;

    const strikeVariant = altUsage
        ? strike?.altUsages?.find((s) =>
              altUsage === "thrown" ? s.item.isThrown : s.item.isMelee
          ) ?? null
        : strike;

    return strikeVariant?.ready || !readyOnly ? (strikeVariant as T) : null;
}

function getActionFrequency(action: FeatPF2e | AbilityItemPF2e) {
    const frequency = action.frequency;
    if (!frequency?.max) return;

    const perLabel = game.i18n.localize(CONFIG.PF2E.frequencies[frequency.per]);

    return {
        max: frequency.max,
        value: frequency.value,
        label: `${frequency.max} / ${perLabel}`,
    };
}

async function useAction(event: Event, item: ActionItem) {
    const frequency = item.frequency;
    if (frequency?.max && frequency.value) {
        item.update({ "system.frequency.value": frequency.value - 1 });
    }

    if (item.system.selfEffect) {
        createSelfEffectMessage(item, eventToRollMode(event));
        return;
    }

    const toolbelt = getActiveModule("pf2e-toolbelt");
    const macro = toolbelt?.getSetting("actionable.enabled")
        ? await toolbelt.api.actionable.getActionMacro(item)
        : undefined;

    if (macro) {
        macro?.execute({ actor: item.actor, item });
    }

    if (!macro || toolbelt!.getSetting("actionable.message")) {
        item.toMessage(event);
    }
}

type ActionItem = FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>;

type ActionStrikeUsage<T extends StrikeData = StrikeData> = T & {
    damageFormula: string;
    criticalFormula: string;
    category: Maybe<{
        type: string;
        tooltip: string;
    }>;
};

type ActionStrike<T extends StrikeData = StrikeData> = ActionStrikeUsage<T> & {
    index: number;
    img: string;
    visible: boolean;
    description: string;
};

type ActionBlast = ElementalBlastSheetConfig & {
    reach: string;
    attack: (
        event: MouseEvent,
        mapIncreases: number,
        el: HTMLElement
    ) => Promise<Rolled<CheckRoll> | null>;
    damage: (event: MouseEvent, el: HTMLElement) => Promise<string | Rolled<DamageRoll> | null>;
};

type Action =
    | "blast-attack"
    | "blast-damage"
    | "blast-set-damage-type"
    | "strike-attack"
    | "strike-damage"
    | "strike-critical"
    | "auxiliary-action"
    | "toggle-weapon-trait"
    | "toggle-stance"
    | "hero-actions-draw"
    | "hero-actions-trade"
    | "send-hero-action-to-chat"
    | "hero-action-description"
    | "hero-action-use"
    | "hero-action-discard"
    | "use-action"
    | "reset-action"
    | "toggle-exploration"
    | "toggle-trait"
    | "toggle-blast-action-cost"
    | "toggle-hide-stowed";

type ActionData = {
    id: string;
    img: string;
    dragImg: string;
    name: string;
    isActive: boolean;
    toggles: TraitToggleViewData[];
    isExploration: boolean;
    usage: Maybe<{
        disabled: boolean;
        label: string;
    }>;
    frequency: Maybe<{
        value: number;
        label: string;
    }>;
};

type ActionsContext = SidebarContext & {
    isCharacter: boolean;
    showUnreadyStrikes: boolean;
    variantLabel: (label: string) => string;
    blasts: ActionBlast[] | undefined;
    strikes: ActionStrike[];
    stowedWeapons: Maybe<{ tooltip: string; hidden: boolean }>;
    blastActionCost: Maybe<
        {
            selected: boolean;
            cost: string;
            label: string;
            itemId: string;
        }[]
    >;
    actionSections: {
        type: "action" | "exploration" | "free" | "reaction" | "passive";
        label: string;
        actions: ActionData[];
    }[];
    inParty: boolean;
    stances: Maybe<{
        actions: toolbelt.stances.StanceData[];
        canUse: boolean;
    }>;
    heroActions: Maybe<{
        actions: toolbelt.heroActions.HeroActionFlag[];
        usesCount: boolean;
        mustDiscard: boolean;
        mustDraw: boolean;
        canUse: boolean;
        canTrade: boolean | 0;
        diff: number;
    }>;
    filterValue: <TKey extends string>(
        list: Array<{ [k in TKey]: string }>,
        options: { hash: { key: TKey; localize?: boolean } }
    ) => string;
};

export {
    PF2eHudSidebarActions,
    getActionFrequency,
    getBlastData,
    getStrikeData,
    getStrikeImage,
    getStrikeVariant,
    useAction,
    variantLabel,
};
export type { ActionBlast, ActionStrike };
