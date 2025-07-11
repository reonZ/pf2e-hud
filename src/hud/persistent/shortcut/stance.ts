import {
    AbilityItemPF2e,
    CreaturePF2e,
    EffectPF2e,
    FeatPF2e,
    hasItemWithSourceId,
    IdField,
    localize,
} from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    PersistentShortcut,
    ShortcutSource,
} from ".";
import fields = foundry.data.fields;
import { toggleStance } from "hud/sidebar";

class StanceShortcut extends PersistentShortcut<
    StanceShortcutSchema,
    FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>
> {
    #active?: boolean;
    #sourceEffect!: EffectPF2e | CompendiumIndexData | null;

    static defineSchema(): StanceShortcutSchema {
        return {
            ...generateBaseShortcutFields("stance"),
            effectUUID: new fields.DocumentUUIDField({
                required: true,
                nullable: false,
                type: "Item",
            }),
            itemId: new IdField({
                required: true,
                nullable: false,
            }),
        };
    }

    static async getItem(
        actor: CreaturePF2e,
        data: StanceShortcutData
    ): Promise<Maybe<FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>>> {
        return actor.items.get<FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>>(data.itemId);
    }

    async _initShortcut(): Promise<void> {
        this.#sourceEffect = fromUuidSync<EffectPF2e>(this.effectUUID);
    }

    get active(): boolean {
        return (this.#active ??= !!this.item && hasItemWithSourceId(this.actor, this.effectUUID));
    }

    get sourceEffect(): EffectPF2e | CompendiumIndexData | null {
        return this.#sourceEffect;
    }

    get usedImage(): ImageFilePath {
        return this.sourceEffect?.img ?? this.img;
    }

    get checkbox(): { checked: boolean } | null {
        return this.item ? { checked: this.active } : null;
    }

    get icon(): string {
        return "fa-solid fa-person";
    }

    get subtitle(): string {
        const label = game.i18n.localize("PF2E.TraitStance");
        if (!this.item) {
            return label;
        }

        const active = localize("shortcuts.tooltip", this.active ? "active" : "inactive");
        return `${label} (${active})`;
    }

    use(event: MouseEvent): void {
        toggleStance(this.actor, this.effectUUID, event.ctrlKey);
    }
}

interface StanceShortcut extends ModelPropsFromSchema<StanceShortcutSchema> {}

type StanceShortcutSchema = BaseShortcutSchema & {
    effectUUID: fields.DocumentUUIDField<DocumentUUID, true, false, false>;
    itemId: IdField<true, false, false>;
};

type StanceShortcutData = ShortcutSource<StanceShortcutSchema> & {
    type: "stance";
};

export { StanceShortcut };
export type { StanceShortcutData };
