import { R, SpellcastingCategory } from "foundry-helpers";

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

const SPELL_CATEGORY_TYPES = R.keys(SPELL_CATEGORIES);

type SpellCategoryType = Exclude<SpellcastingCategory, "items"> | "charges" | "staff" | "wand" | "scroll" | "flexible";

export { SPELL_CATEGORIES, SPELL_CATEGORY_TYPES };
export type { SpellCategoryType };
