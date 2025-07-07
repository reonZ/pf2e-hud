import { FilterValue, ShortcutData, ToggleShortcutData } from "hud";
import {
    AbilityItemPF2e,
    CharacterPF2e,
    CharacterSheetData,
    CheckRoll,
    DamageRoll,
    DamageType,
    EffectTrait,
    ElementalBlast,
    ElementTrait,
    localize,
    objectHasKey,
    R,
    RollOptionToggle,
} from "module-helpers";
import { ActionsSidebarPF2eHUD } from ".";
import { BaseSidebarItem, ToggleSidebarItem } from "..";

const ELEMENTAL_BLAST_IMG = "icons/magic/symbols/elements-air-earth-fire-water.webp";

const _cached: { labels: Record<string, string> } = {
    labels: {},
};

class ActionsSidebarBlastCost extends ToggleSidebarItem<AbilityItemPF2e<CharacterPF2e>> {
    #costs: BlastRollOptionsCost[];
    #selected: BlastRollOptionsCost;

    constructor(toggle: RollOptionToggle, item: AbilityItemPF2e<CharacterPF2e>) {
        super({ ...toggle, item });

        this.#costs = toggle.suboptions.map(({ selected, value, label }) => {
            return {
                selected,
                cost: value as "1" | "2",
                label: value === "1" ? "Ⅰ" : "Ⅱ",
                tooltip: label,
            };
        });

        this.#selected = this.costs.find((cost) => cost.selected) ?? this.costs[0];
    }

    get img(): ImageFilePath {
        return ELEMENTAL_BLAST_IMG;
    }

    get costs(): BlastRollOptionsCost[] {
        return this.#costs;
    }

    get selected(): BlastRollOptionsCost {
        return this.#selected;
    }

    toggleRollOption() {
        const selected = this.selected;
        if (!selected) return;

        this.item.actor.toggleRollOption(
            "elemental-blast",
            "action-cost",
            this.id,
            true,
            selected.cost === "1" ? "2" : "1"
        );
    }

    toShortcut(): ToggleShortcutData {
        return {
            ...super.toShortcut(),
            type: "blastCost",
        };
    }
}

class ActionsSidebarBlast extends BaseSidebarItem<
    AbilityItemPF2e<CharacterPF2e>,
    ElementalBlastsData
> {
    #reach?: string;

    get blastId(): BlastId {
        return `blast-${this.element}`;
    }

    get actor(): CharacterPF2e {
        return this.item.actor;
    }

    get reach(): string {
        if (!this.#reach) {
            const isReach = this.action.infusion?.traits.melee.includes("reach");
            const reach = this.actor.attributes.reach.base + (isReach ? 5 : 0);

            this.#reach = localize("sidebar.actions.reach", { reach });
        }

        return this.#reach;
    }

    attack(
        event: MouseEvent,
        melee: boolean,
        mapIncreases: number
    ): Promise<Rolled<CheckRoll> | null> {
        return this.action.attack({
            damageType: this.damageType,
            element: this.element,
            event,
            mapIncreases,
            melee,
        });
    }

    damage(
        event: MouseEvent,
        melee: boolean,
        outcome: BlastOutcome
    ): Promise<Rolled<DamageRoll> | null> {
        return this.action.damage({
            damageType: this.damageType,
            element: this.element,
            event,
            melee,
            outcome,
        });
    }

    setDamageType(damageType: DamageType) {
        this.action.setDamageType({
            damageType,
            element: this.element,
        });
    }

    formulaTooltip(melee: boolean, type: "damage" | "critical") {
        return this.formula[melee ? "melee" : "ranged"][type];
    }

    toShortcut(): ShortcutData | undefined {
        return;
    }
}

interface ActionsSidebarBlast extends Readonly<ElementalBlastsData> {}

async function getSidebarBlastsData(
    this: ActionsSidebarPF2eHUD
): Promise<BlastsContext | undefined> {
    const actor = this.actor as CharacterPF2e;
    const toggle = actor.synthetics.toggles["elemental-blast"]?.["action-cost"];
    if (!toggle) return;

    const blasts = await getElementalBlastsData(actor);
    if (!blasts?.length) return;

    const actions = blasts.map((data) => this.addSidebarItem(ActionsSidebarBlast, "blastId", data));
    const cost = this.addSidebarItem(ActionsSidebarBlastCost, "id", toggle, blasts[0].item);

    return {
        actions,
        cost,
        filterValue: new FilterValue(...actions),
    };
}

/**
 * slightly modified version of
 * https://github.com/foundryvtt/pf2e/blob/7329c2e1f7bed53e2cae3bae3c35135b22d97a13/src/module/actor/character/sheet.ts#L1178
 */
async function getElementalBlastsData(
    actor: CharacterPF2e,
    elementTrait: ElementTrait
): Promise<ElementalBlastsData | undefined>;
async function getElementalBlastsData(
    actor: CharacterPF2e,
    elementTrait?: never
): Promise<ElementalBlastsData[] | undefined>;
async function getElementalBlastsData(
    actor: CharacterPF2e,
    elementTrait?: ElementTrait
): Promise<ElementalBlastsData[] | ElementalBlastsData | undefined> {
    const action = new game.pf2e.ElementalBlast(actor);
    const item = action.item;
    if (!item) return;

    const configs = elementTrait
        ? R.filter([action.configs.find((c) => c.element === elementTrait)], R.isTruthy)
        : action.configs;

    const blastsData: ElementalBlastsData[] = await Promise.all(
        configs.map(async (config): Promise<ElementalBlastsData> => {
            const damageType = config.damageTypes.find((dt) => dt.selected)?.value ?? "untyped";
            const formulaFor = (outcome: BlastOutcome, melee = true) => {
                return action.damage({
                    element: config.element,
                    damageType,
                    melee,
                    outcome,
                    getFormula: true,
                });
            };

            return {
                ...config,
                action,
                damageType,
                formula: {
                    melee: {
                        damage: await formulaFor("success"),
                        critical: await formulaFor("criticalSuccess"),
                    },
                    ranged: {
                        damage: await formulaFor("success", false),
                        critical: await formulaFor("criticalSuccess", false),
                    },
                },
                item,
                label: (_cached.labels[config.label] ??= game.i18n.localize(config.label)),
            };
        })
    );

    if (elementTrait) {
        return blastsData[0];
    } else {
        return blastsData.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    }
}

function onBlastsClickAction(
    event: MouseEvent,
    sidebarItem: ActionsSidebarBlastCost | ActionsSidebarBlast,
    action: Stringptionel<CostEventAction>,
    target: HTMLElement
) {
    if (event.button !== 0) return;

    if (sidebarItem instanceof ActionsSidebarBlastCost) {
        onBlastCostClickAction(sidebarItem, action as CostEventAction);
    } else {
        onBlastClickAction(event, sidebarItem, action as BlastEventAction, target);
    }
}

function onBlastClickAction(
    event: MouseEvent,
    sidebarItem: ActionsSidebarBlast,
    action: BlastEventAction,
    target: HTMLElement
) {
    if (action === "blast-attack") {
        const { mapIncreases, melee } = target.dataset as BlastAttackDataset;
        sidebarItem.attack(event, melee === "true", Number(mapIncreases));
    } else if (action === "blast-damage") {
        const { melee, outcome } = target.dataset as BlastDamageDataset;
        sidebarItem.damage(event, melee === "true", outcome);
    } else if (action === "blast-set-damage-type") {
        const type = target.dataset.value;

        if (objectHasKey(CONFIG.PF2E.damageTypes, type)) {
            sidebarItem.setDamageType(type);
        }
    }
}

function onBlastCostClickAction(sidebarItem: ActionsSidebarBlastCost, action: CostEventAction) {
    if (action === "toggle-blast-action-cost") {
        sidebarItem.toggleRollOption();
    }
}

type BlastId = `blast-${EffectTrait}`;

type BlastOutcome = "success" | "criticalSuccess";

type BlastDamageDataset = {
    melee: `${boolean}`;
    outcome: BlastOutcome;
};

type BlastAttackDataset = {
    melee: `${boolean}`;
    mapIncreases: `${number}`;
};

type BlastsContext = {
    actions: ActionsSidebarBlast[];
    cost: ActionsSidebarBlastCost;
    filterValue: FilterValue;
};

type BlastEventAction = "blast-attack" | "blast-damage" | "blast-set-damage-type";
type CostEventAction = "toggle-blast-action-cost";

type ElementalBlastsData = CharacterSheetData["elementalBlasts"][number] & {
    action: ElementalBlast;
    item: AbilityItemPF2e<CharacterPF2e>;
};

type BlastRollOptionsCost = {
    selected: boolean;
    cost: "1" | "2";
    label: string;
    tooltip: string;
};

export {
    ActionsSidebarBlast,
    ActionsSidebarBlastCost,
    ELEMENTAL_BLAST_IMG,
    getElementalBlastsData,
    getSidebarBlastsData,
    onBlastsClickAction,
};
export type { BlastsContext };
