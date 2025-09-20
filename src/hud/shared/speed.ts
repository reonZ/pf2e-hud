import { ActorPF2e, CreaturePF2e, CreatureSpeeds, getFlag, MovementType, R } from "module-helpers";
import { getGlobalSetting } from "settings";

const SPEEDS_ICONS = {
    land: "fa-solid fa-shoe-prints",
    burrow: "fa-solid fa-chevrons-down",
    climb: "fa-solid fa-spider",
    fly: "fa-solid fa-feather",
    swim: "fa-solid fa-person-swimming",
};

function getAllSpeeds(actor: CreaturePF2e): ActorSpeeds | undefined {
    const speeds: HudSpeed[] = R.pipe(
        R.values(actor.movement.speeds),
        R.filter((speed): speed is ModuleSpeed => {
            return (
                R.isTruthy(speed) &&
                speed.type !== "travel" &&
                (speed.type === "land" || speed.value > 0)
            );
        }),
        R.map(({ type, value, label }): HudSpeed => {
            return {
                icon: SPEEDS_ICONS[type],
                total: value,
                label,
                type,
            };
        })
    );

    if (!speeds.length) return;

    return {
        mainSpeed: getMainSpeed(actor, speeds),
        speeds,
    };
}

function getMainSpeed(actor: ActorPF2e, speeds: HudSpeed[]): HudSpeed {
    if (speeds.length === 1) {
        return speeds.shift()!;
    }

    const selectedSpeed = getFlag<MovementType>(actor, "speed");
    if (selectedSpeed) {
        const speed = speeds.findSplice((speed) => speed.type === selectedSpeed);
        if (speed) {
            return speed;
        }
    }

    if (!getGlobalSetting("highestSpeed") && speeds[0].total > 0) {
        return speeds.shift()!;
    }

    const highestSpeed = R.firstBy(speeds, [R.prop("total"), "desc"])!;
    return speeds.findSplice((speed) => speed === highestSpeed)!;
}

type HudSpeed = {
    icon: string;
    total: number;
    label: string | undefined;
    type: "land" | "burrow" | "climb" | "fly" | "swim";
};

type ActorSpeeds = {
    mainSpeed: HudSpeed;
    speeds: HudSpeed[];
};

type ModuleSpeed = NonNullable<Omit<CreatureSpeeds<CreaturePF2e>, "travel">[MovementType]>;

export { getAllSpeeds };
export type { HudSpeed };
