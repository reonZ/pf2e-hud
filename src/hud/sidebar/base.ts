import {
    addSidebarsListeners,
    BaseActorPF2eHUD,
    getSidebars,
    IAdvancedPF2eHUD,
    ItemHudPopup,
    SidebarName,
} from "hud";
import {
    ActorPF2e,
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
    ItemPF2e,
    MODULE,
    render,
    templatePath,
    unownedItemToMessage,
} from "module-helpers";
import {
    ActionSidebarPF2eHUD,
    ExtrasSidebarPF2eHUD,
    ItemsSidebarPF2eHUD,
    SkillsSidebarPF2eHUD,
    SpellsSidebarPF2eHUD,
} from ".";

abstract class SidebarPF2eHUD extends foundry.applications.api.ApplicationV2 {
    static #instance: SidebarPF2eHUD | null = null;

    #parent: IAdvancedPF2eHUD & BaseActorPF2eHUD;
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

    getItemFromElement<T extends ItemPF2e>(el: HTMLElement): T | null | Promise<T | null> {
        const actor = this.actor;
        const element = htmlClosest(el, ".item");
        if (!element) return null;

        const { parentId, itemId, itemUuid, itemType, actionIndex, entryId } = element.dataset;

        const item = parentId
            ? actor.inventory.get(parentId, { strict: true }).subitems.get(itemId, { strict: true })
            : itemUuid
            ? fromUuid<T>(itemUuid)
            : entryId
            ? actor.spellcasting?.collections
                  .get(entryId, { strict: true })
                  .get(itemId, { strict: true }) ?? null
            : itemType === "condition"
            ? actor.conditions.get(itemId, { strict: true })
            : actionIndex
            ? actor.system.actions?.[Number(actionIndex)].item ?? null
            : actor.items.get(itemId ?? "") ?? null;

        return item as T | null | Promise<T | null>;
    }

    protected _activateListeners(html: HTMLElement) {}

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        SidebarPF2eHUD.#instance = this;

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
                  dataset: { panel: "sidebars" },
                  content: await render("partials/sidebars", getSidebars(this.actor, this.name)),
              })
            : undefined;

        const innerElement = createHTMLElement("div", {
            classes: ["inner"],
            dataset: { tooltipDirection: "UP", sidebar: this.name },
            content: listElement,
        });

        return { innerElement, sidebarElement };
    }

    protected _replaceHTML(
        { innerElement, sidebarElement }: SidebarHudRenderElements,
        content: HTMLElement,
        options: ApplicationRenderOptions
    ): void {
        const previousInner = this.#innerElement;

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

        content.dataset.hud = this.parent.key;
        content.dataset.type = this.name;

        this.#innerElement = innerElement;

        this.#activateListeners(innerElement);
        this._activateListeners(innerElement);
    }

    protected _updatePosition(position: ApplicationPosition): ApplicationPosition {
        const element = this.element;
        const { limits, origin } = this.parent.sidebarCoords;
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

    #setColumns() {
        const element = this.element;
        const innerElement = this.#innerElement;
        if (!innerElement) return;

        const { limits } = this.parent.sidebarCoords;
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

    #activateListeners(html: HTMLElement) {
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
            const item = await this.getItemFromElement(el);
            if (!item) return;

            if (!item.actor) {
                unownedItemToMessage(this.actor, item, event);
            } else if (item.isOfType("spell")) {
                const rankStr = htmlClosest(el, "[data-cast-rank]")?.dataset.castRank;
                const castRank = Number(rankStr ?? NaN);

                item.toMessage(event, { data: { castRank } });
            } else {
                item.toMessage(event);
            }
        });
    }
}

type SidebarHudRenderElements = {
    innerElement: HTMLElement;
    sidebarElement: HTMLElement | undefined;
};

MODULE.devExpose({ SidebarPF2eHUD });

export { SidebarPF2eHUD };
