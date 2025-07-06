import { CreaturePF2e, IdField, ItemPF2e, localize, RollOptionToggle } from "module-helpers";
import { BaseShortcutSchema, generateBaseShortcutFields, PersistentShortcut } from ".";
import fields = foundry.data.fields;

class ToggleShortcut extends PersistentShortcut<ToggleShortcutSchema, ItemPF2e> {
    #toggle?: RollOptionToggle | null;

    static defineSchema(): ToggleShortcutSchema {
        return {
            ...generateBaseShortcutFields("toggle"),
            domain: new fields.StringField({
                required: true,
                nullable: false,
                blank: false,
            }),
            itemId: new IdField({
                required: true,
                nullable: false,
            }),
            option: new fields.StringField({
                required: true,
                nullable: false,
                blank: false,
            }),
        };
    }

    static getItem(actor: CreaturePF2e, { itemId }: ToggleShortcutData): Maybe<ItemPF2e> {
        return actor.items.get(itemId);
    }

    get toggle(): RollOptionToggle | null {
        if (this.#toggle !== undefined) {
            return this.#toggle;
        }

        return (this.#toggle = this.actor.synthetics.toggles[this.domain]?.[this.option] ?? null);
    }

    get subtitle(): string {
        const toggle = this.toggle;
        const subtitle = localize("shortcuts.tooltip.subtitle", this.type);
        const checked = toggle
            ? localize("shortcuts.tooltip", toggle.checked ? "enabled" : "disabled")
            : null;

        return checked ? `${subtitle} (${checked})` : subtitle;
    }

    get canUse(): boolean {
        return super.canUse && !!this.toggle;
    }

    // get canAltUse(): boolean {
    //     return false;
    // }

    get checkbox(): { checked: boolean } | null {
        const toggle = this.toggle;
        return this.item && toggle?.alwaysActive === false ? { checked: toggle.checked } : null;
    }

    get unusableReason(): string | undefined {
        return !this.item ? "match" : undefined;
    }

    // get altUseLabel(): string {
    //     return "";
    // }

    use(event: Event): void {
        const toggle = this.toggle;
        if (!toggle) return;
        this.actor.toggleRollOption(this.domain, this.option, !toggle.checked);
    }

    // altUse(event: Event): void {
    //     this.item?.sheet.render(true);
    // }
}

interface ToggleShortcut extends ModelPropsFromSchema<ToggleShortcutSchema> {}

type ToggleShortcutSchema = BaseShortcutSchema & {
    domain: fields.StringField<string, string, true, false, false>;
    itemId: IdField<true, false, false>;
    option: fields.StringField<string, string, true, false, false>;
};

type ToggleShortcutData = SourceFromSchema<ToggleShortcutSchema>;

export { ToggleShortcut };
export type { ToggleShortcutData, ToggleShortcutSchema };
