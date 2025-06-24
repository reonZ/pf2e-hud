import { CharacterPF2e, ElementTrait, R } from "module-helpers";

async function getElementalBlastsContext(
    actor: CharacterPF2e
): Promise<ContextBlastsData | undefined> {
    const blastOption = actor.synthetics.toggles["elemental-blast"]?.["action-cost"];
    if (!blastOption) return;

    const blasts = await getElementalBlastsData(actor);
    if (!blasts) return;
}

async function getElementalBlastsData(
    actor: CharacterPF2e,
    elementTrait?: ElementTrait
): Promise<ElementalBlastsData | undefined> {
    const blastData = new game.pf2e.ElementalBlast(actor);

    const configs = elementTrait
        ? R.filter([blastData.configs.find((c) => c.element === elementTrait)], R.isTruthy)
        : blastData.configs;

    /**
     * https://github.com/foundryvtt/pf2e/blob/7329c2e1f7bed53e2cae3bae3c35135b22d97a13/src/module/actor/character/sheet.ts#L1178
     */
    const blastsPromise = configs.map(async (config) => {
        const damageType = config.damageTypes.find((dt) => dt.selected)?.value ?? "untyped";
        const formulaFor = (outcome: "success" | "criticalSuccess", melee = true) => {
            return blastData.damage({
                element: config.element,
                damageType,
                melee,
                outcome,
                getFormula: true,
            });
        };

        return {
            ...config,
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
        };
    });

    // const blastData = (
    //     await Promise.all(action.configs.map((c) => this.#getBlastData(action, c)))
    // ).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

type ElementalBlastsData = {};

type ContextBlastsData = {};

export { getElementalBlastsContext };
