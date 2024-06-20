import {
    MODULE,
    R,
    addListener,
    addListenerAll,
    consumeItem,
    createHTMLElement,
    createHook,
    elementDataset,
    getFlag,
    localize,
    resolveMacroActor,
    setFlag,
    templateLocalize,
    unsetFlag,
    warn,
} from "foundry-pf2e";
import { hud } from "../main";
import {
    BaseActorContext,
    BaseActorRenderOptions,
    BaseActorSettings,
    PF2eHudBaseActor,
} from "./base/actor";
import {
    AdvancedHudAnchor,
    AdvancedHudEvent,
    CLOSE_SETTINGS,
    CloseSetting,
    addSidebarsListeners,
    makeAdvancedHUD,
} from "./base/advanced";
import {
    StatsAdvanced,
    StatsHeaderExtras,
    getAdvancedStats,
    getStatsHeaderExtras,
} from "./shared/advanced";
import { StatsHeader, getStatsHeader } from "./shared/base";
import { addStatsAdvancedListeners, addStatsHeaderListeners } from "./shared/listeners";
import { SidebarMenu, SidebarSettings, getSidebars } from "./sidebar/base";

const ROMAN_RANKS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

class PF2eHudPersistent extends makeAdvancedHUD(
    PF2eHudBaseActor<PersistentSettings, PersistentHudActor>
) {
    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));
    #renderHotbarHook = createHook("renderHotbar", this.#onRenderHotbar.bind(this));
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteActor.bind(this));
    #deleteActorHook = createHook("deleteActor", this.#onDeleteActor.bind(this));
    #updateUserHook = createHook("updateUser", this.#onUpdateUser.bind(this));

    #isUserCharacter: boolean = false;
    #actor: PersistentHudActor | null = null;

    #elements: Record<PartName | "left", HTMLElement | null> = {
        left: null,
        menu: null,
        portrait: null,
        main: null,
    };

    #parts: Parts = {
        main: {
            tooltipDirection: "UP",
            prepareContext: this.#prepareMainContext.bind(this),
            activateListeners: this.#activateMainListeners.bind(this),
        },
        menu: {
            classes: ["app"],
            tooltipDirection: "RIGHT",
            prepareContext: this.#prepareMenuContext.bind(this),
            activateListeners: this.#activateMenuListeners.bind(this),
        },
        portrait: {
            classes: ["app"],
            tooltipDirection: "UP",
            prepareContext: this.#preparePortraitContext.bind(this),
            activateListeners: this.#activatePortraitListeners.bind(this),
        },
    };

    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        window: {
            positioned: false,
        },
    };

    get SETTINGS_ORDER(): (keyof PersistentSettings)[] {
        return [
            "enabled",
            "fontSize",
            "sidebarFontSize",
            "sidebarHeight",
            "multiColumns",
            "noflash",
            "closeOnSendToChat",
            "closeOnSpell",
        ];
    }

    get SETTINGS(): SettingOptions[] {
        return super.SETTINGS.concat([
            {
                key: "noflash",
                type: Boolean,
                default: false,
                scope: "client",
            },
            {
                key: "cleanPortrait",
                type: Boolean,
                default: false,
                scope: "client",
                config: false,
                onChange: (value) => {
                    this.render({ parts: ["menu"] });
                    this.portraitElement?.classList.toggle("cleaned", value);
                },
            },
            ...CLOSE_SETTINGS.map(
                (key): SettingOptions => ({
                    key,
                    type: Boolean,
                    default: false,
                    scope: "client",
                })
            ),
        ]);
    }

    get keybinds(): KeybindingActionConfig[] {
        return [
            {
                name: "setActor",
                onUp: () => this.#setSelectedToken(),
            },
        ];
    }

    get templates(): PartName[] {
        return ["portrait", "main", "menu"];
    }

    get key(): "persistent" {
        return "persistent";
    }

    get allowedActorTypes(): (ActorType | "creature")[] {
        return ["character", "npc"];
    }

    get actor(): PersistentHudActor | null {
        return this.#actor ?? null;
    }

    get mainElement() {
        return this.#elements.main;
    }

    get leftElement() {
        return this.#elements.left;
    }

    get portraitElement() {
        return this.#elements.portrait;
    }

    get menuElement() {
        return this.#elements.menu;
    }

    get sidebars() {
        return this.mainElement?.querySelector<HTMLElement>(".sidebars") ?? null;
    }

    get anchor(): AdvancedHudAnchor {
        const sidebars = this.mainElement?.querySelector(".sidebars");
        if (!sidebars) return { x: 100, y: 100 };

        const { left, top, width } = sidebars.getBoundingClientRect();

        return {
            x: left + width / 2,
            y: top,
            limits: {
                bottom: top,
            },
        };
    }

    get selected() {
        return getFlag<string>(game.user, "persistent.selected") ?? "";
    }

    _onEnable(enabled: boolean = this.enabled) {
        this.#renderActorSheetHook.toggle(enabled);
        this.#renderHotbarHook.toggle(enabled);
        this.#deleteTokenHook.toggle(enabled);
        this.#deleteActorHook.toggle(enabled);
        this.#updateUserHook.toggle(enabled);

        if (enabled) {
            const selected = this.selected;

            let actor = fromUuidSync<ActorPF2e>(selected);

            if (!this.isValidActor(actor)) {
                actor = game.user.character;
            }

            if (actor) this.setActor(actor, { skipSave: true });
            else this.render(true);
        } else {
            this.close({ forced: true });
        }
    }

    _configureRenderOptions(options: PersistentRenderOptions) {
        super._configureRenderOptions(options);

        options.hasSavedActor = !!this.selected;
        options.cleaned = this.getSetting("cleanPortrait");

        const allowedParts = this.templates;
        if (!options.parts) options.parts = allowedParts;
        else options.parts?.filter((part) => allowedParts.includes(part));
    }

    async _prepareContext(
        options: PersistentRenderOptions
    ): Promise<PersistentContext | BaseActorContext<PersistentHudActor>> {
        const parentData = await super._prepareContext(options);
        if (!parentData.hasActor) return parentData;

        const actor = parentData.actor;
        return {
            ...parentData,
            sidebars: getSidebars(actor),
            isNPC: actor.isOfType("npc"),
            isCharacter: actor.isOfType("character"),
        };
    }

    async _renderHTML(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<PersistentTemplates> {
        return Promise.all(
            options.parts.map(async (partName) => {
                const part = this.#parts[partName];
                const tooltipDirection = part.tooltipDirection ?? "DOWN";
                const partContext = part.prepareContext(context, options);
                const template = await this.renderTemplate(partName, {
                    i18n: templateLocalize(`persistent.${partName}`),
                    ...partContext,
                });

                const classes = part.classes?.slice() ?? [];
                if (partName !== "main" && options.cleaned) {
                    classes.push("cleaned");
                }

                const element = createHTMLElement("div", {
                    id: `pf2e-hud-persistent-${partName}`,
                    dataset: { tooltipDirection },
                    innerHTML: template,
                    classes,
                });

                return { name: partName, element };
            })
        );
    }

    _replaceHTML(
        templates: PersistentTemplates,
        content: HTMLElement,
        options: PersistentRenderOptions
    ) {
        if (!this.#elements.left) {
            this.#elements.left = createHTMLElement("div", {
                id: "pf2e-hud-persistent-left",
            });
            document.getElementById("ui-left")?.append(this.#elements.left);
        }

        for (let { name, element } of templates) {
            const oldElement = this.#elements[name];
            const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

            if (oldElement) {
                oldElement.replaceWith(element);
            } else if (name === "main") {
                document.getElementById("ui-bottom")?.prepend(element);
            } else if (name === "menu") {
                this.#elements.left.prepend(element);
            } else {
                this.#elements.left.append(element);
            }

            if (focusName) {
                element.querySelector<HTMLInputElement>(`input[name="${focusName}"]`)?.focus();
            }

            this.#elements[name] = element;
            this.#parts[name].activateListeners(element);
        }
    }

    _actorCleanup() {
        this.#actor = null;
        this.#isUserCharacter = false;
        super._actorCleanup();
    }

    _onClose(options: ApplicationClosingOptions) {
        for (const key in this.#elements) {
            this.#elements[key as PartName | "left"]?.remove();
            this.#elements[key as PartName | "left"] = null;
        }
        super._onClose(options);
    }

    async close(options?: ApplicationClosingOptions & { forced?: boolean }): Promise<this> {
        if (!options?.forced) return this;
        return super.close(options);
    }

    closeIf(event: AdvancedHudEvent) {
        const settingKey = this.eventToSetting(event);
        const setting = this.getSetting(settingKey);

        if (setting) {
            this.closeSidebar();
            return true;
        }

        return false;
    }

    setActor(
        actor: ActorPF2e | null,
        { token, skipSave }: { token?: Token; skipSave?: boolean } = {}
    ) {
        if (actor && (this.isCurrentActor(actor) || !this.isValidActor(actor))) return;

        const savedActor = actor;
        this._actorCleanup();

        if (!actor) {
            const userActor = game.user.character;
            if (this.isValidActor(userActor)) actor = userActor;
        }

        if (actor) {
            actor.apps[this.id] = this;

            const tokens = token ? [token] : actor.getActiveTokens();

            for (const token of tokens) {
                if (hud.token.token === token) hud.token.close();
                if (hud.tooltip.token === token) hud.tooltip.close();
            }
        }

        this.#isUserCharacter = actor === game.user.character;
        this.#actor = actor as PersistentHudActor;

        if (!skipSave) setFlag(game.user, "persistent.selected", savedActor?.uuid ?? "");
        this.render(!!actor);
    }

    isCurrentActor(actor: Maybe<ActorPF2e>, flash = false): actor is PersistentHudActor {
        const isCurrentActor = super.isCurrentActor(actor);
        if (isCurrentActor && flash) this.flash();
        return isCurrentActor;
    }

    isValidActor(actor: Maybe<ActorPF2e>): actor is ActorPF2e {
        return super.isValidActor(actor) && actor.isOwner;
    }

    flash() {
        if (this.getSetting("noflash")) return;

        const off = { boxShadow: "0 0 0px transparent" };
        const on = {
            boxShadow:
                "0 0 var(--flash-outset-blur) 0px var(--flash-outset-color), inset 0 0 var(--flash-inset-blur) 0px var(--flash-inset-color)",
        };

        this.portraitElement?.querySelector(".flash")?.animate([off, on, on, on, off], {
            duration: 200,
            iterations: 2,
        });
    }

    getShortcut(
        groupIndex: Maybe<number | string>,
        index: Maybe<number | string>
    ): Shortcut | EmptyShortcut {
        index = String(index);
        groupIndex = String(groupIndex);

        const actor = this.actor as ActorPF2e;
        if (!actor || !groupIndex || isNaN(Number(groupIndex)) || !index || isNaN(Number(index))) {
            MODULE.throwError("an error occured while trying to access the shortcut");
        }

        const shortcut = getFlag<ShortcutFlag>(
            actor,
            "persistent.shortcuts",
            game.user.id,
            groupIndex,
            index
        );

        const emptyData: EmptyShortcut = {
            index,
            groupIndex,
            isEmpty: true,
        };

        if (!shortcut) return emptyData;

        switch (shortcut.type) {
            case "consumable": {
                const isGeneric = "slug" in shortcut;
                const item = isGeneric
                    ? actor.itemTypes.consumable.find((item) => itemSlug(item) === shortcut.slug)
                    : actor.items.get<ConsumablePF2e<ActorPF2e>>(shortcut.id);

                if (item && !item.isOfType("consumable")) {
                    MODULE.throwError("an error occured while trying to access the shortcut");
                }

                if (!isGeneric && !item) return emptyData;

                const quantity = item?.quantity ?? 0;
                const uses =
                    item?.uses.max && (item.uses.max > 1 || item.category === "wand")
                        ? item.uses.value
                        : undefined;
                const isOutOfStock = quantity === 0 || uses === 0;
                const categoryIcon =
                    item?.category === "scroll"
                        ? "fa-solid fa-scroll"
                        : item?.category === "wand"
                        ? "fa-solid fa-wand-magic-sparkles"
                        : undefined;

                const img =
                    item?.system.spell?.img ?? item?.img ?? (shortcut as { img: string }).img;

                let name = item?.name ?? (shortcut as { name: string }).name;
                if (uses !== undefined && quantity > 1) name += ` x ${quantity}`;

                return {
                    ...shortcut,
                    uses,
                    isDisabled: item?.isAmmo || isOutOfStock,
                    rank: consumableRank(item, true),
                    categoryIcon,
                    isOutOfStock,
                    isGeneric,
                    quantity: uses ?? quantity,
                    item,
                    name,
                    img,
                } satisfies ConsumableShortcut;
            }
        }

        return emptyData;
    }

    getShortcutFromElement(el: HTMLElement) {
        const { groupIndex, index } = el.dataset;
        return this.getShortcut(groupIndex, index);
    }

    #onUpdateUser(user: UserPF2e, updates: Partial<UserSourcePF2e>) {
        if (
            user === game.user &&
            "character" in updates &&
            (!this.actor || this.#isUserCharacter)
        ) {
            this.setActor(user.character);
        }
    }

    #onDeleteActor(doc: ActorPF2e | TokenDocumentPF2e) {
        const actor = doc instanceof Actor ? doc : doc.actor;
        if (this.isCurrentActor(actor)) {
            this.setActor(null);
        }
    }

    #onRenderActorSheet(sheet: ActorSheetPF2e, $html: JQuery) {
        const actor = sheet.actor;
        if (!this.isValidActor(actor)) return;

        const html = $html[0];
        const titleElement = html
            .closest(".window-app")
            ?.querySelector(".window-header .window-title");
        if (!titleElement) return;

        const existing = titleElement.querySelector(".document-id-link.persistent");
        const btnElement = createHTMLElement("a", {
            classes: ["document-id-link", "persistent"],
            dataset: {
                tooltip: localize("persistent.portrait.selectActor"),
                tooltipDirection: "UP",
            },
            innerHTML: "<i class='fa-solid fa-user-vneck'></i>",
        });

        btnElement.addEventListener("click", () => this.setActor(actor));

        if (existing) existing.replaceWith(btnElement);
        else titleElement.append(btnElement);
    }

    #onRenderHotbar() {
        this.render({ parts: ["menu"] });
    }

    #setSelectedToken() {
        const tokens = canvas.tokens.controlled;
        const token = tokens[0];
        if (tokens.length !== 1 || !this.isValidActor(token.actor)) {
            return warn("persistent.error.selectOne");
        }
        this.setActor(token.actor, { token });
    }

    #prepareMenuContext(context: PersistentContext, options: PersistentRenderOptions): MenuContext {
        const setTooltipParts = [["setActor", "leftClick"]];
        if (options.hasSavedActor) setTooltipParts.push(["unsetActor", "rightClick"]);

        const setActorTooltip = setTooltipParts
            .map(([key, click]) => {
                let msg = localize("persistent.menu", key);
                if (options.hasSavedActor) msg = `${localize(click)} ${msg}`;
                return `<div>${msg}</div>`;
            })
            .join("");

        return {
            ...context,
            setActorTooltip,
            hotbarLocked: ui.hotbar.locked,
        };
    }

    #activateMenuListeners(html: HTMLElement) {
        const actor = this.actor;

        addListener(html, "[data-action='select-actor']", "contextmenu", () => {
            this.setActor(null);
        });

        addListenerAll(html, "[data-action]", (event, el) => {
            const action = el.dataset.action as MenuActionEvent;

            switch (action) {
                case "toggle-users": {
                    this.leftElement?.classList.toggle("show-users");
                    break;
                }
                case "open-macros": {
                    ui.macros.renderPopout(true);
                    break;
                }
                case "toggle-hotbar-lock": {
                    ui.hotbar._toggleHotbarLock();
                    break;
                }
                case "open-sheet": {
                    actor?.sheet.render(true);
                    break;
                }
                case "select-actor": {
                    this.#setSelectedToken();
                    break;
                }
                case "toggle-clean": {
                    this.setSetting("cleanPortrait", !this.getSetting("cleanPortrait"));
                    break;
                }
            }
        });
    }

    #preparePortraitContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): PortraitContext | PersistentContext {
        const actor = this.actor;
        if (!actor) return context;

        const data: PortraitContext = {
            ...context,
            ...getStatsHeader(actor),
            ...getStatsHeaderExtras(actor),
            avatar: actor.img,
            name: actor.name,
        };

        return data;
    }

    #activatePortraitListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addStatsHeaderListeners(this.actor, html);
    }

    #prepareMainContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): MainContext | PersistentContext {
        const actor = this.actor;
        if (!actor) return context;

        const shortcutGroups: ShortcutGroup[] = (() =>
            R.pipe(
                R.range(0, 4),
                R.map((groupIndex): ShortcutGroup => {
                    let shortcuts = R.pipe(
                        R.range(0, 4),
                        R.map((index) => this.getShortcut(groupIndex, index))
                    );

                    const split = (() => {
                        const firstShortcut = shortcuts.find(
                            (shortcut): shortcut is Shortcut => "type" in shortcut
                        );
                        if (firstShortcut && firstShortcut.type !== "attack") return true;

                        shortcuts = [firstShortcut ?? shortcuts[0]];

                        return false;
                    })();

                    return {
                        split,
                        shortcuts,
                    };
                })
            ))();

        const data: MainContext = {
            ...context,
            ...getAdvancedStats(actor),
            shortcutGroups,
        };

        return data;
    }

    #activateMainListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addStatsAdvancedListeners(this.actor, html);
        addSidebarsListeners(this, html);

        addListenerAll(
            html,
            ".stretch .shortcuts .shortcut",
            "drop",
            this.#onShortcutDrop.bind(this)
        );

        addListenerAll(html, ".stretch .shortcuts .shortcut", "contextmenu", (event, el) => {
            const { groupIndex, index } = elementDataset(el);
            unsetFlag(actor, "persistent.shortcuts", game.user.id, groupIndex, index);
        });

        addListenerAll(
            html,
            ".stretch .shortcuts .shortcut:not(.empty):not(.disabled)",
            (event, el) => {
                const shortcut = this.getShortcutFromElement(el);
                if (shortcut.isEmpty) return;

                switch (shortcut.type) {
                    case "consumable": {
                        if (shortcut.item) consumeItem(event, shortcut.item);
                        break;
                    }
                }
            }
        );
    }

    async #onShortcutDrop(event: DragEvent, el: HTMLElement) {
        const dropData: HotbarDropData = TextEditor.getDragEventData(event);
        const wrongType = () => warn("persistent.main.shortcut.wrongType");
        const wrongActor = () => warn("persistent.main.shortcut.wrongActor");

        console.log(dropData);

        if (!["Item", "RollOption", "Action"].includes(dropData.type ?? "")) {
            return wrongType();
        }

        if (
            dropData.type === "Item" &&
            dropData.itemType === "melee" &&
            typeof dropData.index === "number"
        ) {
            dropData.type = "Action";
        }

        const actor = this.actor!;
        const shortcut = this.getShortcutFromElement(el);
        const { index, groupIndex } = shortcut;

        let newShortcut: ShortcutFlag;

        switch (dropData.type) {
            case "Item": {
                if (!dropData.uuid || !dropData.itemType) return wrongType();

                const item = await fromUuid<ItemPF2e>(dropData.uuid);

                if (!item?.isOfType("consumable", "spell", "action")) return wrongType();
                if (!this.isCurrentActor(item.actor)) return wrongActor();

                if (item.isOfType("consumable")) {
                    if (event.ctrlKey && item.system.uses.autoDestroy) {
                        newShortcut = {
                            type: "consumable",
                            index,
                            groupIndex,
                            img: item.system.spell?.img ?? item.img,
                            name: item.name,
                            slug: itemSlug(item),
                        } satisfies ConsumableShortcutFlag;
                    } else {
                        newShortcut = {
                            type: "consumable",
                            id: item.id,
                            index,
                            groupIndex,
                        } satisfies ConsumableShortcutFlag;
                    }
                }

                break;
            }

            case "Action": {
                if (typeof dropData.index !== "number" && !dropData.elementTrait)
                    return warn("persistent.main.shortcut.wrongType");

                const itemActor = resolveMacroActor(dropData.actorUUID);
                if (!this.isCurrentActor(itemActor)) return wrongActor();

                break;
            }

            case "RollOption": {
                break;
            }
        }

        setFlag(actor, "persistent.shortcuts", game.user.id, groupIndex, index, newShortcut);
    }
}

function consumableRank(item: Maybe<ConsumablePF2e>, roman: true): RomanRank | undefined;
function consumableRank(item: Maybe<ConsumablePF2e>, roman?: false): OneToTen | undefined;
function consumableRank(
    item: Maybe<ConsumablePF2e>,
    roman?: boolean
): RomanRank | OneToTen | undefined {
    const rank = item?.system.spell
        ? item.system.spell.system.location.heightenedLevel ?? item.system.spell.system.level.value
        : undefined;
    return rank && roman ? ROMAN_RANKS[rank] : rank;
}

function itemSlug(item: ItemPF2e) {
    if (item.isOfType("consumable") && item.system.spell) {
        const spell = item.system.spell;
        const baseSlug = spell.system.slug ?? game.pf2e.system.sluggify(spell.name);
        const rank = consumableRank(item);
        return `${baseSlug}-rank-${rank}`;
    }
    return item.slug ?? game.pf2e.system.sluggify(item.name);
}

type ShortcutType = "action" | "attack" | "consumable" | "spell" | "toggle";

type ShortcutFlagBase<T extends ShortcutType> = {
    type: T;
    index: string;
    groupIndex: string;
};

type AttackShortcutFlag = ShortcutFlagBase<"attack">;

type ConsumableShortcutFlag = ShortcutFlagBase<"consumable"> &
    (
        | {
              slug: string;
              img: string;
              name: string;
          }
        | { id: string }
    );

type ShortcutFlag = ConsumableShortcutFlag | AttackShortcutFlag;

type BaseShortCut = { name: string; isEmpty?: false; img: string; isDisabled: boolean };

type ConsumableShortcut = BaseShortCut &
    ConsumableShortcutFlag & {
        item: ConsumablePF2e<ActorPF2e> | undefined;
        quantity: number;
        uses: number | undefined;
        isGeneric: boolean;
        rank: RomanRank | undefined;
        categoryIcon: string | undefined;
        isOutOfStock: boolean;
    };

type AttackShortcut = BaseShortCut & AttackShortcutFlag;

type Shortcut = ConsumableShortcut | AttackShortcut;

type EmptyShortcut = { index: string; groupIndex: string; isEmpty: true };

type ShortcutGroup = {
    split: boolean;
    shortcuts: (Shortcut | { index: string; groupIndex: string })[];
};

type RomanRank = (typeof ROMAN_RANKS)[number];

type MenuActionEvent =
    | "toggle-users"
    | "open-macros"
    | "toggle-hotbar-lock"
    | "open-sheet"
    | "select-actor"
    | "toggle-clean";

type MenuContext = PersistentContext & {
    hotbarLocked: boolean;
    setActorTooltip: string;
};

type PortraitContext = PersistentContext &
    StatsHeader &
    StatsHeaderExtras & {
        avatar: string;
        name: string;
    };

type MainContext = PersistentContext &
    StatsAdvanced & {
        shortcutGroups: ShortcutGroup[];
    };

type PersistentTemplates = { name: PartName; element: HTMLElement }[];

type PartName = "menu" | "main" | "portrait";

type PersistentHudActor = CharacterPF2e | NPCPF2e;

type PersistentRenderOptions = Omit<BaseActorRenderOptions, "parts"> & {
    parts: PartName[];
    hasSavedActor: boolean;
    cleaned: boolean;
};

type Part<TContext extends PersistentContext> = {
    tooltipDirection?: "UP" | "DOWN" | "LEFT" | "RIGHT";
    classes?: string[];
    prepareContext: (
        context: PersistentContext,
        options: PersistentRenderOptions
    ) => TContext | PersistentContext;
    activateListeners: (html: HTMLElement) => void;
};

type Parts = {
    menu: Part<MenuContext>;
    portrait: Part<PortraitContext>;
    main: Part<MainContext>;
};

type PersistentContext = Omit<BaseActorContext<PersistentHudActor>, "actor" | "hasActor"> & {
    hasActor: true;
    actor: PersistentHudActor;
    sidebars: SidebarMenu[];
    isCharacter: boolean;
    isNPC: boolean;
};

type PersistentSettings = BaseActorSettings &
    SidebarSettings &
    Record<CloseSetting, boolean> & {
        cleanPortrait: boolean;
        noflash: boolean;
    };

export { PF2eHudPersistent };
