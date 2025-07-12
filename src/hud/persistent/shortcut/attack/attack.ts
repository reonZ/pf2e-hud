import { CreaturePF2e, EffectTrait, IdField, ItemPF2e, localize } from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    PersistentShortcut,
    ShortcutSource,
} from "..";

function generateAttackShortcutFields(type: string): AttackShortcutSchema {
    return {
        ...generateBaseShortcutFields(type),
        itemId: new IdField({
            required: true,
            nullable: false,
        }),
    };
}

abstract class AttackShortcut<
    TSchema extends AttackShortcutSchema,
    TItem extends ItemPF2e,
    TData extends Record<string, any>
> extends PersistentShortcut<TSchema, TItem> {
    #attackData: Maybe<TData>;

    static async getItem(actor: CreaturePF2e, data: AttackShortcutData): Promise<Maybe<ItemPF2e>> {
        return actor.items.get(data.itemId);
    }

    abstract _getAttackData(): Promise<Maybe<TData>>;

    async _initShortcut(): Promise<void> {
        this.#attackData = await this._getAttackData();
    }

    get attackData(): Maybe<TData> {
        return this.#attackData;
    }

    get canUse(): boolean {
        return !!this.item && !!this.attackData;
    }

    get canAltUse(): boolean {
        return !!this.item && this.actor.isOfType("character");
    }

    get altUseLabel(): string {
        return localize("shortcuts.tooltip.altUse", this.type);
    }

    get unusableReason(): string | undefined {
        return !this.item ? "match" : !this.attackData ? "available" : undefined;
    }
}

interface AttackShortcut<
    TSchema extends AttackShortcutSchema,
    TItem extends ItemPF2e,
    TData extends Record<string, any>
> extends ModelPropsFromSchema<AttackShortcutSchema> {
    type: "strike" | "blast";
}

type RollActionMacroParams =
    | { elementTrait?: EffectTrait }
    | { itemId?: string; slug?: string; type?: "blast" | "strike" };

type AttackShortcutSchema = BaseShortcutSchema & {
    itemId: IdField<true, false, false>;
};

type AttackShortcutData = ShortcutSource<AttackShortcutSchema>;

export { AttackShortcut, generateAttackShortcutFields };
export type { AttackShortcutData, AttackShortcutSchema, RollActionMacroParams };
