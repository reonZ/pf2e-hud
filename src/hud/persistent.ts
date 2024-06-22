import {
    MODULE,
    R,
    addListener,
    addListenerAll,
    arrayIncludes,
    confirmDialog,
    consumeItem,
    createHTMLElement,
    createHook,
    elementDataset,
    getActionImg,
    getFlag,
    isInstanceOf,
    localize,
    objectHasKey,
    openAttackpopup,
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
import {
    ActionBlast,
    ActionStrike,
    getActionFrequency,
    getBlastData,
    getStrikeData,
    getStrikeVariant,
    useAction,
    variantLabel,
} from "./sidebar/actions";
import { SidebarMenu, SidebarSettings, getSidebars } from "./sidebar/base";

const ROMAN_RANKS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"] as const;

class PF2eHudPersistent extends makeAdvancedHUD(
    PF2eHudBaseActor<PersistentSettings, PersistentHudActor>
) {
    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));
    #renderTokenHudHook = createHook("renderTokenHUD", () => this.closeSidebar());
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
            "confirmShortcut",
            "consumableShortcut",
            "closeOnSendToChat",
            "closeOnSpell",
        ];
    }

    getSettings(): SettingOptions[] {
        return super.getSettings().concat([
            {
                key: "noflash",
                type: Boolean,
                default: false,
                scope: "client",
            },
            {
                key: "confirmShortcut",
                type: Boolean,
                default: true,
                scope: "client",
            },
            {
                key: "consumableShortcut",
                type: String,
                choices: ["use", "confirm", "chat"],
                default: "confirm",
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

    get partials(): string[] {
        return super.partials.concat([
            "action_blast-row",
            "action_strike-row",
            "action_auxiliaries",
        ]);
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
        this.#renderTokenHudHook.toggle(enabled);
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
                const partContext = await part.prepareContext(context, options);
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

    _onRender(context: PersistentContext, options: PersistentRenderOptions) {
        if (options.parts.includes("main")) {
            this.sidebar?.render(true);
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

    async getShortcut<T extends Shortcut>(
        groupIndex: Maybe<number | string>,
        index: Maybe<number | string>
    ): Promise<T | EmptyShortcut> {
        index = String(index);
        groupIndex = String(groupIndex);

        const throwError = () => {
            MODULE.throwError("an error occured while trying to access the shortcut");
        };

        const actor = this.actor as ActorPF2e;
        if (!actor || !groupIndex || isNaN(Number(groupIndex)) || !index || isNaN(Number(index))) {
            return throwError();
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
            case "action": {
                const item = actor.items.get(shortcut.itemId);
                if (item && !item.isOfType("action", "feat")) return throwError();

                const name = item?.name ?? shortcut.name;
                const frequency = item ? getActionFrequency(item) : undefined;
                const disabled = !item || frequency?.value === 0;

                return {
                    ...shortcut,
                    isDisabled: disabled,
                    isFadedOut: disabled,
                    item,
                    img: item ? getActionImg(item) : shortcut.img,
                    name: frequency ? `${name} - ${frequency.label}` : name,
                    frequency,
                } satisfies ActionShortcut as T;
            }

            case "consumable": {
                const isGeneric = "slug" in shortcut;
                const item = isGeneric
                    ? actor.itemTypes.consumable.find((item) => itemSlug(item) === shortcut.slug)
                    : actor.items.get<ConsumablePF2e<ActorPF2e>>(shortcut.itemId);

                if (item && !item.isOfType("consumable")) return throwError();

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
                    isDisabled: item?.isAmmo || isOutOfStock,
                    rank: consumableRank(item, true),
                    quantity: uses ?? quantity,
                    categoryIcon,
                    isFadedOut: isOutOfStock,
                    isGeneric,
                    uses,
                    item,
                    name,
                    img,
                } satisfies ConsumableShortcut as T;
            }

            case "attack": {
                const isBlast = "elementTrait" in shortcut;

                if (isBlast) {
                    if (!actor.isOfType("character")) return throwError();

                    const blast = await getBlastData(actor, shortcut.elementTrait);
                    const disabled = !blast;

                    return {
                        ...shortcut,
                        isDisabled: disabled,
                        isFadedOut: disabled,
                        blast,
                    } satisfies AttackShortcut as T;
                } else {
                    const { itemId, slug } = shortcut;
                    const strike = await getStrikeData(actor, { id: itemId, slug });
                    const disabled = !strike;

                    return {
                        ...shortcut,
                        isDisabled: disabled,
                        isFadedOut: disabled,
                        strike,
                        img: strike?.item.img ?? shortcut.img,
                        name: strike
                            ? `${game.i18n.localize("PF2E.WeaponStrikeLabel")}: ${strike.label}`
                            : shortcut.name,
                    } satisfies AttackShortcut as T;
                }
            }

            case "toggle": {
                const { domain, option } = shortcut;
                const item = actor.items.get(shortcut.itemId);
                const toggle = foundry.utils.getProperty<RollOptionToggle>(
                    actor,
                    `synthetics.toggles.${domain}.${option}`
                );
                const disabled = !item || !toggle?.enabled;
                const checked = !!toggle?.checked;
                const label = game.i18n.localize(
                    `PF2E.SETTINGS.EnabledDisabled.${checked ? "Enabled" : "Disabled"}`
                );

                return {
                    ...shortcut,
                    isDisabled: disabled,
                    isFadedOut: disabled,
                    checked,
                    item,
                    img: item?.img ?? shortcut.img,
                    name: item ? `${item.name} (${label})` : shortcut.name,
                } satisfies ToggleShortcut as T;
            }
        }

        return emptyData;
    }

    getShortcutFromElement<T extends Shortcut>(el: HTMLElement) {
        const { groupIndex, index } = el.dataset;
        return this.getShortcut<T>(groupIndex, index);
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

        this.closeSidebar();

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

    async #prepareMainContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<MainContext | PersistentContext> {
        const actor = this.actor;
        if (!actor) return context;

        const shortcutGroups: ShortcutGroup[] = [];

        for (const groupIndex of R.range(0, 4)) {
            const shortcuts: (Shortcut | EmptyShortcut)[] = [];

            for (const index of R.range(0, 4)) {
                const shortcut = await this.getShortcut(groupIndex, index);
                shortcuts.push(shortcut);
            }

            const firstShortcut = shortcuts.find(
                (shortcut): shortcut is Shortcut => "type" in shortcut
            );
            const split = !!firstShortcut && firstShortcut.type !== "attack";

            shortcutGroups.push({
                split,
                shortcuts: split ? shortcuts : [firstShortcut ?? shortcuts[0]],
            });
        }

        const data: MainContext = {
            ...context,
            ...getAdvancedStats(actor),
            sidebars: getSidebars(actor, this.sidebar?.key),
            shortcutGroups,
            variantLabel,
        };

        return data;
    }

    #activateMainListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addStatsAdvancedListeners(this.actor, html);
        addSidebarsListeners(this, html);

        const shortcutElements = html.querySelectorAll<HTMLElement>(
            ".stretch .shortcuts .shortcut"
        );
        for (const shortcutElement of shortcutElements) {
            const classList = [...shortcutElement.classList];

            shortcutElement.addEventListener("drop", (event) => {
                this.#onShortcutDrop(event, shortcutElement);
            });

            shortcutElement.addEventListener("mouseleave", () => {
                shortcutElement.classList.remove("show-damage");
                shortcutElement.classList.remove("use-variant");
            });

            shortcutElement.addEventListener("contextmenu", () => {
                const { groupIndex, index } = elementDataset(shortcutElement);
                unsetFlag(actor, "persistent.shortcuts", game.user.id, groupIndex, index);
            });

            if (!arrayIncludes(["empty", "disabled", "attack"], classList)) {
                shortcutElement.addEventListener("click", async (event) => {
                    this.#onShortcutClick(event, shortcutElement);
                });
            }

            addListenerAll(shortcutElement, "[data-action]", (event, el) =>
                this.#onShortcutAction(event, shortcutElement, el)
            );

            addListenerAll(shortcutElement, ".variants .category > *", () => {
                shortcutElement.classList.toggle("use-variant");
            });

            const auxilaryElements = shortcutElement.querySelectorAll<HTMLElement>(
                "[data-action='auxiliary-action']"
            );
            for (const auxilaryElement of auxilaryElements) {
                auxilaryElement.dataset.tooltip = auxilaryElement.innerHTML.trim();
            }
        }
    }

    async #onShortcutClick(event: MouseEvent, shortcutElement: HTMLElement) {
        const shortcut = await this.getShortcutFromElement<Exclude<Shortcut, AttackShortcut>>(
            shortcutElement
        );
        if (shortcut.isEmpty || shortcut.isDisabled) return;

        const actor = this.actor!;

        switch (shortcut.type) {
            case "consumable": {
                if (!shortcut.item) return;

                const setting = this.getSetting("consumableShortcut");

                if (setting === "chat") {
                    return shortcut.item.toMessage(event);
                }

                if (setting === "confirm") {
                    const name = shortcut.item.name;
                    const confirm = await confirmDialog({
                        title: localize("persistent.main.shortcut.consumable.confirm.title", {
                            name,
                        }),
                        content: localize("persistent.main.shortcut.consumable.confirm.message", {
                            name,
                        }),
                    });

                    if (!confirm) return;
                }

                return consumeItem(event, shortcut.item);
            }

            case "toggle": {
                const { domain, itemId, option } = shortcut;
                return actor.toggleRollOption(domain, option, itemId ?? null);
            }

            case "action": {
                if (!shortcut.item) return;

                if (this.getSetting("confirmShortcut")) {
                    const name = shortcut.item.name;
                    const confirm = await confirmDialog({
                        title: localize("persistent.main.shortcut.confirm.title", {
                            name,
                        }),
                        content: localize("persistent.main.shortcut.confirm.message", {
                            name,
                        }),
                    });

                    if (!confirm) return;
                }

                return useAction(shortcut.item);
            }
        }
    }

    async #onShortcutAction(event: MouseEvent, shortcutElement: HTMLElement, el: HTMLElement) {
        const actor = this.actor!;
        const action = el.dataset.action as ShortcutActionEvent;

        const getStrike = async <T extends StrikeData>(el: HTMLElement, readyOnly = false) => {
            const shortcut = await this.getShortcutFromElement<StrikeShortcut>(shortcutElement);
            if (shortcut.isEmpty || !shortcut.strike) return null;
            return getStrikeVariant<T>(shortcut.strike, el, readyOnly);
        };

        switch (action) {
            case "toggle-damage": {
                shortcutElement?.classList.toggle("show-damage");
                break;
            }

            case "open-attack-popup": {
                if (actor.isOfType("character")) {
                    openAttackpopup(actor, el.dataset);
                }
                break;
            }

            case "blast-attack": {
                const shortcut = await this.getShortcutFromElement<BlastShortcut>(shortcutElement);
                if (shortcut.isEmpty || !shortcut.blast) return;

                const mapIncreases = Math.clamp(Number(el.dataset.mapIncreases), 0, 2);
                return shortcut.blast.attack(event, mapIncreases, el);
            }

            case "blast-damage": {
                const shortcut = await this.getShortcutFromElement<BlastShortcut>(shortcutElement);
                if (shortcut.isEmpty || !shortcut.blast) return;
                return shortcut.blast.damage(event, el);
            }

            case "strike-attack": {
                const strike = await getStrike(el, true);
                const variantIndex = Number(el.dataset.variantIndex);
                return strike?.variants[variantIndex]?.roll({ event });
            }

            case "strike-damage":
            case "strike-critical": {
                const strike = await getStrike(el);
                const method = el.dataset.action === "strike-damage" ? "damage" : "critical";
                return strike?.[method]?.({ event });
            }

            case "auxiliary-action": {
                const strike = await getStrike<CharacterStrike>(el);
                const auxiliaryActionIndex = Number(el.dataset.auxiliaryActionIndex ?? NaN);
                strike?.auxiliaryActions?.at(auxiliaryActionIndex)?.execute();
                break;
            }
        }
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
        const shortcut = await this.getShortcutFromElement(el);
        let { index, groupIndex } = shortcut;

        let newShortcut: ShortcutFlag | undefined;

        switch (dropData.type) {
            case "RollOption": {
                const { label, domain, option } = dropData as RollOptionData;
                if (
                    typeof label !== "string" ||
                    !label.length ||
                    typeof domain !== "string" ||
                    !domain.length ||
                    typeof option !== "string" ||
                    !option.length
                )
                    return wrongType();

                const item = fromUuidSync(dropData.uuid ?? "");
                if (!(isInstanceOf(item, "ItemPF2e") && item.isEmbedded)) return wrongType();
                if (!this.isCurrentActor(item.actor)) return wrongActor();

                newShortcut = {
                    type: "toggle",
                    index,
                    groupIndex,
                    domain,
                    option,
                    img: item.img,
                    itemId: item.id,
                    name: label,
                } satisfies ToggleShortcutFlag;

                break;
            }

            case "Item": {
                if (!dropData.uuid || !dropData.itemType) return wrongType();

                const item = await fromUuid<ItemPF2e>(dropData.uuid);

                if (!item?.isOfType("consumable", "spell", "action", "feat")) return wrongType();
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
                            itemId: item.id,
                            index,
                            groupIndex,
                        } satisfies ConsumableShortcutFlag;
                    }
                } else if (item.isOfType("action", "feat")) {
                    newShortcut = {
                        type: "action",
                        index,
                        groupIndex,
                        itemId: item.id,
                        name: item.name,
                        img: getActionImg(item),
                    } satisfies ActionShortcutFlag;
                }

                break;
            }

            case "Action": {
                if (typeof dropData.index !== "number" && !dropData.elementTrait)
                    return wrongType();

                const itemActor = resolveMacroActor(dropData.actorUUID);
                if (!this.isCurrentActor(itemActor)) return wrongActor();

                const { elementTrait, index: actionIndex } = dropData;

                index = "0";

                if (
                    actor.isOfType("character") &&
                    objectHasKey(CONFIG.PF2E.elementTraits, elementTrait)
                ) {
                    const blast = new game.pf2e.ElementalBlast(actor);
                    const config = blast.configs.find((c) => c.element === elementTrait);
                    if (!config) return wrongType();

                    newShortcut = {
                        type: "attack",
                        index,
                        groupIndex,
                        elementTrait,
                        img: config.img,
                        name: game.i18n.localize(config.label),
                    } satisfies AttackShortcutFlag;
                } else if (actionIndex !== undefined) {
                    const action = actor.system.actions[actionIndex];
                    if (!action) return wrongType();

                    newShortcut = {
                        type: "attack",
                        index,
                        groupIndex,
                        itemId: action.item.id,
                        slug: action.slug,
                        img: action.item.img,
                        name: `${game.i18n.localize("PF2E.WeaponStrikeLabel")}: ${action.label}`,
                    } satisfies AttackShortcutFlag;
                }

                break;
            }
        }

        if (!newShortcut) return;

        const group =
            foundry.utils.deepClone(
                getFlag<Record<string, any>>(
                    actor,
                    "persistent.shortcuts",
                    game.user.id,
                    groupIndex
                )
            ) ?? {};

        if (newShortcut.type === "attack") {
            const wasSplit =
                (!shortcut.isEmpty && shortcut.type !== "attack") ||
                Object.values(group).some((x) => "type" in x && x.type !== "attack");

            if (wasSplit) {
                for (const key of Object.keys(group)) {
                    if (key === index) continue;
                    delete group[key];
                    group[`-=${key}`] = true;
                }
            }
        }

        if (group[index]) {
            const removedKeys: Record<string, any> = {};

            for (const key in group[index]) {
                if (key in newShortcut) continue;
                removedKeys[`-=${key}`] = true;
            }

            foundry.utils.mergeObject(newShortcut, removedKeys);
        }

        group[index] = newShortcut;

        setFlag(actor, "persistent.shortcuts", game.user.id, groupIndex, group);
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

type ShortcutActionEvent =
    | "toggle-damage"
    | "open-attack-popup"
    | "blast-attack"
    | "blast-damage"
    | "strike-attack"
    | "strike-damage"
    | "strike-critical"
    | "auxiliary-action";

type ShortcutType = "action" | "attack" | "consumable" | "spell" | "toggle";

type ShortcutFlagBase<T extends ShortcutType> = {
    type: T;
    index: string;
    groupIndex: string;
};

type ToggleShortcutFlag = ShortcutFlagBase<"toggle"> & {
    itemId: string;
    domain: string;
    option: string;
    name: string;
    img: string;
};

type AttackShortcutFlag = ShortcutFlagBase<"attack"> & { img: string; name: string } & (
        | {
              elementTrait: ElementTrait;
          }
        | {
              itemId: string;
              slug: string;
          }
    );

type ActionShortcutFlag = ShortcutFlagBase<"action"> & {
    itemId: string;
    name: string;
    img: string;
};

type ConsumableShortcutFlag = ShortcutFlagBase<"consumable"> &
    (
        | {
              slug: string;
              img: string;
              name: string;
          }
        | { itemId: string }
    );

type ShortcutFlag =
    | ConsumableShortcutFlag
    | AttackShortcutFlag
    | ToggleShortcutFlag
    | ActionShortcutFlag;

type BaseShortCut<T extends ShortcutType> = ShortcutFlagBase<T> & {
    name: string;
    isEmpty?: false;
    img: string;
    isDisabled: boolean;
    isFadedOut: boolean;
};

type ActionShortcut = BaseShortCut<"action"> &
    ActionShortcutFlag & {
        item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e> | undefined;
        frequency: Maybe<{
            max: number;
            value: number;
            label: string;
        }>;
    };

type ToggleShortcut = BaseShortCut<"toggle"> &
    ToggleShortcutFlag & {
        item: ItemPF2e | undefined;
        checked: boolean;
    };

type ConsumableShortcut = BaseShortCut<"consumable"> &
    ConsumableShortcutFlag & {
        item: ConsumablePF2e<ActorPF2e> | undefined;
        quantity: number;
        uses: number | undefined;
        isGeneric: boolean;
        rank: RomanRank | undefined;
        categoryIcon: string | undefined;
    };

type BaseAttackShortcut = BaseShortCut<"attack"> &
    AttackShortcutFlag & {
        img: string;
        name: string;
    };

type BlastShortcut = BaseAttackShortcut & {
    blast: ActionBlast | undefined;
};

type StrikeShortcut = BaseAttackShortcut & {
    strike: ActionStrike | undefined;
};

type AttackShortcut = BlastShortcut | StrikeShortcut;

type Shortcut = ConsumableShortcut | AttackShortcut | ToggleShortcut | ActionShortcut;

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
        sidebars: SidebarMenu[];
        shortcutGroups: ShortcutGroup[];
        variantLabel: typeof variantLabel;
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
    ) => Promise<TContext | PersistentContext> | TContext | PersistentContext;
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
    isCharacter: boolean;
    isNPC: boolean;
};

type PersistentSettings = BaseActorSettings &
    SidebarSettings &
    Record<CloseSetting, boolean> & {
        cleanPortrait: boolean;
        noflash: boolean;
        confirmShortcut: boolean;
        consumableShortcut: "use" | "confirm" | "chat";
    };

export { PF2eHudPersistent };
