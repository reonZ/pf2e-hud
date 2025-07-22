import {
    CreaturePF2e,
    ItemPF2e,
    localize,
    RollOptionToggle,
    Suboption,
    warning,
} from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    PersistentShortcut,
    ShortcutSource,
} from "..";
import fields = foundry.data.fields;

function generateToggleShortcutFields(type: string): ToggleShortcutSchema {
    return {
        ...generateBaseShortcutFields(type),
        domain: new fields.StringField({
            required: true,
            nullable: false,
            blank: false,
        }),
        option: new fields.StringField({
            required: true,
            nullable: false,
            blank: false,
        }),
    };
}

class ToggleShortcut extends PersistentShortcut<ToggleShortcutSchema, ItemPF2e> {
    #toggle?: RollOptionToggle;
    #selected?: Suboption;

    static defineSchema(): ToggleShortcutSchema {
        return generateToggleShortcutFields("toggle");
    }

    static async getItem(
        actor: CreaturePF2e,
        { domain, option }: ToggleShortcutData
    ): Promise<Maybe<ItemPF2e>> {
        const itemId = actor.synthetics.toggles[domain]?.[option]?.itemId ?? "";
        return actor.items.get(itemId);
    }

    async _initShortcut(): Promise<void> {
        this.#toggle = this.actor.synthetics.toggles[this.domain]?.[this.option];
        this.#selected = this.#toggle?.suboptions.find((suboption) => suboption.selected);
    }

    get toggle(): RollOptionToggle | undefined {
        return this.#toggle;
    }

    get itemId() {
        return this.toggle?.itemId;
    }

    get selected(): Suboption | undefined {
        return this.#selected;
    }

    get title(): string {
        return this.toggle?.label ?? this.name;
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

    get icon(): string {
        return "fa-solid fa-gear";
    }

    get checkbox(): { checked: boolean } | null {
        const toggle = this.toggle;
        return this.item && !!toggle ? { checked: toggle.checked } : null;
    }

    get unusableReason(): string | undefined {
        return !this.item ? "match" : !this.toggle ? "available" : undefined;
    }

    get altUseLabel(): string {
        return (this.toggle?.suboptions.length ?? 0) > 1
            ? localize("shortcuts.tooltip.altUse.toggle")
            : super.altUseLabel;
    }

    use(event: MouseEvent): void {
        const toggle = this.toggle;
        if (!toggle) return;

        if (toggle.alwaysActive) {
            warning("shortcuts.use.toggle");
        } else {
            this.actor.toggleRollOption(this.domain, this.option, !toggle.checked);
        }
    }

    altUse(event: MouseEvent): void {
        const toggle = this.toggle;
        const selected = this.selected;

        if (!toggle || !selected || toggle.suboptions.length <= 1) {
            return super.altUse(event);
        }

        this.radialMenu(
            () => {
                return [
                    {
                        title: this.title,
                        options: toggle.suboptions,
                    },
                ];
            },
            (event, value) => {
                this.actor.toggleRollOption(
                    this.domain,
                    this.option,
                    this.itemId,
                    toggle.checked,
                    value
                );
            }
        );
    }
}

interface ToggleShortcut extends ModelPropsFromSchema<ToggleShortcutSchema> {}

type ToggleShortcutSchema = BaseShortcutSchema & {
    domain: fields.StringField<string, string, true, false, false>;
    option: fields.StringField<string, string, true, false, false>;
};

type ToggleShortcutData = ShortcutSource<ToggleShortcutSchema> & {
    type: "toggle" | "blastCost";
};

export { generateToggleShortcutFields, ToggleShortcut };
export type { ToggleShortcutData, ToggleShortcutSchema };
