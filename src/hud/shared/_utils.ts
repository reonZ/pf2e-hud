import { ActorPF2e, R, ValueAndMax, ZeroToTwo } from "module-helpers";

const COVER_UUID = "Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi";

type FilterValueEntry = string | FilterValue | { filterValue: FilterValue };

class FilterValue {
    #list: string[];

    constructor(...entries: FilterValueEntry[]) {
        this.#list = [];
        this.add(...entries);
    }

    add(...entries: FilterValueEntry[]) {
        for (const entry of entries) {
            if (R.isString(entry)) {
                this.#list.push(entry);
            } else if (entry instanceof FilterValue) {
                this.#list.push(...entry.#list);
            } else if ("filterValue" in entry && entry.filterValue instanceof FilterValue) {
                this.#list.push(...entry.filterValue.#list);
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
