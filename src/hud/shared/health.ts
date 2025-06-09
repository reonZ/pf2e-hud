import { ActorPF2e, CharacterAttributes, MODULE } from "module-helpers";

function calculateActorHealth(actor: ActorPF2e): HealthData | undefined {
    const hp = actor.attributes.hp as CharacterAttributes["hp"] | undefined;
    if (!hp || hp.max <= 0) return;

    const currentHP = Math.clamp(hp.value, 0, hp.max);
    const totalTemp = currentHP + hp.temp;

    const useStamina = actor.isOfType("character") && game.pf2e.settings.variants.stamina;
    const maxSP = (useStamina && hp.sp?.max) || 0;
    const currentSP = Math.clamp((useStamina && hp.sp?.value) || 0, 0, maxSP);

    const maxTotal = hp.max + maxSP;
    const currentTotal = currentHP + currentSP + hp.temp;

    const sp = useStamina
        ? { value: currentSP, max: maxSP, ...calculateRatio(currentSP, maxSP) }
        : undefined;

    return {
        ...calculateRatio(currentHP, hp.max),
        value: currentHP,
        max: hp.max,
        temp: hp.temp,
        sp,
        total: { value: currentTotal, max: maxTotal, ...calculateRatio(currentTotal, maxTotal) },
        totalTemp: { value: totalTemp, ...calculateRatio(totalTemp, hp.max) },
    };
}

function calculateRatio(value: number, max: number) {
    // we need to cap it at 130% to avoid color weirdness
    const ratio = Math.min(value / max, 1);
    return {
        ratio,
        hue: ratio * ratio * 122 + 3,
    };
}

type HealthSection = {
    ratio: number;
    hue: number;
    value: number;
    max: number;
};

type HealthData = {
    temp: number;
    sp: HealthSection | undefined;
    total: HealthSection;
    totalTemp: Omit<HealthSection, "max">;
    ratio: number;
    hue: number;
    value: number;
    max: number;
};

MODULE.devExpose({ calculateActorHealth });

export { calculateActorHealth };
export type { HealthData };
