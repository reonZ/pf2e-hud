import {
    MODULE,
    R,
    addListenerAll,
    createHTMLElement,
    elementDataset,
    hasSpells,
    htmlClosest,
    htmlQuery,
    render,
    templateLocalize,
    templatePath,
} from "foundry-pf2e";
import { PF2eHudBaseActor } from "../base/actor";
import { IPF2eHudAdvanced } from "../base/advanced";
import { GlobalSettings } from "../base/base";
import { PF2eHudItemPopup } from "../popup/item";
import { addDragoverListener } from "../shared/advanced";
import { getItemFromElement } from "../shared/base";
import { addEnterKeyListeners, addSendItemToChatListeners } from "../shared/listeners";

const SIDEBARS = [
    {
        type: "actions",
        icon: "fa-solid fa-sword",
        disabled: (actor: ActorPF2e) => {
            if (!actor.isOfType("character")) {
                return !actor.system.actions?.length && !actor.itemTypes.action.length;
            }
            return false;
        },
    },
    {
        type: "items",
        icon: "fa-solid fa-backpack",
        disabled: (actor: ActorPF2e) => actor.inventory.size < 1,
    },
    {
        type: "spells",
        icon: "fa-solid fa-wand-magic-sparkles",
        disabled: (actor: ActorPF2e) => !hasSpells(actor),
    },
    {
        type: "skills",
        icon: "fa-solid fa-hand",
        disabled: (actor: ActorPF2e) => !actor.isOfType("creature"),
    },
    {
        type: "extras",
        icon: "fa-solid fa-cubes",
        disabled: (actor: ActorPF2e) => false,
    },
] as const;

const ROLLOPTIONS_PLACEMENT = {
    actions: "actions",
    spells: "spellcasting",
    items: "inventory",
    skills: "proficiencies",
    extras: undefined,
} as const;

abstract class PF2eHudSidebar extends foundry.applications.api
    .ApplicationV2<ApplicationConfiguration> {
    #innerElement!: HTMLElement;
    #parentHud: IPF2eHudAdvanced & PF2eHudBaseActor;
    #filter: string = "";

    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        id: "pf2e-hud-sidebar",
        window: {
            positioned: true,
            resizable: false,
            minimizable: false,
            frame: false,
        },
        position: {
            width: "auto",
            height: "auto",
        },
    };

    constructor(
        parent: IPF2eHudAdvanced & PF2eHudBaseActor,
        options?: Partial<ApplicationConfiguration>
    ) {
        super(options);
        this.#parentHud = parent;
    }

    abstract get key(): SidebarName;

    get partials(): string[] {
        return [
            "item_image",
            "strike_category",
            "strike_versatiles",
            "strike_auxiliaries",
            "action_blast-row",
            "action_strike-row",
            "statistic-action",
        ];
    }

    get parentHUD() {
        return this.#parentHud;
    }

    get actor() {
        return this.parentHUD.actor!;
    }

    get innerElement() {
        return this.#innerElement;
    }

    get scrollElement() {
        return htmlQuery(this.innerElement, ".item-list");
    }

    get canUseFilter() {
        return true;
    }

    get filter() {
        return this.#filter;
    }

    set filter(value) {
        const trimmed = value.trim();

        const filteredElements = this.innerElement.querySelectorAll(".filtered");
        for (const element of filteredElements) {
            element.classList.remove("filtered");
        }

        if (trimmed.length) {
            const toTest = trimmed.toLowerCase();
            const toFilterElements =
                this.innerElement.querySelectorAll<HTMLElement>("[data-filter-value]");

            let hasFilter = false;

            for (const toFilterElement of toFilterElements) {
                const { filterValue } = elementDataset(toFilterElement);

                if (filterValue.toLowerCase().includes(toTest)) {
                    hasFilter = true;
                    toFilterElement.classList.add("filtered");
                }
            }

            this.#filter = hasFilter ? trimmed : "";
        } else {
            this.#filter = "";
        }
    }

    async _preFirstRender(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<void> {
        const templates: Set<string> = new Set();

        for (const partial of this.partials) {
            const path = templatePath("partials", partial);
            templates.add(path);
        }

        await loadTemplates(Array.from(templates));
    }

    _configureRenderOptions(options: SidebarRenderOptions) {
        super._configureRenderOptions(options);
        options.fontSize = this.getSetting("sidebarFontSize");
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<SidebarContext> {
        return {
            i18n: templateLocalize(`sidebars.${this.key}`),
            partial: (key: string) => templatePath("partials", key),
        };
    }

    async _renderHTML(
        context: SidebarContext,
        options: SidebarRenderOptions
    ): Promise<HTMLElement> {
        const sidebarTemplate = await render("sidebars", this.key, context);

        const listElement = createHTMLElement("div", {
            classes: ["item-list"],
            innerHTML: sidebarTemplate,
        });

        const innerElement = createHTMLElement("div", {
            classes: ["inner", this.key, this.parentHUD.key],
            dataset: { tooltipDirection: "UP", sidebar: this.key },
            children: [listElement],
        });

        await this.parentHUD._renderSidebarHTML?.(innerElement, this.key);

        const placement = ROLLOPTIONS_PLACEMENT[this.key];
        if (placement) {
            const actor = this.actor;
            const toggles = R.pipe(
                R.values(this.actor.synthetics.toggles).flatMap((domain) => Object.values(domain)),
                R.filter((option) => option.placement === placement),
                R.map((toggle) => ({
                    ...toggle,
                    label: game.i18n.localize(toggle.label),
                    img: actor.items.get(toggle.itemId)?.img,
                }))
            );

            if (toggles.length) {
                const togglesTemplate = await render("sidebars/rolloptions", { toggles });
                const togglesElement = createHTMLElement("div", {
                    innerHTML: togglesTemplate,
                });

                listElement.prepend(...togglesElement.children);
            }
        }

        return innerElement;
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement, options: SidebarRenderOptions) {
        content.style.setProperty("--font-size", `${options.fontSize}px`);

        const oldElement = this.#innerElement;
        const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

        const scrollPositions = (() => {
            if (!oldElement || oldElement.dataset.sidebar !== result.dataset.sidebar) return;

            const scrollElement = this.scrollElement;
            if (!scrollElement) return;

            return { left: scrollElement.scrollLeft, top: scrollElement.scrollTop };
        })();

        this.#innerElement = result;

        if (oldElement) oldElement.replaceWith(this.#innerElement);
        else content.appendChild(this.#innerElement);

        if (focusName) {
            this.#innerElement
                .querySelector<HTMLInputElement>(`input[name="${focusName}"]`)
                ?.focus();
        }

        if (scrollPositions) {
            const scrollElement = this.scrollElement!;
            scrollElement.scrollLeft = scrollPositions.left;
            scrollElement.scrollTop = scrollPositions.top;
        }

        this.#activateListeners(this.#innerElement);
        this._activateListeners?.(this.#innerElement);
    }

    _onFirstRender(context: ApplicationRenderContext, options: SidebarRenderOptions) {
        this.bringToFront();
    }

    _onRender(context: ApplicationRenderContext, options: SidebarRenderOptions) {
        const innerElement = this.innerElement;
        const multiColumns = this.getSetting("multiColumns");

        if (multiColumns > 1) {
            const maxHeight = this.getMaxHeight(true);
            const virtualHeight = (this.scrollElement?.scrollHeight ?? 0) + 8;
            const columns = Math.clamp(Math.ceil(virtualHeight / maxHeight), 1, multiColumns);

            if (columns > 1) {
                innerElement.style.setProperty("--nb-columns", String(columns));
            } else {
                innerElement.style.removeProperty("--nb-columns");
            }
        }

        this.parentHUD._onRenderSidebar?.(innerElement);
    }

    _updatePosition(position = {} as ApplicationPosition) {
        const element = this.element;
        if (!element) return position;

        const anchor = this.parentHUD.anchor;
        const maxHeight = this.getMaxHeight();
        const bounds = element.getBoundingClientRect();
        const center: Point = { x: anchor.x, y: anchor.y };
        const limits = {
            right: anchor.limits?.right ?? window.innerWidth,
            bottom: anchor.limits?.bottom ?? window.innerHeight,
        };

        position.left = center.x - bounds.width / 2;
        position.top = center.y - bounds.height / 2;

        if (position.left + bounds.width > limits.right)
            position.left = limits.right - bounds.width;
        if (position.left < 0) position.left = 0;
        if (position.top + bounds.height > limits.bottom)
            position.top = limits.bottom - bounds.height;
        if (position.top < 0) position.top = 0;

        element.style.setProperty("left", `${position.left}px`);
        element.style.setProperty("top", `${position.top}px`);
        element.style.setProperty("--max-height", `${maxHeight}px`);

        this.parentHUD._updateSidebarPosition?.(element, center, limits);

        return position;
    }

    _onPosition(position: ApplicationPosition) {
        requestAnimationFrame(() => this._updatePosition());
    }

    async close(options: ApplicationClosingOptions = {}): Promise<this> {
        options.animate = false;
        return super.close(options);
    }

    getMaxHeight(inner?: boolean) {
        const { limits } = this.parentHUD.anchor;
        const allottedHeight = (limits?.bottom ?? window.innerHeight) - (limits?.top ?? 0);
        const maxHeight = allottedHeight * (this.getSetting("sidebarHeight") / 100);

        if (inner) {
            const elementStyle = getComputedStyle(this.element);
            const innerStyle = getComputedStyle(this.innerElement);

            return (
                maxHeight -
                parseFloat(elementStyle.paddingTop) -
                parseFloat(elementStyle.paddingBottom) -
                parseInt(innerStyle.borderTopWidth) -
                parseInt(innerStyle.borderBottomWidth)
            );
        }

        return maxHeight;
    }

    getSetting<K extends keyof SidebarSettings & string>(key: K): SidebarSettings[K];
    getSetting<K extends keyof GlobalSettings & string>(key: K): GlobalSettings[K];
    getSetting<K extends (keyof SidebarSettings | keyof GlobalSettings) & string>(key: K) {
        return this.parentHUD.getSetting(key as any);
    }

    #activateListeners(html: HTMLElement) {
        addEnterKeyListeners(html);
        addSendItemToChatListeners(this.actor, html);

        if (this.key !== "extras") {
            addDragoverListener(this.element);
        }

        addListenerAll(html, "[draggable='true']", "dragstart", async (event, target) => {
            if (!event.dataTransfer) return;

            const el = target.dataset.dragParent
                ? htmlClosest(target, target.dataset.dragParent)!
                : target;
            const { label, domain, option } = el.dataset;
            const item = (() => {
                const item = getItemFromElement(el, this.actor);
                return item instanceof Item ? item : null;
            })();

            const imgSrc = el.querySelector<HTMLImageElement>(".drag-img")?.src ?? item?.img ?? "";
            const draggable = createHTMLElement("div", {
                classes: ["pf2e-hud-draggable"],
                innerHTML: `<img src="${imgSrc}">`,
            });

            document.body.append(draggable);
            event.dataTransfer.setDragImage(draggable, 16, 16);

            const baseDragData: Record<string, JSONValue> = {
                actorId: this.actor.id,
                actorUUID: this.actor.uuid,
                sceneId: canvas.scene?.id ?? null,
                tokenId: this.actor.token?.id ?? null,
                fromSidebar: true,
                ...item?.toDragData(),
            };

            const extraDragData = this._getDragData?.(target, baseDragData, item);
            const toggleDragData =
                item && label && domain && option
                    ? { type: "RollOption", ...el.dataset }
                    : undefined;

            event.dataTransfer.setData(
                "text/plain",
                JSON.stringify({ ...baseDragData, ...extraDragData, ...toggleDragData })
            );

            target.addEventListener("dragend", () => draggable.remove(), { once: true });
        });

        addListenerAll(html, "[data-action='item-description']", async (event, el) => {
            const actor = this.actor;
            const item = await getItemFromElement(el, actor);
            if (!item) return;
            new PF2eHudItemPopup({ actor, item, event }).render(true);
        });

        addListenerAll(html, ".option-toggle", "change", (event, el) => {
            const toggleRow = htmlClosest(el, "[data-item-id][data-domain][data-option]");
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

        addListenerAll(html, "[data-action='open-sidebar']", (event, el) => {
            const sidebar = el.dataset.sidebar as SidebarName;
            this.parentHUD.toggleSidebar(sidebar);
        });

        addListenerAll(
            html,
            "input[data-item-id][data-item-property]",
            "change",
            (event, el: HTMLInputElement) => {
                event.stopPropagation();
                const { itemId, itemProperty } = elementDataset(el);
                this.actor.updateEmbeddedDocuments("Item", [
                    {
                        _id: itemId,
                        [itemProperty]: el.valueAsNumber,
                    },
                ]);
            }
        );
    }
}

function getSidebars(actor: ActorPF2e, active?: SidebarName) {
    return SIDEBARS.map(
        ({ type, disabled, icon }): SidebarMenu => ({
            type,
            icon,
            label: MODULE.path("sidebars", type, "title"),
            disabled: disabled(actor),
            active: active === type,
        })
    );
}

interface PF2eHudSidebar {
    _getDragData?(
        target: HTMLElement,
        baseDragData: Record<string, JSONValue>,
        item: Maybe<ItemPF2e>
    ): Record<string, JSONValue> | undefined;
    _activateListeners?(html: HTMLElement): void;
}

type SidebarContext = {
    i18n: ReturnType<typeof templateLocalize>;
    partial: (template: string) => string;
};

type SidebarRenderOptions = ApplicationRenderOptions & {
    fontSize: number;
};

type SidebarName = (typeof SIDEBARS)[number]["type"];

type SidebarEvent = "cast-spell" | "roll-skill";

type SidebarMenu = {
    type: SidebarName;
    icon: string;
    label: string;
    disabled: boolean;
    active: boolean;
};

type SidebarSettings = {
    sidebarFontSize: number;
    sidebarHeight: number;
    multiColumns: number;
};

export { PF2eHudSidebar, getSidebars };
export type {
    SidebarContext,
    SidebarEvent,
    SidebarMenu,
    SidebarName,
    SidebarRenderOptions,
    SidebarSettings,
};
