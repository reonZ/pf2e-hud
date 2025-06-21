import {
    addSidebarsListeners,
    BaseActorPF2eHUD,
    getItemFromElement,
    getSidebars,
    IAdvancedPF2eHUD,
    ItemHudPopup,
    sendItemToChat,
    SidebarCoords,
    SidebarName,
} from "hud";
import {
    ActorPF2e,
    addListener,
    addListenerAll,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationPosition,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    assignStyle,
    createHTMLElement,
    createHTMLElementContent,
    createToggleableEvent,
    htmlClosest,
    htmlQuery,
    ItemPF2e,
    localize,
    MODULE,
    postSyncElement,
    preSyncElement,
    R,
    render,
    RollOptionToggle,
    templatePath,
} from "module-helpers";
import {
    ActionSidebarPF2eHUD,
    ExtrasSidebarPF2eHUD,
    ItemsSidebarPF2eHUD,
    SkillsSidebarPF2eHUD,
    SpellsSidebarPF2eHUD,
} from ".";

const ROLLOPTIONS_PLACEMENT = {
    actions: "actions",
    spells: "spellcasting",
    items: "inventory",
    skills: "proficiencies",
    extras: undefined,
} as const;

const _cached: { filter?: string } = {};

abstract class SidebarPF2eHUD extends foundry.applications.api.ApplicationV2 {
    static #instance: SidebarPF2eHUD | null = null;
    static #filter: string = "";

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

    #parentCloseListener = () => this.close();
    #parentRenderListener = () => this.render();
    #parentPositionListener = () => this.setPosition(this.position);

    static get #sidebars() {
        return {
            actions: ActionSidebarPF2eHUD,
            extras: ExtrasSidebarPF2eHUD,
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
        classes: ["pf2e-hud"],
    };

    static get keybindsSchema(): KeybindingActionConfig[] {
        return [
            {
                name: "filter",
                onUp: () => {
                    if (this.#filter) {
                        this.filter = "";
                    } else {
                        this.openFilter();
                    }
                },
            },
        ];
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
        if (!this.#instance) return;
        this.#instance?.close();
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

    get sidebarCoords(): SidebarCoords {
        const coords = this.parent.sidebarCoords;
        const maxHeight = window.innerHeight;
        const filterHeight = this.#filterElement?.offsetHeight ?? 0 - 5;

        if (coords.limits.bottom > maxHeight - filterHeight) {
            const newBottom = maxHeight - filterHeight;
            const diff = coords.limits.bottom - newBottom;

            coords.limits.bottom = newBottom;
            coords.limits.top = Math.max(coords.limits.top - diff, 0);
        }

        return coords;
    }

    getItemFromElement<T extends ItemPF2e>(el: HTMLElement, sync: true): T | null;
    getItemFromElement<T extends ItemPF2e>(
        el: HTMLElement,
        sync?: false
    ): T | null | Promise<T | null>;
    getItemFromElement(el: HTMLElement, sync?: boolean) {
        return getItemFromElement(this.actor, el, sync as any);
    }

    protected _activateListeners(html: HTMLElement) {}

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        SidebarPF2eHUD.#instance = this;
        SidebarPF2eHUD.#filter = "";

        this.element.dataset.tooltipClass = "pf2e-hud";

        this.#mouseDownEvent.activate();

        this.parent.addEventListener("position", this.#parentPositionListener);
        this.parent.addEventListener("close", this.#parentCloseListener, { once: true });
        this.parent.addEventListener("render", this.#parentRenderListener);
    }

    protected _onRender(context: object, options: ApplicationRenderOptions): void {
        htmlQuery(this.parent.element, `[data-sidebar="${this.name}"]`)?.classList.add("active");
        this.#setColumns();

        requestAnimationFrame(() => {
            if (this.#sidebarElement && this.#innerElement) {
                this.#sidebarElement.classList.toggle(
                    "top",
                    this.#innerElement.offsetHeight <= this.#sidebarElement.offsetHeight
                );
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

        this.parent.removeEventListener("position", this.#parentPositionListener);
        this.parent.removeEventListener("close", this.#parentCloseListener);
        this.parent.removeEventListener("render", this.#parentRenderListener);
    }

    protected async _renderHTML(
        context: ApplicationRenderContext & { partial: (key: string) => string },
        options: ApplicationRenderOptions
    ): Promise<SidebarHudRenderElements> {
        context.partial = (key: string) => templatePath("partials", key);

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
            content: `<input type="text" id="pf2e-hud-sidebar-filter" placeholder="${filterLabel}">`,
            dataset: { panel: "filter" },
        });

        const selectedPlacement = ROLLOPTIONS_PLACEMENT[this.name];
        if (selectedPlacement) {
            const actor = this.actor;
            const toggles = getRollOptionsData(actor, selectedPlacement);

            if (toggles?.length) {
                const togglesTemplate = await foundry.applications.handlebars.renderTemplate(
                    "systems/pf2e/templates/actors/partials/toggles.hbs",
                    { toggles }
                );

                const togglesElement = createHTMLElementContent({
                    content: togglesTemplate,
                });

                for (const { itemId, img } of toggles) {
                    if (!img) continue;

                    const imgEl = createHTMLElement("img", { classes: ["drag-img"] });
                    imgEl.src = img;

                    const toggleRow = htmlQuery(togglesElement, `[data-item-id="${itemId}"]`);

                    if (toggleRow) {
                        toggleRow.draggable = true;
                        toggleRow.appendChild(imgEl);
                    }
                }

                listElement.prepend(togglesElement);
            }
        }

        return { filterElement, innerElement, sidebarElement };
    }

    protected _replaceHTML(
        { filterElement, innerElement, sidebarElement }: SidebarHudRenderElements,
        content: HTMLElement,
        options: ApplicationRenderOptions
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

        this.#activateFilterListener(filterElement);
        this.#activateInnerListeners(innerElement);
        this._activateListeners(innerElement);
    }

    protected _updatePosition(position: ApplicationPosition): ApplicationPosition {
        const element = this.element;
        const { limits, origin } = this.sidebarCoords;
        const bounds = this.element.getBoundingClientRect();

        super._updatePosition(position);

        position.left = origin.x - bounds.width / 2;
        position.top = origin.y - bounds.height / 2;

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
    }

    #onDragStart(target: HTMLElement, event: DragEvent) {
        if (!event.dataTransfer) return;

        const parent = target.dataset.dragParent
            ? htmlClosest(target, target.dataset.dragParent)!
            : target;

        const item = this.getItemFromElement(target, true);
        const img = parent.querySelector<HTMLImageElement>(".drag-img")?.src ?? item?.img ?? "";

        const baseDragData: BaseDragData = {
            actorId: this.actor.id,
            actorUUID: this.actor.uuid,
            fromSidebar: true,
            sceneId: canvas.scene?.id ?? null,
            tokenId: this.actor.token?.id ?? null,
            ...item?.toDragData(),
        };

        const dragData = {
            ...baseDragData,
            // ...extraDragData,
            // ...toggleDragData,
        };

        const draggable = createHTMLElement("div", {
            classes: ["pf2e-hud-draggable"],
            content: `<img src="${img}">`,
        });

        document.body.append(draggable);

        event.dataTransfer.setDragImage(draggable, 16, 16);
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));

        target.addEventListener("dragend", () => draggable.remove(), { once: true });
    }

    #setColumns() {
        const element = this.element;
        const innerElement = this.#innerElement;
        if (!innerElement) return;

        const { limits } = this.sidebarCoords;
        const elementStyle = getComputedStyle(element);
        const innerStyle = getComputedStyle(innerElement);
        const viewportHeight = window.innerHeight;
        const allottedHeight = (limits?.bottom ?? viewportHeight) - (limits?.top ?? 0);
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

    #activateFilterListener(html: HTMLElement) {
        addListener(html, "input", "keyup", (_, event) => {
            if (event.key === "Enter") {
                SidebarPF2eHUD.closeFilter(false);
            } else if (event.key === "Escape") {
                SidebarPF2eHUD.closeFilter(true);
                SidebarPF2eHUD.filter = "";
            }
        });

        addListener(html, "input", "input", (el) => {
            SidebarPF2eHUD.filter = el.value;
        });
    }

    #activateInnerListeners(html: HTMLElement) {
        addListenerAll(html, "[draggable='true']", "dragstart", this.#onDragStart.bind(this));

        addListenerAll(
            html,
            "input[data-item-id][data-item-property]",
            "change",
            (el: HTMLInputElement, event) => {
                event.stopPropagation();
                const { itemId, itemProperty } = el.dataset;
                if (!itemId || !itemProperty) return;

                this.actor.updateEmbeddedDocuments("Item", [
                    { _id: itemId, [itemProperty]: el.valueAsNumber },
                ]);
            }
        );

        addListenerAll(html, "[data-action='item-description']", async (el, event) => {
            const actor = this.actor;
            const item = await this.getItemFromElement(el);

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

function getRollOptionsData(actor: ActorPF2e, selected: RolloptionPlacement): RollOptionsData[] {
    return R.pipe(
        R.values(actor.synthetics.toggles).flatMap((domain) => Object.values(domain)),
        R.filter(({ placement, option, domain }) => {
            return (
                placement === selected && (domain !== "elemental-blast" || option !== "action-cost")
            );
        }),
        R.map((toggle): RollOptionsData => {
            return {
                ...toggle,
                img: actor.items.get(toggle.itemId)?.img,
            };
        })
    );
}

type RolloptionPlacement = ValueOf<typeof ROLLOPTIONS_PLACEMENT>;

type RollOptionsData = RollOptionToggle & {
    img: ImageFilePath | undefined;
};

type BaseDragData = Partial<ReturnType<ItemPF2e["toDragData"]>> & {
    actorId: string;
    actorUUID: ActorUUID;
    fromSidebar: true;
    sceneId: string | null;
    tokenId: string | null;
};

type SidebarHudRenderElements = {
    filterElement: HTMLElement;
    innerElement: HTMLElement;
    sidebarElement: HTMLElement | undefined;
};

MODULE.devExpose({ SidebarPF2eHUD });

export { SidebarPF2eHUD };
