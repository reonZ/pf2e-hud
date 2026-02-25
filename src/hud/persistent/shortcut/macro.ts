import { localize, MacroPF2e, z, zDocumentUUID } from "foundry-helpers";
import { PersistentShortcut, ShortcutData, zBaseShortcut } from ".";

const zMacroShortcut = zBaseShortcut("macro").extend({
    macroUUID: zDocumentUUID("Macro"),
});

class MacroShortcut extends PersistentShortcut<typeof zMacroShortcut> {
    #macro: Maybe<MacroPF2e>;

    static get schema() {
        return zMacroShortcut;
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

interface MacroShortcut extends ShortcutData<typeof zMacroShortcut> {
    type: "macro";
}

type MacroShortcutSource = z.input<typeof zMacroShortcut>;
type MacroShortcutData = z.output<typeof zMacroShortcut>;

export { MacroShortcut };
export type { MacroShortcutData, MacroShortcutSource };
