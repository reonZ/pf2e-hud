import {
    AbilityItemPF2e,
    canUseStances,
    CreaturePF2e,
    EffectPF2e,
    FeatPF2e,
    hasItemWithSourceId,
    IdField,
    localize,
    toggleStance,
} from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    PersistentShortcut,
    ShortcutSource,
} from ".";
import fields = foundry.data.fields;

class StanceShortcut extends PersistentShortcut<
    StanceShortcutSchema,
    FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>
> {
    #active: boolean = false;
    #sourceEffect: Maybe<EffectPF2e | CompendiumIndexData>;
    #canUseStances: boolean = false;

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
        if (!this.item) return;

        this.#active = this.cached("hasItemWithSourceId", this.effectUUID, () => {
            return hasItemWithSourceId(this.actor, this.effectUUID, "effect");
        });
        this.#canUseStances = this.cached("canUseStances", () => {
            return canUseStances(this.actor);
        });
        this.#sourceEffect = fromUuidSync<EffectPF2e>(this.effectUUID);
    }

    get canUseStances(): boolean {
        return this.#canUseStances;
    }

    get greyedOut(): boolean {
        return super.greyedOut || !this.canUseStances;
    }

    get active(): boolean {
        return this.#active;
    }

    get sourceEffect(): Maybe<EffectPF2e | CompendiumIndexData> {
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

    get unusableReason(): string | undefined {
        return super.unusableReason ?? (!this.canUseStances ? "combat" : undefined);
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
