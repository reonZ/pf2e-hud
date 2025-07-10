import { ActionCost } from "module-helpers";
import { RawBaseActionData, SingleCheckActionRollNoteData } from "..";

const RAW_EXTRAS_ACTIONS = [
    {
        key: "aid",
        actionCost: "reaction",
        dc: 15,
        notes: [
            {
                outcome: ["criticalFailure", "success", "criticalSuccess"],
                text: "@UUID[Compendium.pf2e.other-effects.Item.AHMUpMbaVkZ5A1KX]{Effect: Aid}",
            },
        ],
        sourceId: "Compendium.pf2e.actionspf2e.Item.HCl3pzVefiv9ZKQW",
    },
    {
        key: "recall-knowledge",
        actionCost: 1,
        sourceId: "Compendium.pf2e.actionspf2e.Item.1OagaWtBpVXExToo",
    },
    {
        key: "escape",
        actionCost: 1,
        sourceId: "Compendium.pf2e.actionspf2e.Item.SkZAQRkLLkmBQNB9",
        variants: { agile: false },
    },
    {
        key: "earnIncome",
        sourceId: "Compendium.pf2e.actionspf2e.Item.QyzlsLrqM0EEwd7j",
    },
] as const satisfies ExtrasActionData[];

const EXTRAS_KEYS = RAW_EXTRAS_ACTIONS.map(({ key }) => key);

function getExtraKeys(): string[] {
    return EXTRAS_KEYS.slice();
}

type ExtrasActionData = RawBaseActionData & {
    actionCost?: ActionCost["value"] | ActionCost["type"];
    notes?: SingleCheckActionRollNoteData[];
    sourceId: CompendiumItemUUID;
};

type ExtraActionKey = (typeof RAW_EXTRAS_ACTIONS)[number]["key"];

export { getExtraKeys, RAW_EXTRAS_ACTIONS };
export type { ExtraActionKey, ExtrasActionData };
