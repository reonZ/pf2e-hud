import { ActorPF2e, R, ValueAndMax } from "module-helpers";

const COVER_UUID = "Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi";

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

export { createSlider, getCoverEffect };
export type { SliderData };
