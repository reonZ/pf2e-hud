import { AttackPopout, CharacterPF2e, CreaturePF2e, ItemPF2e, localize, z, zDocumentId } from "foundry-helpers";
import { PersistentShortcut, ShortcutData, zBaseShortcut } from "..";

function zAttackShortcut(type: string) {
    return zBaseShortcut(type).extend({
        itemId: zDocumentId(true),
    });
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
> extends ShortcutData<AttackShortcutSchema> {
    type: "strike" | "blast";
}

type AttackShortcutSchema = ReturnType<typeof zAttackShortcut>;
type AttackShortcutSource = z.input<AttackShortcutSchema>;
type AttackShortcutData = z.output<AttackShortcutSchema>;

export { AttackShortcut, zAttackShortcut };
export type { AttackShortcutData, AttackShortcutSchema, AttackShortcutSource };
