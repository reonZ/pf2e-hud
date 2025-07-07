import {
    CreaturePF2e,
    IdField,
    ItemPF2e,
    localize,
    RollOptionToggle,
    Suboption,
} from "module-helpers";
import { BaseShortcutSchema, generateBaseShortcutFields, PersistentShortcut } from ".";
import fields = foundry.data.fields;

function generateToggleShortcutFields(type: string): ToggleShortcutSchema {
    return {
        ...generateBaseShortcutFields(type),
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

class ToggleShortcut extends PersistentShortcut<ToggleShortcutSchema, ItemPF2e> {
    #toggle: RollOptionToggle | null;
    #selected: Suboption | undefined;

    constructor(
        actor: CreaturePF2e,
        data: DeepPartial<SourceFromSchema<ToggleShortcutSchema>>,
        slot: number,
        options?: DataModelConstructionOptions<null>
    ) {
        super(actor, data, slot, options);

        this.#toggle = this.actor.synthetics.toggles[this.domain]?.[this.option] ?? null;
        this.#selected = this.#toggle?.suboptions.find((suboption) => suboption.selected);
    }

    static defineSchema(): ToggleShortcutSchema {
        return generateToggleShortcutFields("toggle");
    }

    static getItem(actor: CreaturePF2e, { itemId }: ToggleShortcutData): Maybe<ItemPF2e> {
        return actor.items.get(itemId);
    }

    get toggle(): RollOptionToggle | null {
        return this.#toggle;
    }

    get title(): string {
        return this.toggle?.label ?? this.name;
    }

    get selected(): Suboption | undefined {
        return this.#selected;
    }

    get subtitle(): string {
        const toggle = this.toggle;

        const subtitle = this.selected
            ? game.i18n.localize(this.selected.label)
            : localize("shortcuts.tooltip.subtitle.toggle");

        const active =
            toggle && !toggle.alwaysActive
                ? localize("shortcuts.tooltip", toggle.checked ? "enabled" : "disabled")
                : null;

        return active ? `${subtitle} (${active})` : subtitle;
    }

    get canUse(): boolean {
        return super.canUse && !!this.toggle;
    }

    get canAltUse(): boolean {
        return this.canUse && (this.toggle?.suboptions.length ?? 0) > 1;
    }

    get checkbox(): { checked: boolean } | null {
        const toggle = this.toggle;
        return this.item && toggle?.alwaysActive === false ? { checked: toggle.checked } : null;
    }

    get unusableReason(): string | undefined {
        return !this.item ? "match" : !this.toggle ? "available" : undefined;
    }

    get altUseLabel(): string {
        return (this.toggle?.suboptions.length ?? 0) > 1
            ? localize("shortcuts.tooltip.altUse.toggle")
            : super.altUseLabel;
    }

    use(event: Event): void {
        const toggle = this.toggle;
        if (!toggle || toggle.alwaysActive) return;
        this.actor.toggleRollOption(this.domain, this.option, !toggle.checked);
    }

    altUse(event: Event): void {
        const toggle = this.toggle;
        const selected = this.selected;

        if (!toggle || !selected || toggle.suboptions.length <= 1) {
            return super.altUse(event);
        }

        this.radialMenu(this.title, toggle.suboptions, (value) => {
            this.actor.toggleRollOption(
                this.domain,
                this.option,
                this.itemId,
                toggle.checked,
                value
            );
        });
    }
}

interface ToggleShortcut extends ModelPropsFromSchema<ToggleShortcutSchema> {}

type ToggleShortcutSchema = BaseShortcutSchema & {
    domain: fields.StringField<string, string, true, false, false>;
    itemId: IdField<true, false, false>;
    option: fields.StringField<string, string, true, false, false>;
};

type ToggleShortcutData = SourceFromSchema<ToggleShortcutSchema>;

export { generateToggleShortcutFields, ToggleShortcut };
export type { ToggleShortcutData, ToggleShortcutSchema };
