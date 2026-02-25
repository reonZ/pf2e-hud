import { ELEMENTAL_BLAST_IMG } from "hud";
import { generateToggleShortcutFields, ToggleShortcut, ToggleShortcutSchema } from "..";
import { ImageFilePath, localize } from "foundry-helpers";

class BlastCostShortcut extends ToggleShortcut {
    static defineSchema(): ToggleShortcutSchema {
        return generateToggleShortcutFields("blastCost");
    }

    get canAltUse(): boolean {
        return false;
    }

    get title(): string {
        return localize("shortcuts.blast.cost.label");
    }

    get usedImage(): ImageFilePath {
        return ELEMENTAL_BLAST_IMG;
    }

    get checkbox(): { checked: boolean } | null {
        return null;
    }

    get altUseLabel(): string {
        return game.i18n.localize("PF2E.EditItemTitle");
    }

    get overlay(): string | null {
        return this.selected ? (this.selected.value === "2" ? "Ⅱ" : "Ⅰ") : null;
    }

    use(): void {
        const actor = this.item?.actor;
        const selected = this.selected;
        if (!selected || !actor) return;

        actor.toggleRollOption("elemental-blast", "action-cost", this.itemId, true, selected.value === "2" ? "1" : "2");
    }

    altUse(): void {
        this.item?.sheet.render(true);
    }
}

export { BlastCostShortcut };
