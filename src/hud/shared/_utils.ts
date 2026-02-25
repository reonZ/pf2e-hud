import {
    ActorInitiative,
    ActorPF2e,
    BaseSpellcastingEntry,
    CreaturePF2e,
    EffectPF2e,
    InitiativeRollResult,
    R,
    SpellPF2e,
    SYSTEM,
    ValueAndMax,
} from "foundry-helpers";
import { eventToRollParams } from "foundry-helpers/dist";

const COVER_UUID = SYSTEM.uuid(
    "Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi",
    "Compendium.sf2e.other-effects.Item.I9lfZUiCwMiGogVi",
);

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
            R.join("|"),
        );
    }
}

function getCoverEffect(actor: ActorPF2e): EffectPF2e<ActorPF2e> | undefined {
    const uuid = COVER_UUID();
    return actor.itemTypes.effect.find((effect) => effect.sourceId === uuid);
}

function createSlider(action: string, { max, value, min }: ValueAndMax & { min?: number }): SliderData {
    return {
        action,
        canBack: R.isNumber(min) ? value > min : value > 0,
        canForward: value < max,
        value,
    };
}

function rollInitiative(
    event: Event,
    actor: ActorPF2e,
    statistic?: string,
): Promise<InitiativeRollResult | null> | undefined {
    const args = eventToRollParams(event, { type: "check" });

    if (!statistic) {
        return actor.initiative?.roll(args);
    }

    const ActorInit = actor.initiative?.constructor as ConstructorOf<ActorInitiative> | undefined;
    if (!ActorInit) return;

    const initiative = new ActorInit(actor, {
        statistic,
        tiebreakPriority: actor.system.initiative!.tiebreakPriority,
    });

    return initiative.roll(args);
}

function makeFadeable(app: fa.api.ApplicationV2) {
    const onDragStart = () => {
        requestAnimationFrame(() => {
            app.element.classList.add("pf2e-hud-fadeout");

            window.addEventListener(
                "dragend",
                () => {
                    setTimeout(() => {
                        app.element?.classList.remove("pf2e-hud-fadeout");
                    }, 500);
                },
                { once: true, capture: true },
            );
        });
    };

    window.addEventListener("dragstart", onDragStart, true);

    app.addEventListener(
        "close",
        () => {
            window.removeEventListener("dragstart", onDragStart, true);
        },
        { once: true },
    );
}

function isAnimistEntry(entry: BaseSpellcastingEntry<CreaturePF2e>) {
    return foundry.utils.getProperty(entry, "flags.pf2e-dailies.identifier") === "animist-spontaneous";
}

function getUiScale(): number {
    return game.settings.get("core", "uiConfig")?.uiScale ?? 1;
}

function getTextureMask({ scaleX, scaleY }: { scaleX: number; scaleY: number }) {
    if (scaleX >= 1.2 || scaleY >= 1.2) {
        const scale = scaleX > scaleY ? scaleX : scaleY;
        const ringPercent = 100 - Math.floor(((scale - 0.7) / scale) * 100);
        const limitPercent = 100 - Math.floor(((scale - 0.8) / scale) * 100);

        return `radial-gradient(circle at center, black ${ringPercent}%, rgba(0, 0, 0, 0.2) ${limitPercent}%)`;
    }
}

function isFocusCantrip(spell: SpellPF2e): boolean {
    return spell.system.cast.focusPoints > 0 || spell.system.traits.otherTags.includes("psi-cantrip");
}

type SliderData = {
    action: string;
    canBack: boolean;
    canForward: boolean;
    value: number;
};

export {
    COVER_UUID,
    createSlider,
    FilterValue,
    getCoverEffect,
    getTextureMask,
    getUiScale,
    isAnimistEntry,
    isFocusCantrip,
    makeFadeable,
    rollInitiative,
};
export type { SliderData };
