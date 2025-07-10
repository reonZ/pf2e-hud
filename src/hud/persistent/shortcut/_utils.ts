import { ConsumablePF2e, ItemPF2e, OneToTen } from "module-helpers";

const ROMAN_RANKS = ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"] as const;

function getItemSlug(item: ItemPF2e): string {
    if (item.isOfType("consumable") && item.system.spell) {
        const spell = item.system.spell;
        const baseSlug = spell.system.slug ?? game.pf2e.system.sluggify(spell.name);
        const rank = getConsumableRank(item);

        return `${baseSlug}-rank-${rank}`;
    }

    return item.slug ?? game.pf2e.system.sluggify(item.name);
}

function getConsumableRank(item: Maybe<ConsumablePF2e>, roman: true): RomanRank | undefined;
function getConsumableRank(item: Maybe<ConsumablePF2e>, roman?: false): OneToTen | undefined;
function getConsumableRank(item: Maybe<ConsumablePF2e>, roman?: boolean) {
    const rank = item?.system.spell
        ? item.system.spell.system.location.heightenedLevel ?? item.system.spell.system.level.value
        : undefined;
    return rank && roman ? ROMAN_RANKS[rank] : rank;
}

type RomanRank = (typeof ROMAN_RANKS)[number];

export { getItemSlug, ROMAN_RANKS };
export type { RomanRank };
