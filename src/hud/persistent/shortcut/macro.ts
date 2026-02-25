import { BaseShortcutSchema, generateBaseShortcutFields, PersistentShortcut, ShortcutSource } from ".";
import fields = foundry.data.fields;
import { DocumentUUID, localize, MacroPF2e, ModelPropsFromSchema } from "foundry-helpers";

class MacroShortcut extends PersistentShortcut<MacroShortcutSchema> {
    #macro: Maybe<MacroPF2e>;

    static defineSchema(): MacroShortcutSchema {
        return {
            ...generateBaseShortcutFields("macro"),
            macroUUID: new fields.DocumentUUIDField({
                required: true,
                nullable: false,
                type: "Macro",
            }),
        };
    }

    async _initShortcut() {
        this.#macro = await fromUuid<MacroPF2e>(this.macroUUID);
    }

    get macro(): Maybe<MacroPF2e> {
        return this.#macro;
    }

    get icon(): string {
        return "fa-solid fa-code";
    }

    get subtitle(): string {
        return localize("shortcuts.tooltip.subtitle", this.type);
    }

    get inactive(): boolean {
        return !this.macro;
    }

    get canUse(): boolean {
        return !!this.macro;
    }

    get unusableReason(): string | undefined {
        return !this.macro ? "macro" : undefined;
    }

    use(): void {
        this.macro?.execute({ actor: this.actor });
    }
}

interface MacroShortcut extends ModelPropsFromSchema<MacroShortcutSchema> {}

type MacroShortcutSchema = BaseShortcutSchema & {
    macroUUID: fields.DocumentUUIDField<DocumentUUID, true, false, false>;
};

type MacroShortcutData = ShortcutSource<MacroShortcutSchema> & {
    type: "macro";
};

export { MacroShortcut };
export type { MacroShortcutData };
