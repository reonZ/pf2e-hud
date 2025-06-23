import { ActorPF2e, ItemPF2e, R, ValueAndMax, ZeroToTwo } from "module-helpers";

const COVER_UUID = "Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi";

class FilterValue {
    #list: string[];

    constructor(...entries: (string | ItemPF2e | FilterValue)[]) {
        this.#list = [];
        this.add(...entries);
    }

    add(...entries: (string | ItemPF2e | FilterValue)[]) {
        for (const entry of entries) {
            if (entry instanceof Item) {
                this.#list.push(entry.name);
            } else if (entry instanceof FilterValue) {
                this.#list.push(...entry.#list);
            } else {
                this.#list.push(entry);
            }
        }
    }

    toString(): string {
        return R.pipe(
            this.#list,
            R.unique(),
            R.map((entry) => entry.toLowerCase()),
            R.join("|")
        );
    }
}

function getMapValue(map: 1 | 2, agile = false) {
    return map === 1 ? (agile ? -4 : -5) : agile ? -8 : -10;
}

function getMapLabel(map: ZeroToTwo, agile?: boolean) {
    return map === 0
        ? game.i18n.localize("PF2E.Roll.Normal")
        : game.i18n.format("PF2E.MAPAbbreviationLabel", {
              penalty: getMapValue(map, agile),
          });
}

function getCoverEffect(actor: ActorPF2e) {
    return actor.itemTypes.effect.find((effect) => effect.sourceId === COVER_UUID);
}

function createSlider(
    action: string,
    { max, value, min }: ValueAndMax & { min?: number }
): SliderData {
    return {
        action,
        canBack: R.isNumber(min) ? value > min : value > 0,
        canForward: value < max,
        value,
    };
}

type SliderData = {
    action: string;
    canBack: boolean;
    canForward: boolean;
    value: number;
};

export { createSlider, FilterValue, getCoverEffect, getMapLabel, getMapValue };
export type { SliderData };
