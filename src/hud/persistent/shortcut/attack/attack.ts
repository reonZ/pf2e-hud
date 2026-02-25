import {
    AttackPopout,
    CharacterPF2e,
    CreaturePF2e,
    EffectTrait,
    ItemPF2e,
    localize,
    ModelPropsFromSchema,
} from "foundry-helpers";
import { BaseShortcutSchema, generateBaseShortcutFields, PersistentShortcut, ShortcutSource } from "..";
import { IdField } from "_utils";

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
    TData extends { label: string },
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

    get canAltUse(): boolean {
        return !!this.item && !!this.attackData && this.actor.isOfType("character");
    }

    get altUseLabel(): string {
        return localize("shortcuts.tooltip.altUse", this.type);
    }

    get unusableReason(): string | undefined {
        return !this.item ? "match" : !this.attackData ? "available" : undefined;
    }

    get title(): string {
        return this.attackData ? this.attackData.label : this.name;
    }

    get subtitle(): string {
        return localize("shortcuts.tooltip.subtitle", this.type);
    }

    altUse(event: MouseEvent): void {
        Hooks.once("renderAttackPopout", (popup: AttackPopout<CharacterPF2e>) => {
            const html = popup.element[0];
            const bounds = html.getBoundingClientRect();
            const left = Math.max(event.x - bounds.width / 2, 50);
            const top = Math.min(event.y - bounds.height / 2 - 15, window.innerHeight - 50 - bounds.height);

            popup.setPosition({ left, top });
        });
    }
}

interface AttackShortcut<
    TSchema extends AttackShortcutSchema,
    TItem extends ItemPF2e,
    TData extends { label: string },
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
