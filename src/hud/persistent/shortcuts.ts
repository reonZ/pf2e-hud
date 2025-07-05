import { ItemHudPopup, SidebarDragData } from "hud";
import {
    ApplicationRenderContext,
    ApplicationRenderOptions,
    dataToDatasetString,
    getDragEventData,
    getFlag,
    R,
    render,
    updateFlag,
    warning,
} from "module-helpers";
import {
    ConsumableShortcut,
    ConsumableShortcutData,
    EquipmentShortcut,
    EquipmentShortcutData,
    PersistentPartPF2eHUD,
    PersistentShortcut,
    ShortcutDataset,
    ToggleShortcutData,
} from ".";

const SHORTCUTS = {
    consumable: ConsumableShortcut,
    equipment: EquipmentShortcut,
} satisfies Record<string, ConstructorOf<PersistentShortcut>>;

class PersistentShortcutsPF2eHUD extends PersistentPartPF2eHUD {
    #tab: `${number}` = "1";
    #shortcuts: Map<number, PersistentShortcut> = new Map();

    get nbSlots(): number {
        return 18;
    }

    get name(): "shortcuts" {
        return "shortcuts";
    }

    get shortcutsData(): ShortcutData[] {
        if (!this.actor) {
            return [];
        }

        return getFlag(this.actor, "shortcuts", game.userId, this.#tab) ?? [];
    }

    replace(slot: number, data: ShortcutData): boolean {
        const shortcut = this.#instantiateShortcut(data);
        if (!shortcut) return false;

        this.#shortcuts.set(slot, shortcut);
        this.save();

        return true;
    }

    remove(slot: number): boolean {
        if (this.#shortcuts.delete(slot)) {
            this.save();
            return true;
        }

        return false;
    }

    async save(): Promise<void> {
        if (!this.actor) return;

        const toSave: ShortcutData[] = [];

        for (const [slot, shortcut] of this.#shortcuts.entries()) {
            if (!shortcut) continue;
            toSave[slot] = shortcut.toObject() as ShortcutData;
        }

        const updateKey = `shortcuts.${game.userId}.${this.#tab}`;
        // we don't want to re-render the entire persistent HUD
        await updateFlag(this.actor, { [updateKey]: toSave }, { render: false });

        this.render();
    }

    protected async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<PersistentShortcutsContext> {
        this.#shortcuts.clear();

        const shortcuts: PersistentShortcutsContext["shortcuts"] = [];
        const shortcutsData = this.shortcutsData;

        for (let slot = 0; slot < this.nbSlots; slot++) {
            const data = shortcutsData[slot];
            const shortcut = data ? this.#instantiateShortcut(data) : undefined;

            shortcuts[slot] = shortcut ?? { isEmpty: true };

            if (shortcut) {
                this.#shortcuts.set(slot, shortcut);
            }
        }

        return {
            dataset: (data: ShortcutDataset | undefined) => {
                return data ? dataToDatasetString(data) : "";
            },
            shortcuts,
        };
    }

    protected async _renderHTML(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<string> {
        return render("shortcuts/slots", context);
    }

    protected _replaceHTML(
        result: string,
        content: HTMLElement,
        options: ApplicationRenderOptions
    ): void {
        super._replaceHTML(result, content, options);
        content.classList.toggle("character", !!this.actor?.isOfType("character"));
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        const slot = this.#getSlotFromElement(target);
        const shortcut = this.#shortcuts.get(slot);
        if (!shortcut) return;

        game.tooltip.deactivate();

        if (event.button === 0) {
            shortcut.canUse && shortcut.use(event);
        } else if (event.shiftKey) {
            this.remove(slot);
        } else if (event.ctrlKey) {
            if (this.actor && shortcut.item) {
                new ItemHudPopup(this.actor, shortcut.item, event).render(true);
            }
        } else {
            shortcut.canAltUse && shortcut.altUse(event);
        }
    }

    _activateListeners(html: HTMLElement): void {
        const shortcuts = html.querySelectorAll<HTMLElement>(".shortcut");

        for (const target of shortcuts) {
            target.addEventListener("drop", (event) => {
                const dragData = getDragEventData<SidebarDragData>(event);

                if (!R.isPlainObject(dragData) || !R.isPlainObject(dragData.fromSidebar)) {
                    warning("shortcuts.error.wrongType");
                    return;
                }

                if (!this.parent.actor || this.parent.actor.uuid !== dragData.actorUUID) {
                    warning("shortcuts.error.wrongActor");
                    return;
                }

                const slot = this.#getSlotFromElement(target);
                if (slot < 0) return;

                if (!this.replace(slot, dragData.fromSidebar)) {
                    warning("shortcuts.error.wrongType");
                    return;
                }
            });

            target.addEventListener("pointerenter", (event) =>
                this.#generateTooltip(event, target)
            );

            target.addEventListener("pointerleave", async (event) => {
                game.tooltip.deactivate();
            });
        }
    }

    async #generateTooltip(event: PointerEvent, target: HTMLElement) {
        const slot = this.#getSlotFromElement(target);
        const shortcut = this.#shortcuts.get(slot);
        if (!shortcut) return;

        game.tooltip.activate(this.element, {
            cssClass: "pf2e-hud-shortcut-tooltip",
            direction: "UP",
            html: await shortcut.tooltip(),
        });
    }

    #getSlotFromElement(el: HTMLElement): number {
        const slot = Number(el.dataset.slot);
        return isNaN(slot) || slot < 0 || slot > this.nbSlots ? -1 : slot;
    }

    #instantiateShortcut(data: ShortcutData): PersistentShortcut | undefined {
        const actor = this.actor;
        const ShortcutCls = SHORTCUTS[data.type as keyof typeof SHORTCUTS];
        if (!actor || !ShortcutCls) return;

        try {
            const shortcut = new ShortcutCls(actor, data as any);
            return shortcut.invalid ? undefined : shortcut;
        } catch (error) {
            // TODO log error
        }
    }
}

type ShortcutData = ConsumableShortcutData | EquipmentShortcutData | ToggleShortcutData;

type PersistentShortcutsContext = {
    dataset: (data: ShortcutDataset | undefined) => string;
    shortcuts: (PersistentShortcut | { isEmpty: true })[];
};

export { PersistentShortcutsPF2eHUD };
export type { ShortcutData };
