import { ImageFilePath, localize } from "foundry-helpers";
import { ELEMENTAL_BLAST_IMG } from "hud";
import { ToggleShortcut, zBaseToggleShortcut } from "..";

const zBlastCostShortcut = zBaseToggleShortcut("blastCost");

class BlastCostShortcut extends ToggleShortcut {
    static get schema() {
        return zBlastCostShortcut;
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
