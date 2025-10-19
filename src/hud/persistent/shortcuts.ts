import {
    createDraggable,
    CustomSpellcastingEntry,
    FoundryDragData,
    getNpcStrikeImage,
    ShortcutPopup,
    SidebarDragData,
    SpellCategoryType,
} from "hud";
import {
    ApplicationClosingOptions,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    CombatantPF2e,
    ConsumablePF2e,
    createHook,
    CreaturePF2e,
    dataToDatasetString,
    getDragEventData,
    getFlag,
    htmlQuery,
    isCastConsumable,
    isInstanceOf,
    MacroPF2e,
    MODULE,
    NPCPF2e,
    objectIsIn,
    OneToTen,
    R,
    render,
    SpellCollection,
    warning,
} from "module-helpers";
import {
    ActionShortcut,
    ActionShortcutData,
    BlastCostShortcut,
    BlastShortcut,
    BlastShortcutData,
    ConsumableShortcut,
    ConsumableShortcutData,
    EquipmentShortcut,
    EquipmentShortcutData,
    ExtraActionShortcut,
    ExtraActionShortcutData,
    getItemSlug,
    MacroShortcut,
    MacroShortcutData,
    PersistentPartPF2eHUD,
    PersistentShortcut,
    ShortcutDataset,
    SkillActionShortcut,
    SkillActionShortcutData,
    SpellEntryData,
    SpellShortcut,
    SpellShortcutData,
    StanceShortcut,
    StanceShortcutData,
    StrikeShortcut,
    StrikeShortcutData,
    ToggleShortcut,
    ToggleShortcutData,
} from ".";

const SHORTCUTS = {
    action: ActionShortcut,
    blast: BlastShortcut,
    blastCost: BlastCostShortcut,
    consumable: ConsumableShortcut,
    equipment: EquipmentShortcut,
    extraAction: ExtraActionShortcut,
    macro: MacroShortcut,
    skillAction: SkillActionShortcut,
    spell: SpellShortcut,
    stance: StanceShortcut,
    strike: StrikeShortcut,
    toggle: ToggleShortcut,
} satisfies Record<string, ConstructorOf<PersistentShortcut>>;

class Shortcuts extends Map<number, PersistentShortcut> {
    some(condition: (value: PersistentShortcut, index: number, collection: this) => boolean) {
        let i = 0;
        for (const v of this.values()) {
            const pass = condition(v, i, this);
            i++;
            if (pass) return true;
        }
        return false;
    }
}

class PersistentShortcutsPF2eHUD extends PersistentPartPF2eHUD {
    #shortcuts: Shortcuts = new Shortcuts();
    #shortcutsCache: ShortcutCache = createShortcutCache();

    #combatantHooks = createHook(
        ["createCombatant", "deleteCombatant"],
        this.#onCombatantUpdate.bind(this)
    );

    get nbSlots(): number {
        return 18;
    }

    get tab(): number {
        return this.parent.shortcutsTab.value;
    }

    get name(): "shortcuts" {
        return "shortcuts";
    }

    get shortcuts(): Shortcuts {
        return this.#shortcuts;
    }

    get shortcutsData(): ShortcutData[] {
        const worldActor = this.worldActor;
        if (!worldActor) return [];

        return (
            getFlag<ShortcutData[]>(worldActor, "shortcuts", game.userId, String(this.tab)) ?? []
        );
    }

    get shortcutBinElement(): HTMLElement | null {
        return htmlQuery(this.parent.element, `[data-panel="shortcut-bin"]`);
    }

    async replace(slot: number, data: ShortcutData): Promise<boolean> {
        const shortcut = await this.#instantiateShortcut(data, slot);
        if (!shortcut) return false;

        this.shortcuts.set(slot, shortcut);
        this.save();

        return true;
    }

    getSlotElement(slot: number): HTMLElement | null {
        return htmlQuery(this.element, `.shortcut[data-slot="${slot}"]`);
    }

    setSlotElement(slot: number, content = "") {
        const slotElement = this.getSlotElement(slot);

        if (slotElement) {
            slotElement.innerHTML = content;
        }
    }

    swap(slot: number, targetSlot: number): boolean {
        if (slot === targetSlot) return false;

        const shortcut = this.shortcuts.get(slot);
        if (!shortcut) return false;

        const targetShortcut = this.shortcuts.get(targetSlot);
        const targetSlotContent = this.getSlotElement(targetSlot)?.innerHTML;

        this.setSlotElement(targetSlot, this.getSlotElement(slot)?.innerHTML);
        this.shortcuts.set(targetSlot, shortcut);

        if (targetShortcut) {
            this.setSlotElement(slot, targetSlotContent);
            this.shortcuts.set(slot, targetShortcut);
        } else {
            this.shortcuts.delete(slot);
        }

        this.save();
        return true;
    }

    remove(slot: number): boolean {
        if (this.shortcuts.delete(slot)) {
            this.setSlotElement(slot, "");
            this.save();
            return true;
        }

        return false;
    }

    async save(): Promise<void> {
        const worldActor = this.worldActor;
        if (!worldActor) return;

        const toSave: ShortcutData[] = [];

        for (const [slot, shortcut] of this.shortcuts.entries()) {
            if (!shortcut) continue;
            toSave[slot] = shortcut.toObject() as any;
        }

        this.parent.updateShortcuts(game.userId, this.tab, toSave);
    }

    async generateFillShortcuts(): Promise<ShortcutData[]> {
        const actor = this.actor;
        if (!actor?.isOfType("npc")) return [];

        let _slot = 0;

        const nbSlots = this.nbSlots;
        const shortcuts: ShortcutData[] = [];

        const addSlot = (data: ShortcutData): boolean => {
            shortcuts[_slot++] = data;
            return _slot < nbSlots;
        };

        for (const strike of actor.system.actions) {
            const strikeData: StrikeShortcutData = {
                img: getNpcStrikeImage(strike),
                itemId: strike.item.id,
                name: strike.item._source.name,
                slug: strike.slug,
                type: "strike",
            };

            if (!addSlot(strikeData)) return shortcuts;
        }

        for (const action of actor.itemTypes.action) {
            if (!action.actionCost) continue;

            const actionData: ActionShortcutData = {
                img: action.img,
                itemId: action.id,
                name: action.name,
                type: "action",
            };

            if (!addSlot(actionData)) return shortcuts;
        }

        for (const item of actor.itemTypes.consumable) {
            if (isCastConsumable(item)) continue;

            const itemData: ConsumableShortcutData = {
                img: item.img,
                itemId: item.id,
                name: item.name,
                slug: getItemSlug(item),
                type: "consumable",
            };

            if (!addSlot(itemData)) return shortcuts;
        }

        for (const collection of actor.spellcasting.collections) {
            const entry = collection.entry;

            if (
                entry.category === "ritual" ||
                (entry.category === "items" && !isInstanceOf(entry, "ItemSpellcasting"))
            )
                continue;

            const entryId = entry.id;

            const entrySheetData = await this.#shortcutsCache("spellcastingEntry", entryId, () => {
                return entry.getSheetData({
                    spells: collection,
                }) as Promise<CustomSpellcastingEntry>;
            });
            if (!entrySheetData.groups.length) continue;

            const item = entry.isEphemeral
                ? actor.items.get<ConsumablePF2e<NPCPF2e>>(entry.id.split("-")[0])
                : undefined;

            const category =
                entry.category === "items" && item
                    ? (item.category as SpellCategoryType)
                    : entry.isFlexible
                    ? "flexible"
                    : (entry.category as SpellCategoryType);

            for (const group of entrySheetData.groups) {
                if (!group.active.length || group.uses?.max === 0) continue;

                for (let slotId = 0; slotId < group.active.length; slotId++) {
                    const active = group.active[slotId];
                    if (!active?.spell || active.uses?.max === 0) continue;

                    const spell = active.spell;

                    const spellData: SpellShortcutData = {
                        category,
                        castRank: (active?.castRank ?? spell.rank) as OneToTen,
                        entryId,
                        groupId: group.id === "cantrips" ? 0 : group.id,
                        img: spell.img,
                        isAnimist: false,
                        itemId: spell.id,
                        name: spell.name,
                        slotId,
                        slug: getItemSlug(spell),
                        type: "spell",
                    };

                    if (!addSlot(spellData)) return shortcuts;
                }
            }
        }

        return shortcuts;
    }

    render(
        options?: boolean | ShortcutsRenderOptions,
        _options?: ShortcutsRenderOptions
    ): Promise<this> {
        const keepCache = R.isPlainObject(options) ? options.keepCache : _options?.keepCache;

        this.shortcuts.clear();

        if (!keepCache) {
            this.#shortcutsCache = createShortcutCache();
        }

        return super.render(options, _options);
    }

    protected _onClose(options: ApplicationClosingOptions): void {
        super._onClose(options);
        this.#combatantHooks.disable();
    }

    protected async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<PersistentShortcutsContext> {
        let shortcutsData = this.shortcutsData;

        if (
            this.tab === 1 &&
            this.actor?.isOfType("npc") &&
            shortcutsData.length === 0 &&
            this.parent.settings.autoFill
        ) {
            shortcutsData = await this.generateFillShortcuts();
        }

        const shortcuts: PersistentShortcutsContext["shortcuts"] = [];

        for (const slot of R.range(0, this.nbSlots)) {
            const data = shortcutsData[slot];
            const shortcut = data ? await this.#instantiateShortcut(data, slot) : undefined;

            if (shortcut) {
                this.shortcuts.set(slot, shortcut);
            }

            shortcuts[slot] = shortcut ?? { isEmpty: true };
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

    _activateListeners(html: HTMLElement): void {
        const actor = this.actor;
        if (!actor) return;

        const hasStanceShortcut = this.shortcuts.some((shortcut) => shortcut.type === "stance");
        this.#combatantHooks.toggle(hasStanceShortcut);

        this.shortcutBinElement?.addEventListener("drop", (event) => {
            const dragData = getDragEventData<ShortcutDragData>(event);
            const slot = dragData?.fromShortcut?.slot;

            if (R.isNumber(slot)) {
                this.remove(slot);
            }
        });

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

                const dragData = getDragEventData<
                    SidebarDragData | ShortcutDragData | MacroSlotData
                >(event);

                if (!R.isPlainObject(dragData)) {
                    return warning("shortcuts.error.wrongData");
                }

                const isMacro = isMacroDragData(dragData);

                if (
                    !isMacro &&
                    (!this.parent.actor || this.parent.actor.uuid !== dragData.actorUUID)
                ) {
                    return warning("shortcuts.error.wrongActor");
                }

                const macroData = isMacro ? getMacroShortcutData(dragData.uuid) : null;
                if (isMacro && !macroData) {
                    return warning("shortcuts.error.notScript");
                }

                if (isMacro || objectIsIn(dragData, "fromSidebar")) {
                    const shortcutData = isMacro
                        ? (macroData as MacroShortcutData)
                        : dragData.fromSidebar;

                    if (!(await this.replace(slot, shortcutData))) {
                        warning("shortcuts.error.wrongType");
                    }

                    return;
                }

                if (objectIsIn(dragData, "fromShortcut")) {
                    this.swap(dragData.fromShortcut.slot, slot);
                    return;
                }

                warning("shortcuts.error.notHUD");
            });

            const shortcut = this.shortcuts.get(slot);
            if (!shortcut) continue;

            target.addEventListener("click", (event) => {
                if (shortcut.canUse) {
                    game.tooltip.deactivate();
                    shortcut.use(event);
                }
            });

            target.addEventListener("contextmenu", (event) => {
                if (event.ctrlKey || !shortcut.canAltUse) {
                    if (this.actor && shortcut.canOpenPopup) {
                        game.tooltip.deactivate();
                        new ShortcutPopup(this.actor, shortcut, this.save.bind(this), event).render(
                            true
                        );
                    }
                } else {
                    game.tooltip.deactivate();
                    shortcut.item && shortcut.altUse(event);
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

                const shortcutBinElement = this.shortcutBinElement;
                if (shortcutBinElement) {
                    shortcutBinElement.classList.add("visible");

                    shortcutBinElement.addEventListener("drop", () => {});

                    window.addEventListener(
                        "dragend",
                        () => {
                            shortcutBinElement.classList.remove("visible");
                        },
                        { once: true }
                    );
                }
            });
        }
    }

    #onCombatantUpdate(combatant: CombatantPF2e) {
        if (this.actor && combatant.actor?.uuid === this.actor?.uuid) {
            this.render();
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

function isMacroDragData(
    data: SidebarDragData | ShortcutDragData | MacroSlotData
): data is MacroSlotData {
    return "type" in data && data.type === "Macro" && "uuid" in data;
}

function getMacroShortcutData(uuid: DocumentUUID): MacroShortcutData | undefined {
    const macro = fromUuidSync<MacroPF2e>(uuid);
    if (!macro) return;

    return {
        img: macro.img ?? "icons/svg/dice-target.svg",
        macroUUID: uuid,
        name: macro.name,
        type: "macro",
    };
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
    animistCollection?: SpellCollection<CreaturePF2e> | null;
    animistVesselsData?: dailies.AnimistVesselsData | null;
    canCastStaffRank?: Partial<Record<OneToTen, boolean>>;
    canUseStances?: boolean | null;
    commanderTactics?: string[] | null;
    explorations?: string[];
    getActionMacro?: toolbelt.Api["actionable"]["getActionMacro"] | null;
    hasItemWithSourceId?: Record<DocumentUUID, boolean>;
    isTacticAbility?: dailies.Api["isTacticAbility"] | null;
    shortcutSpellData?: Record<string, SpellEntryData | null>;
    spellcastingEntry?: Record<string, CustomSpellcastingEntry | null>;
};

type MacroSlotData = {
    slot: `${number}`;
    type: "Macro";
    uuid: `Macro.${string}`;
    [k: string]: any;
};

type ShortcutData =
    | ActionShortcutData
    | BlastShortcutData
    | ConsumableShortcutData
    | EquipmentShortcutData
    | ExtraActionShortcutData
    | MacroShortcutData
    | SkillActionShortcutData
    | SpellShortcutData
    | StanceShortcutData
    | StrikeShortcutData
    | ToggleShortcutData;

type PersistentShortcutsContext = {
    dataset: (data: ShortcutDataset | undefined) => string;
    shortcuts: ShortcutsList;
};

type ShortcutsRenderOptions = DeepPartial<ApplicationRenderOptions> & {
    keepCache?: boolean;
};

type ShortcutsList = (PersistentShortcut | { isEmpty: true })[];

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
export type { ShortcutCache, ShortcutData, ShortcutDragData, ShortcutsList, ShortcutSlotId };
