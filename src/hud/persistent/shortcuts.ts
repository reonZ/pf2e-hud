import { createDraggable, FoundryDragData, ShortcutPopup, SidebarDragData } from "hud";
import {
    ApplicationRenderContext,
    ApplicationRenderOptions,
    dataToDatasetString,
    getDragEventData,
    getFlag,
    MODULE,
    OneToTen,
    R,
    render,
    updateFlag,
    warning,
} from "module-helpers";
import {
    BaseShortcutSchema,
    BlastCostShortcut,
    ConsumableShortcut,
    ConsumableShortcutData,
    EquipmentShortcut,
    EquipmentShortcutData,
    ExtraActionShortcut,
    ExtraActionShortcutData,
    PersistentPartPF2eHUD,
    PersistentShortcut,
    ShortcutDataset,
    SkillActionShortcut,
    SkillActionShortcutData,
    SpellEntryData,
    SpellShortcut,
    SpellShortcutData,
    ToggleShortcut,
    ToggleShortcutData,
} from ".";

const SHORTCUTS = {
    blastCost: BlastCostShortcut,
    consumable: ConsumableShortcut,
    equipment: EquipmentShortcut,
    extraAction: ExtraActionShortcut,
    skillAction: SkillActionShortcut,
    spell: SpellShortcut,
    toggle: ToggleShortcut,
} satisfies Record<string, ConstructorOf<PersistentShortcut>>;

class PersistentShortcutsPF2eHUD extends PersistentPartPF2eHUD {
    #tab: `${number}` = "1";
    #shortcuts: Map<number, PersistentShortcut> = new Map();
    #shortcutsCache: ShortcutCache = createShortcutCache();

    get nbSlots(): number {
        return 18;
    }

    get name(): "shortcuts" {
        return "shortcuts";
    }

    get shortcuts(): Map<number, PersistentShortcut> {
        return this.#shortcuts;
    }

    get shortcutsData(): ShortcutData[] {
        const worldActor = this.worldActor;
        if (!worldActor) return [];
        return getFlag(worldActor, "shortcuts", game.userId, this.#tab) ?? [];
    }

    async replace(slot: number, data: ShortcutData): Promise<boolean> {
        const shortcut = await this.#instantiateShortcut(data, slot);
        if (!shortcut) return false;

        this.shortcuts.set(slot, shortcut);
        this.save();

        return true;
    }

    swap(slot: number, targetSlot: number): boolean {
        if (slot === targetSlot) return false;

        const shortcut = this.shortcuts.get(slot);
        if (!shortcut) return false;

        const targetShortcut = this.shortcuts.get(targetSlot);

        this.shortcuts.set(targetSlot, shortcut);

        if (targetShortcut) {
            this.shortcuts.set(slot, targetShortcut);
        } else {
            this.shortcuts.delete(slot);
        }

        this.save();
        return true;
    }

    remove(slot: number): boolean {
        if (this.shortcuts.delete(slot)) {
            this.save();
            return true;
        }

        return false;
    }

    async save(): Promise<void> {
        const worldActor = this.worldActor;
        if (!worldActor) return;

        const toSave: SourceFromSchema<BaseShortcutSchema>[] = [];

        for (const [slot, shortcut] of this.shortcuts.entries()) {
            if (!shortcut) continue;
            toSave[slot] = shortcut.toObject();
        }

        const updateKey = `shortcuts.${game.userId}.${this.#tab}`;
        // we don't want to re-render the entire persistent HUD
        await updateFlag(worldActor, { [updateKey]: toSave }, { render: false });

        this.render();
    }

    protected async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<PersistentShortcutsContext> {
        this.shortcuts.clear();
        this.#shortcutsCache = createShortcutCache();

        const shortcuts: PersistentShortcutsContext["shortcuts"] = [];
        const shortcutsData = this.shortcutsData;

        await Promise.all(
            R.range(0, this.nbSlots).map(async (slot) => {
                const data = shortcutsData[slot];
                const shortcut = data ? await this.#instantiateShortcut(data, slot) : undefined;

                shortcuts[slot] = shortcut ?? { isEmpty: true };

                if (shortcut) {
                    this.shortcuts.set(slot, shortcut);
                }
            })
        );

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

    _activateListeners(html: HTMLElement): void {
        const actor = this.actor;
        if (!actor) return;

        const shortcuts = html.querySelectorAll<HTMLElement>(".shortcut");

        const isLocked = (event: Event): boolean => {
            if (!ui.hotbar.locked) return false;

            event.preventDefault();
            event.stopPropagation();

            warning("shortcuts.error.locked");
            return true;
        };

        for (const target of shortcuts) {
            const slot = Number(target.dataset.slot);
            if (isNaN(slot) || slot < 0 || slot > this.nbSlots) return;

            target.addEventListener("drop", async (event) => {
                if (isLocked(event)) return;

                const dragData = getDragEventData<SidebarDragData | ShortcutDragData>(event);

                if (!R.isPlainObject(dragData)) {
                    return warning("shortcuts.error.wrongType");
                }

                if (!this.parent.actor || this.parent.actor.uuid !== dragData.actorUUID) {
                    return warning("shortcuts.error.wrongActor");
                }

                if ("fromSidebar" in dragData && R.isPlainObject(dragData.fromSidebar)) {
                    const replaced = await this.replace(slot, dragData.fromSidebar);

                    if (!replaced) {
                        warning("shortcuts.error.wrongType");
                    }

                    return;
                }

                if ("fromShortcut" in dragData && R.isPlainObject(dragData.fromShortcut)) {
                    this.swap(dragData.fromShortcut.slot, slot);
                    return;
                }

                warning("shortcuts.error.wrongType");
            });

            const shortcut = this.shortcuts.get(slot);
            if (!shortcut) continue;

            target.addEventListener("click", (event) => {
                if (shortcut.canUse) {
                    game.tooltip.deactivate();
                    shortcut.use(event);
                }
            });

            target.addEventListener("auxclick", (event) => {
                if (event.button === 2) {
                    game.tooltip.deactivate();

                    if (event.ctrlKey || !shortcut.canAltUse) {
                        if (this.actor && shortcut.item) {
                            new ShortcutPopup(
                                this.actor,
                                shortcut,
                                this.save.bind(this),
                                event
                            ).render(true);
                        }
                    } else {
                        shortcut.item && shortcut.altUse(event);
                    }
                } else {
                    game.tooltip.dismissLockedTooltips();
                    if (isLocked(event)) return;
                    this.remove(slot);
                }
            });

            target.addEventListener("pointerenter", async (event) => {
                game.tooltip.activate(this.element, {
                    cssClass: "pf2e-hud-shortcut-tooltip",
                    direction: "UP",
                    html: await shortcut.tooltip(),
                });
            });

            target.addEventListener("pointerleave", async (event) => {
                game.tooltip.deactivate();
            });

            target.addEventListener("dragstart", (event) => {
                if (isLocked(event)) return;

                game.tooltip.deactivate();

                createDraggable<ShortcutDragData>(event, shortcut.usedImage, actor, shortcut.item, {
                    fromShortcut: {
                        slot: shortcut.slot,
                    },
                });
            });
        }
    }

    async #instantiateShortcut(
        data: ShortcutData,
        slot: number
    ): Promise<PersistentShortcut | undefined> {
        const actor = this.actor;
        const ShortcutCls = SHORTCUTS[data.type as keyof typeof SHORTCUTS];
        if (!actor || !ShortcutCls) return;

        try {
            const cached = this.#shortcutsCache;
            const item = await ShortcutCls.getItem(actor, data as any, cached);
            const shortcut = new ShortcutCls(actor, data as any, item, slot, cached);
            if (shortcut.invalid) return;

            await shortcut._initShortcut();
            return shortcut;
        } catch (error) {
            MODULE.error(`An error occured while instantiating a shortcut in slot ${slot}`, error);
        }
    }
}

function createShortcutCache(): ShortcutCache {
    const cached: ShortcutCacheData = {};

    function getShortcutCache(
        ...args: Readonly<[...path: string[], defaultValue: () => Promise<unknown>]>
    ): Promise<unknown> | unknown {
        const defaultValue = args.at(-1) as () => unknown;
        const key = args.slice(0, -1).join(".");
        const currentValue = foundry.utils.getProperty(cached, key);

        if (currentValue !== undefined) {
            return currentValue;
        }

        const valueResult = defaultValue() as unknown | Promise<unknown>;

        if (R.isPromise(valueResult)) {
            return new Promise(async (resolve) => {
                const newValue = await valueResult;
                foundry.utils.setProperty(cached, key, newValue);
                resolve(newValue);
            });
        } else {
            foundry.utils.setProperty(cached, key, valueResult);
            return valueResult;
        }
    }

    Object.defineProperty(getShortcutCache, "values", {
        get() {
            return cached;
        },
        enumerable: false,
        configurable: false,
    });

    return getShortcutCache as unknown as ShortcutCache;
}

type ShortcutCache = { get values(): ShortcutCacheData } & {
    <
        A extends keyof Pathable<ShortcutCacheData>,
        R extends PathValue1<ShortcutCacheData, A> | Promise<PathValue1<ShortcutCacheData, A>>
    >(
        path: A,
        defaultValue: () => R
    ): R;
    <
        A extends keyof Pathable<ShortcutCacheData>,
        B extends keyof Pathable1<ShortcutCacheData, A>,
        R extends
            | Promisable<PathValue2<ShortcutCacheData, A, B>>
            | PathValue2<ShortcutCacheData, A, B>
    >(
        args_0: A,
        args_1: B,
        defaultValue: () => R
    ): R;
};

R.pathOr;

type ShortcutCacheData = {
    canCastStaffRank?: Partial<Record<OneToTen, boolean>>;
    animistData?: dailies.AnimistVesselsData | null;
    spellcasting?: Record<string, SpellEntryData | null>;
};

type ShortcutData =
    | ConsumableShortcutData
    | EquipmentShortcutData
    | ExtraActionShortcutData
    | SkillActionShortcutData
    | SpellShortcutData
    | ToggleShortcutData;

type PersistentShortcutsContext = {
    dataset: (data: ShortcutDataset | undefined) => string;
    shortcuts: (PersistentShortcut | { isEmpty: true })[];
};

type ShortcutDragData = FoundryDragData & {
    fromShortcut: {
        slot: number;
    };
};

type ShortcutSlotId = `pf2e-hud-shortcut-${number}`;

type Pathable<T> = {
    [K in AllKeys<T>]: TypesForKey<T, K>;
};
type AllKeys<T> = T extends infer I ? keyof I : never;
type TypesForKey<T, K extends PropertyKey> = T extends infer I
    ? K extends keyof I
        ? I[K]
        : never
    : never;

type PathValue1<T, A extends keyof Pathable<T>> = StrictlyRequired<Pathable<T>>[A];
type Pathable1<T, A extends keyof Pathable<T>> = Pathable<PathValue1<T, A>>;
type PathValue2<T, A extends keyof Pathable<T>, B extends keyof Pathable1<T, A>> = StrictlyRequired<
    Pathable1<T, A>
>[B];

type StrictlyRequired<T> = {
    [K in keyof T]-?: Exclude<T[K], undefined>;
};

export { createShortcutCache, PersistentShortcutsPF2eHUD };
export type { ShortcutCache, ShortcutData, ShortcutSlotId };
