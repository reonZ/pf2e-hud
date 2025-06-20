import { ItemPF2e, R, SpellcastingCategory } from "module-helpers";

const SPELL_CATEGORIES: Record<SpellCategoryType, { icon: string; label: string }> = {
    charges: {
        icon: "fa-solid fa-battery-three-quarters",
        label: "pf2e-hud.spellcasting.charges",
    },
    flexible: {
        icon: "fa-solid fa-book",
        label: "PF2E.SpellFlexibleLabel",
    },
    focus: {
        icon: "fa-solid fa-head-side-brain",
        label: "PF2E.TraitFocus",
    },
    innate: {
        icon: "fa-solid fa-lightbulb",
        label: "PF2E.PreparationTypeInnate",
    },
    prepared: {
        icon: "fa-solid fa-book",
        label: "PF2E.SpellPreparedLabel",
    },
    ritual: {
        icon: "fa-solid fa-hands-praying",
        label: "PF2E.Item.Spell.Ritual.Label",
    },
    spontaneous: {
        icon: "fa-solid fa-bolt-lightning",
        label: "PF2E.PreparationTypeSpontaneous",
    },
    scroll: {
        icon: "fa-solid fa-scroll",
        label: "PF2E.Item.Consumable.Category.scroll",
    },
    staff: {
        icon: "fa-solid fa-staff",
        label: "pf2e-hud.spellcasting.staff",
    },
    wand: {
        icon: "fa-solid fa-wand-magic-sparkles",
        label: "PF2E.Item.Consumable.Category.wand",
    },
};

class SidebarFilter {
    #list: string[];

    constructor(...entries: (string | ItemPF2e | SidebarFilter)[]) {
        this.#list = [];
        this.add(...entries);
    }

    add(...entries: (string | ItemPF2e | SidebarFilter)[]) {
        for (const entry of entries) {
            if (entry instanceof Item) {
                this.#list.push(entry.name);
            } else if (entry instanceof SidebarFilter) {
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

type SpellCategoryType =
    | Exclude<SpellcastingCategory, "items">
    | "charges"
    | "staff"
    | "wand"
    | "scroll"
    | "flexible";

export { SPELL_CATEGORIES, SidebarFilter };
export type { SpellCategoryType };
