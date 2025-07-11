import {
    ActorInitiative,
    ActorPF2e,
    ApplicationV2,
    BaseSpellcastingEntry,
    CreaturePF2e,
    EffectPF2e,
    eventToRollParams,
    InitiativeRollResult,
    R,
    ValueAndMax,
} from "module-helpers";

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

function getCoverEffect(actor: ActorPF2e): EffectPF2e<ActorPF2e> | undefined {
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

function rollInitiative(
    event: Event,
    actor: ActorPF2e,
    statistic?: string
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

function makeFadeable(app: ApplicationV2) {
    const onDragStart = (event: DragEvent) => {
        requestAnimationFrame(() => {
            app.element.classList.add("pf2e-hud-fadeout");

            window.addEventListener(
                "dragend",
                () => {
                    setTimeout(() => {
                        app.element?.classList.remove("pf2e-hud-fadeout");
                    }, 500);
                },
                { once: true, capture: true }
            );
        });
    };

    window.addEventListener("dragstart", onDragStart, true);

    app.addEventListener(
        "close",
        () => {
            window.removeEventListener("dragstart", onDragStart, true);
        },
        { once: true }
    );
}

function isAnimistEntry(entry: BaseSpellcastingEntry<CreaturePF2e>) {
    return (
        foundry.utils.getProperty(entry, "flags.pf2e-dailies.identifier") === "animist-spontaneous"
    );
}

function getUiScale(): number {
    return game.settings.get<{ uiScale?: number }>("core", "uiConfig")?.uiScale ?? 1;
}

type SliderData = {
    action: string;
    canBack: boolean;
    canForward: boolean;
    value: number;
};

export {
    createSlider,
    FilterValue,
    getCoverEffect,
    getUiScale,
    isAnimistEntry,
    makeFadeable,
    rollInitiative,
};
export type { SliderData };
