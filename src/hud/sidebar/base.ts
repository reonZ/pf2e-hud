import {
    addSidebarsListeners,
    BaseActorPF2eHUD,
    createDraggable,
    FoundryDragData,
    getItemFromElement,
    getSidebars,
    getUiScale,
    IAdvancedPF2eHUD,
    ItemHudPopup,
    makeFadeable,
    sendItemToChat,
    ShortcutData,
    SidebarCoords,
    SidebarName,
} from "hud";
import { hud } from "main";
import {
    ActorPF2e,
    addEnterKeyListeners,
    addListener,
    addListenerAll,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationPosition,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    assignStyle,
    createHTMLElement,
    createToggleableEvent,
    htmlClosest,
    htmlQuery,
    htmlQueryIn,
    ItemPF2e,
    localize,
    MODULE,
    postSyncElement,
    preSyncElement,
    R,
    render,
    templatePath,
} from "module-helpers";
import {
    ActionsSidebarPF2eHUD,
    BaseSidebarItem,
    createRollOptionsElements,
    ExtrasSidebarPF2eHUD,
    FeatsSidebarPF2eHUD,
    generateToggleKey,
    ItemsSidebarPF2eHUD,
    SkillsSidebarPF2eHUD,
    SpellsSidebarPF2eHUD,
} from ".";
import { getGlobalSetting } from "settings";

const _cached: { filter?: string } = {};

abstract class SidebarPF2eHUD<
    TItem extends ItemPF2e = ItemPF2e,
    TSidebarItem extends BaseSidebarItem<TItem> = BaseSidebarItem<TItem>
> extends foundry.applications.api.ApplicationV2 {
    static #instance: SidebarPF2eHUD | null = null;
    static #filter: string = "";

    #sidebarItems: Collection<TSidebarItem> = new Collection();

    #parent: IAdvancedPF2eHUD & BaseActorPF2eHUD;
    #filterElement: HTMLElement | undefined;
    #innerElement: HTMLElement | undefined;
    #sidebarElement: HTMLElement | undefined;

    #mouseDownEvent = createToggleableEvent(
        "mousedown",
        "#board",
        this.#onMouseDown.bind(this),
        true
    );

    #parentCloseListener = () => {
        this.close();
    };

    #parentRenderListener = () => {
        if (this.parent.actor) {
            this.render();
        } else {
            this.close();
        }
    };

    #parentPositionListener = () => {
        this.setPosition(this.position);
    };

    static get #sidebars() {
        return {
            actions: ActionsSidebarPF2eHUD,
            extras: ExtrasSidebarPF2eHUD,
            feats: FeatsSidebarPF2eHUD,
            items: ItemsSidebarPF2eHUD,
            skills: SkillsSidebarPF2eHUD,
            spells: SpellsSidebarPF2eHUD,
        };
    }

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-sidebar",
        window: {
            positioned: true,
            resizable: false,
            minimizable: false,
            frame: false,
        },
        position: {
            height: "auto",
        },
        classes: ["pf2e-hud-element", "pf2e-hud-colors", "theme-dark", "themed"],
    };

    static get keybindsSchema(): KeybindingActionConfig[] {
        return [
            {
                name: "filter",
                onUp: () => {
                    if (this.#filter && !getGlobalSetting("alwaysFilter")) {
                        this.filter = "";
                    } else {
                        this.openFilter();
                    }
                },
            },
        ];
    }

    static get instance(): SidebarPF2eHUD | null {
        return this.#instance;
    }

    static get innerElement(): HTMLElement | undefined {
        return this.#instance ? this.#instance.#innerElement : undefined;
    }

    static get filterElement(): HTMLElement | undefined {
        return this.#instance ? this.#instance.#filterElement : undefined;
    }

    static get filter(): string {
        return this.#filter;
    }

    static set filter(value) {
        const innerElement = this.innerElement;
        const filteredElements = innerElement?.querySelectorAll(".filtered") ?? [];
        for (const element of filteredElements) {
            element.classList.remove("filtered");
        }

        const trimmed = value.trim();

        if (trimmed.length) {
            const toTest = trimmed.toLowerCase();
            const toFilterElements =
                innerElement?.querySelectorAll<HTMLElement>("[data-filter-value]");

            let hasFilter = false;

            for (const toFilterElement of toFilterElements ?? []) {
                const filterValue = toFilterElement.dataset.filterValue as string;

                if (filterValue.includes(toTest)) {
                    hasFilter = true;
                    toFilterElement.classList.add("filtered");
                }
            }

            this.#filter = hasFilter ? trimmed : "";
        } else {
            this.#filter = "";
        }
    }

    static openFilter() {
        const filterElement = this.filterElement;
        const input = htmlQuery(filterElement, "input");

        filterElement?.classList.add("visible");

        if (input) {
            input.value = this.filter;
            input.focus();
        }
    }

    static closeFilter(reset: boolean) {
        const filterElement = this.filterElement;

        filterElement?.classList.remove("visible");

        if (reset) {
            this.filter = "";
        }
    }

    async close(options: ApplicationClosingOptions = {}): Promise<this> {
        options.animate = false;
        return super.close(options);
    }

    static toggleSidebar(sidebar: SidebarName, parent: IAdvancedPF2eHUD & BaseActorPF2eHUD) {
        if (this.#instance?.name === sidebar && this.isParent(parent)) {
            this.closeSidebar();
        } else {
            this.openSidebar(sidebar, parent);
        }
    }

    static openSidebar(sidebar: SidebarName, parent: IAdvancedPF2eHUD & BaseActorPF2eHUD) {
        if (this.#instance?.name === sidebar && this.isParent(parent)) return;

        this.closeSidebar();

        const instance = new this.#sidebars[sidebar](parent);
        instance.render(true);
    }

    static closeSidebar() {
        this.#instance?.close();
    }

    static refresh() {
        this.#instance?.render();
    }

    static get current(): SidebarName | null {
        return this.#instance?.name ?? null;
    }

    static isParent(hud: any): boolean {
        return this.#instance?.parent === hud;
    }

    constructor(
        parent: IAdvancedPF2eHUD & BaseActorPF2eHUD,
        options?: DeepPartial<ApplicationConfiguration>
    ) {
        super(options);

        this.#parent = parent;
    }

    abstract get name(): SidebarName;

    get parent(): IAdvancedPF2eHUD & BaseActorPF2eHUD {
        return this.#parent;
    }

    get actor(): ActorPF2e {
        return this.parent.actor as ActorPF2e;
    }

    get coords(): UpdatedSidebarCoords {
        const uiScale = getUiScale();
        const coords = this.parent.sidebarCoords as UpdatedSidebarCoords;

        const bounds = this.element.getBoundingClientRect();

        const offsetWidth = (bounds.width / uiScale - bounds.width) / 2;
        const offsetHeight = (bounds.height / uiScale - bounds.height) / 2;

        coords.uiScale = uiScale;
        coords.origin.x -= bounds.width / uiScale / 2;
        coords.origin.y -= bounds.height / uiScale / 2;

        coords.limits.left -= offsetWidth;
        coords.limits.right -= offsetWidth;
        coords.limits.top -= offsetHeight;
        coords.limits.bottom -= offsetHeight;

        coords.bounds = bounds;

        const maxHeight = window.innerHeight;
        const filterHeight = (this.#filterElement?.offsetHeight ?? 0) + 5;
        const offsetFilter = filterHeight - filterHeight * uiScale;

        if (coords.limits.bottom > maxHeight - filterHeight - offsetFilter) {
            coords.limits.bottom = maxHeight - filterHeight - offsetFilter;
        }

        return coords;
    }

    get sidebarItems(): Collection<TSidebarItem> {
        return this.#sidebarItems;
    }

    get fadeoutOnDrag(): boolean {
        return true;
    }

    addSidebarItem<T extends TSidebarItem>(
        ItemCls: ConstructorOf<T>,
        prop: ExtractValuesOfType<T, string>[keyof T] | (string & {}),
        ...args: ConstructorParameters<ConstructorOf<T>>
    ) {
        const item = new ItemCls(...args);
        this.sidebarItems.set(
            prop in item ? (item[prop as keyof typeof item] as string) : (prop as string),
            item
        );
        return item;
    }

    getSidebarItemKey({ itemId, itemUuid }: DOMStringMap): string | undefined {
        return itemUuid ?? itemId;
    }

    getSidebarItemFromElement<T extends TSidebarItem>(el: HTMLElement): T | null {
        const target = htmlClosest(el, ".item") ?? htmlQueryIn(el, ".item-wrapper", ".item");
        if (!target) return null;

        const toggleKey = generateToggleKey(target.dataset);
        const toggle = toggleKey ? this.sidebarItems.get(toggleKey) : undefined;

        if (toggle) {
            return toggle as T;
        }

        const key = this.getSidebarItemKey(target.dataset);
        return key ? (this.sidebarItems.get(key) as T | null) : null;
    }

    protected _activateListeners(html: HTMLElement) {}

    protected _onFirstRender(context: object, options: SidebarRenderOptions): void {
        SidebarPF2eHUD.#instance = this;
        SidebarPF2eHUD.#filter = "";

        this.element.dataset.tooltipClass = "pf2e-hud-element";

        this.#mouseDownEvent.activate();

        this.parent.addEventListener("position", this.#parentPositionListener);
        this.parent.addEventListener("close", this.#parentCloseListener, { once: true });
        this.parent.addEventListener("render", this.#parentRenderListener);

        if (this.fadeoutOnDrag) {
            makeFadeable(this);
        }
    }

    protected _onRender(context: object, options: SidebarRenderOptions): void {
        htmlQuery(this.parent.element, `[data-sidebar="${this.name}"]`)?.classList.add("active");
        this.#setColumns();

        requestAnimationFrame(() => {
            if (this.#sidebarElement && this.#innerElement) {
                this.#sidebarElement.classList.toggle(
                    "top",
                    this.#innerElement.offsetHeight <= this.#sidebarElement.offsetHeight
                );
            }

            if (SidebarPF2eHUD.#filter) {
                SidebarPF2eHUD.filter = SidebarPF2eHUD.#filter;
            }
        });
    }

    protected _onClose(options: ApplicationClosingOptions): void {
        SidebarPF2eHUD.#filter = "";
        SidebarPF2eHUD.#instance = null;

        const sidebarButtons = this.parent.element?.querySelectorAll<HTMLElement>(`[data-sidebar]`);
        for (const el of sidebarButtons ?? []) {
            el.classList.remove("active");
        }

        this.#mouseDownEvent.disable();

        this.#sidebarItems.clear();

        this.parent.removeEventListener("position", this.#parentPositionListener);
        this.parent.removeEventListener("close", this.#parentCloseListener);
        this.parent.removeEventListener("render", this.#parentRenderListener);
    }

    protected _configureRenderOptions(options: SidebarRenderOptions): void {
        super._configureRenderOptions(options);

        options.alwaysFilter = getGlobalSetting("alwaysFilter");

        this.sidebarItems.clear();
    }

    protected async _renderHTML(
        context: SidebarRenderContext,
        options: SidebarRenderOptions
    ): Promise<SidebarHudRenderElements> {
        const actor = this.actor;
        const flaggedItems = actor.isOfType("character")
            ? Object.keys(actor.flags["pf2e-dailies"]?.flaggedItems ?? {})
            : [];

        context.partial = (key: string) => templatePath("partials", key);
        context.flagged = ({ id } = {}) => R.isString(id) && flaggedItems.includes(id);

        const listElement = createHTMLElement("div", {
            classes: ["item-list"],
            content: await render(`sidebar/${this.name}`, context),
        });

        const sidebarElement = this.parent.sidebarCeption
            ? createHTMLElement("div", {
                  content: await render("partials/sidebars", getSidebars(this.actor, this.name)),
                  dataset: { panel: "sidebars" },
              })
            : undefined;

        const innerElement = createHTMLElement("div", {
            classes: ["inner"],
            content: listElement,
            dataset: { tooltipDirection: "UP", sidebar: this.name },
        });

        const filterLabel = (_cached.filter ??= localize("sidebar.filter"));
        const filterElement = createHTMLElement("div", {
            classes: options.alwaysFilter ? ["visible"] : [],
            content: `<input type="text" id="pf2e-hud-sidebar-filter" placeholder="${filterLabel}">`,
            dataset: { panel: "filter" },
        });

        const toggles = await createRollOptionsElements.call(this);
        if (toggles) {
            listElement.prepend(toggles);
        }

        return { filterElement, innerElement, sidebarElement };
    }

    protected _replaceHTML(
        { filterElement, innerElement, sidebarElement }: SidebarHudRenderElements,
        content: HTMLElement,
        options: SidebarRenderOptions
    ): void {
        const previousInner = this.#innerElement;
        const previousFilter = this.#filterElement;

        const state =
            previousInner?.dataset.sidebar === innerElement.dataset.sidebar &&
            preSyncElement(innerElement, previousInner);

        if (previousInner) {
            previousInner.replaceWith(innerElement);
        } else {
            content.appendChild(innerElement);
        }

        if (sidebarElement) {
            const previousSidebar = this.#sidebarElement;

            if (previousSidebar) {
                previousSidebar.replaceWith(sidebarElement);
            } else {
                content.appendChild(sidebarElement);
            }

            this.#sidebarElement = sidebarElement;
            addSidebarsListeners(this.parent, sidebarElement);
        }

        if (previousFilter) {
            previousFilter.replaceWith(filterElement);
        } else {
            content.appendChild(filterElement);
        }

        content.dataset.hud = this.parent.key;
        content.dataset.type = this.name;

        this.#filterElement = filterElement;
        this.#innerElement = innerElement;

        if (previousInner && state) {
            postSyncElement(innerElement, state);
        }

        this.#activateFilterListener(filterElement, options);
        this.#activateInnerListeners(innerElement);
        this._activateListeners(innerElement);
    }

    protected _updatePosition(position: ApplicationPosition): ApplicationPosition {
        const element = this.element;
        const { bounds, limits, origin } = this.coords;

        super._updatePosition(position);

        position.left = origin.x;
        position.top = origin.y;

        if (position.top + bounds.height > limits.bottom) {
            position.top = limits.bottom - bounds.height;
        }

        if (position.top < limits.top) {
            position.top = limits.top;
        }

        if (position.left + bounds.width > limits.right) {
            position.left = limits.right - bounds.width;
        }

        if (position.left < limits.left) {
            position.left = limits.left;
        }

        assignStyle(element, {
            left: `${position.left}px`,
            top: `${position.top}px`,
            zIndex: String(position.zIndex),
        });

        return position;
    }

    #onMouseDown(event: MouseEvent) {
        if (event.button !== 0) return;

        event.stopPropagation();
        this.close();
        hud.tooltip._onMouseDown();
    }

    #onDragStart(target: HTMLElement, event: DragEvent) {
        const sidebarItem = this.getSidebarItemFromElement(target);
        if (!sidebarItem) return;

        createDraggable<SidebarDragData>(
            event,
            sidebarItem.img,
            this.actor,
            sidebarItem.item,
            sidebarItem.createDragData(event)
        );
    }

    #setColumns() {
        const element = this.element;
        const innerElement = this.#innerElement;
        if (!innerElement) return;

        const { limits, uiScale } = this.coords;

        const elementStyle = getComputedStyle(element);
        const innerStyle = getComputedStyle(innerElement);
        const viewportHeight = window.innerHeight / uiScale;
        const allottedHeight = (limits.bottom - limits.top) / uiScale;
        const maxHeight = Math.min(allottedHeight, viewportHeight);

        const maxInnerHeight =
            maxHeight -
            parseFloat(elementStyle.paddingTop) -
            parseFloat(elementStyle.paddingBottom) -
            parseInt(innerStyle.borderTopWidth) -
            parseInt(innerStyle.borderBottomWidth);

        const nbColumns = Math.clamp(Math.ceil(innerElement.scrollHeight / maxInnerHeight), 0, 5);
        innerElement.style.setProperty("--nb-columns", String(nbColumns));

        element.style.setProperty("--max-height", `${maxHeight}px`);
    }

    #activateFilterListener(html: HTMLElement, options: SidebarRenderOptions) {
        addListener(html, "input", "keyup", (el, event) => {
            if (!R.isIncludedIn(event.key, ["Enter", "Escape"])) return;

            event.preventDefault();

            if (options.alwaysFilter) {
                el.blur();
            } else {
                SidebarPF2eHUD.closeFilter(false);
            }

            if (event.key === "Escape") {
                el.value = "";
                SidebarPF2eHUD.filter = "";
            }
        });

        addListener(html, "input", "input", (el) => {
            SidebarPF2eHUD.filter = el.value;
        });
    }

    #activateInnerListeners(html: HTMLElement) {
        addListenerAll(html, "[draggable='true']", "dragstart", this.#onDragStart.bind(this));

        addListenerAll(html, `input[type="number"]`, "focus", (el: HTMLInputElement) => {
            el.select();
        });

        addEnterKeyListeners(html, "number");

        addListenerAll(
            html,
            "input[data-item-id][data-item-property]",
            "change",
            (el: HTMLInputElement, event) => {
                event.stopPropagation();
                const { itemId, itemProperty } = el.dataset;
                if (!itemId || !itemProperty) return;

                const min = Number(el.min) || 0;
                const max = Number(el.max) || Infinity;

                if (el.valueAsNumber > max) {
                    el.valueAsNumber = max;
                } else if (el.valueAsNumber < min) {
                    el.valueAsNumber = min;
                }

                this.actor.updateEmbeddedDocuments("Item", [
                    { _id: itemId, [itemProperty]: el.valueAsNumber },
                ]);
            }
        );

        addListenerAll(html, "[data-action='item-description']", async (el, event) => {
            const actor = this.actor;
            const item =
                this.getSidebarItemFromElement(el)?.item ??
                (await getItemFromElement<TItem>(this.actor, el)) ??
                null;

            if (item) {
                new ItemHudPopup(actor, item, event).render(true);
            }
        });

        addListenerAll(html, "[data-action='send-to-chat']", async (el, event) => {
            sendItemToChat(this.actor, event, el);
        });

        /**
         * https://github.com/foundryvtt/pf2e/blob/3157c39e82c91001bb362e43e3439f782834db56/src/module/actor/sheet/base.ts#L432
         */
        addListenerAll(html, "ul[data-option-toggles]", "change", (_, event) => {
            const toggleRow = htmlClosest(event.target, "[data-item-id][data-domain][data-option]");
            const checkbox = htmlQuery<HTMLInputElement>(
                toggleRow,
                "input[data-action=toggle-roll-option]"
            );
            const suboptionsSelect = htmlQuery<HTMLSelectElement>(
                toggleRow,
                "select[data-action=set-suboption"
            );
            const { domain, option, itemId } = toggleRow?.dataset ?? {};
            const suboption = suboptionsSelect?.value ?? null;
            if (checkbox && domain && option) {
                this.actor.toggleRollOption(
                    domain,
                    option,
                    itemId ?? null,
                    checkbox.checked,
                    suboption
                );
            }
        });
    }
}

type SidebarDragData = FoundryDragData & {
    fromSidebar: ShortcutData;
};

type SidebarHudRenderElements = {
    filterElement: HTMLElement;
    innerElement: HTMLElement;
    sidebarElement: HTMLElement | undefined;
};

type UpdatedSidebarCoords = SidebarCoords & { bounds: DOMRect; uiScale: number };

type SidebarRenderContext = ApplicationRenderContext & {
    partial: (key: string) => string;
    flagged: (item?: { id?: string }) => boolean;
};

type SidebarRenderOptions = ApplicationRenderOptions & {
    alwaysFilter: boolean;
};

MODULE.devExpose({ SidebarPF2eHUD });

export { SidebarPF2eHUD };
export type { SidebarDragData };
