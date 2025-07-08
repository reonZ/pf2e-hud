import { FilterValue } from "hud/shared";
import { AbilityItemPF2e, MODULE } from "module-helpers";
import { RAW_EXTRAS_ACTIONS, RawExtrasActionData } from ".";
import {
    BaseStatisticAction,
    createMapsVariantsCollection,
    MapVariant,
    SingleCheckActionRollNoteData,
} from "..";

class ExtraAction extends BaseStatisticAction<RawExtrasActionData, AbilityItemPF2e> {
    #filterValue?: FilterValue;
    #label?: string;
    #variants?: Collection<MapVariant>;

    get label(): string {
        return (this.#label ??= game.i18n.localize(`PF2E.Actions.${this.actionKey}.Title`));
    }

    get filterValue(): FilterValue {
        return (this.#filterValue ??= new FilterValue(this.label));
    }

    get isProficient(): boolean {
        return true;
    }

    get dc(): number | undefined {
        return this.data.dc;
    }

    get notes(): SingleCheckActionRollNoteData[] | undefined {
        return this.data.notes;
    }

    get hasVariants(): boolean {
        return false;
    }

    get variants(): Collection<MapVariant> {
        if (this.#variants !== undefined) {
            return this.#variants;
        }

        if (!this.data.map) {
            return new Collection();
        }

        return (this.#variants = createMapsVariantsCollection(this.label));
    }
}

const _cachedExtrasActions: Collection<ExtraAction> = new Collection();
async function prepareExtrasActions() {
    if (_cachedExtrasActions.size) return;

    for (const data of RAW_EXTRAS_ACTIONS) {
        const sourceItem = await fromUuid<AbilityItemPF2e>(data.sourceId);
        if (!(sourceItem instanceof Item)) return;

        const action = new ExtraAction(data, sourceItem);
        _cachedExtrasActions.set(action.sourceId, action);
    }
}

function getExtrasActions(): Collection<ExtraAction> {
    return _cachedExtrasActions!;
}

function getExtraAction(sourceId: string): ExtraAction | undefined {
    return _cachedExtrasActions.get(sourceId);
}

type ExtractedExtraActionData = Omit<ExtractReadonly<ExtraAction>, "data">;

MODULE.devExpose({ getExtrasActions });

export { getExtraAction, getExtrasActions, prepareExtrasActions };
export type { ExtractedExtraActionData };
