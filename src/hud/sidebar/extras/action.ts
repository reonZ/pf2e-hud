import { rollRecallKnowledge } from "actions";
import {
    BaseSidebarItem,
    BaseStatisticAction,
    BaseStatisticRollOptions,
    ExtraActionShortcutData,
    FilterValue,
    RawBaseActionData,
    StatisticType,
} from "hud";
import { AbilityItemPF2e, ActorPF2e, DialogV2Button, MODULE, R, SYSTEM, SaveType, signedInteger } from "module-helpers";

const RAW_EXTRAS_ACTIONS = [
    {
        key: "aid",
        actionCost: "reaction",
        dc: 15,
        notes: [
            {
                outcome: ["criticalFailure", "success", "criticalSuccess"],
                text: "@UUID[Compendium.pf2e.other-effects.Item.AHMUpMbaVkZ5A1KX]{Effect: Aid}",
                sf2e: "@UUID[Compendium.sf2e.other-effects.Item.AHMUpMbaVkZ5A1KX]{Effect: Aid}",
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
        key: "arrest-a-fall",
        actionCost: "reaction",
        sourceId: "Compendium.pf2e.actionspf2e.Item.qm7xptMSozAinnPS",
        choices: ["reflex", "acrobatics"],
    },
    {
        key: "grab-an-edge",
        actionCost: "reaction",
        sourceId: "Compendium.pf2e.actionspf2e.Item.3yoajuKjwHZ9ApUY",
        choices: ["reflex", "athletics"],
    },
    {
        key: "escape",
        actionCost: 1,
        sourceId: "Compendium.pf2e.actionspf2e.Item.SkZAQRkLLkmBQNB9",
        variants: { agile: false },
    },
    {
        key: "point-out",
        actionCost: 1,
        sourceId: "Compendium.pf2e.actionspf2e.Item.sn2hIy1iIJX9Vpgj",
    },
    {
        key: "earnIncome",
        sourceId: "Compendium.pf2e.actionspf2e.Item.QyzlsLrqM0EEwd7j",
    },
] as const satisfies ExtrasActionData[];

const EXTRAS_KEYS = RAW_EXTRAS_ACTIONS.map(({ key }) => key);

class ExtrasSidebarItem extends BaseSidebarItem<AbilityItemPF2e, ExtractedExtraActionData> {
    async roll(actor: ActorPF2e, event: MouseEvent, options: BaseStatisticRollOptions) {
        if (!options.statistic && this.hasChoices) {
            const result = await new Promise<StatisticType | SaveType | null>((resolve) => {
                const buttons: DialogV2Button[] = R.pipe(
                    this.choices,
                    R.map((slug): DialogV2Button | undefined => {
                        const statistic = actor.getStatistic(slug);
                        if (!statistic) return;

                        return {
                            action: slug,
                            label: `${statistic.label} ${signedInteger(statistic.mod)}`,
                            callback: () => {
                                return resolve(slug);
                            },
                        };
                    }),
                    R.filter(R.isTruthy),
                );

                foundry.applications.api.DialogV2.wait({
                    buttons,
                    classes: ["pf2e-hud-action-choices"],
                    close: () => {
                        resolve(null);
                    },
                    window: {
                        title: this.label,
                    },
                });
            });

            if (!result) {
                return;
            }

            options.statistic = result;
        }

        getExtraAction(this.sourceId)?.roll(actor, event, options);
    }

    toShortcut(): ExtraActionShortcutData {
        return {
            img: this.img,
            key: this.key,
            name: this.label,
            sourceId: this.sourceId,
            type: "extraAction",
        };
    }
}
interface ExtrasSidebarItem extends Readonly<ExtractedExtraActionData> {
    get key(): ExtraActionKey;
}

class ExtraAction extends BaseStatisticAction<ExtrasActionData, AbilityItemPF2e> {
    #filterValue?: FilterValue;
    #label?: string;

    get label(): string {
        return (this.#label ??= game.i18n.localize(`PF2E.Actions.${this.actionKey}.Title`));
    }

    get filterValue(): FilterValue {
        return (this.#filterValue ??= new FilterValue(this.label));
    }

    get isProficient(): boolean {
        return true;
    }

    get choices(): (StatisticType | SaveType)[] {
        return this.data.choices ?? [];
    }

    get hasChoices(): boolean {
        return this.choices.length > 1;
    }

    async roll(actor: ActorPF2e, event: MouseEvent, options: BaseStatisticRollOptions) {
        if (this.key === "earnIncome") {
            return game.pf2e.actions.earnIncome(actor);
        }

        if (this.key === "recall-knowledge") {
            return actor.isOfType("creature") && rollRecallKnowledge(actor);
        }

        const rollOptions = {
            ...options,
        };

        if (this.key === "aid") {
            rollOptions.statistic = "perception";
            rollOptions.alternates = true;
        }

        super.roll(actor, event, rollOptions);
    }
}

const _cachedExtrasActions: Collection<ExtraAction> = new Collection();
async function prepareExtrasActions() {
    if (_cachedExtrasActions.size) return;

    const isSF2e = SYSTEM.isSF2e;

    await Promise.all(
        RAW_EXTRAS_ACTIONS.map(async (data: ExtrasActionData) => {
            if (isSF2e) {
                // all the extra actions are easily convertible to their sf2e variant
                data.sourceId = data.sourceId.replace("pf2e.actionspf2e", "sf2e.actions") as CompendiumItemUUID;
            }

            const sourceItem = await fromUuid<AbilityItemPF2e>(data.sourceId);
            if (!(sourceItem instanceof Item)) return;

            if (isSF2e && data.notes?.length) {
                for (const note of data.notes) {
                    note.text = note.sf2e;
                }
            }

            const action = new ExtraAction(data, sourceItem);
            _cachedExtrasActions.set(action.sourceId, action);
        }),
    );
}

function getExtrasActions(): Collection<ExtraAction> {
    return _cachedExtrasActions!;
}

function getExtraAction(sourceId: string): ExtraAction | undefined {
    return _cachedExtrasActions.get(sourceId);
}

function getExtraKeys(): string[] {
    return EXTRAS_KEYS;
}

type ExtrasActionData = RawBaseActionData & {
    choices?: (StatisticType | SaveType)[];
};

type ExtraActionKey = (typeof RAW_EXTRAS_ACTIONS)[number]["key"];

type ExtractedExtraActionData = Omit<ExtractReadonly<ExtraAction>, "data">;

MODULE.devExpose({ getExtrasActions });

export { ExtrasSidebarItem, RAW_EXTRAS_ACTIONS, getExtraAction, getExtraKeys, getExtrasActions, prepareExtrasActions };
export type { ExtraAction, ExtraActionKey, ExtractedExtraActionData, ExtrasActionData };
