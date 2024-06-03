import {
    R,
    addListener,
    addListenerAll,
    createHTMLFromString,
    htmlClosest,
    htmlQuery,
} from "pf2e-api";
import {
    PF2eHudSidebar,
    SidebarCloseOptions,
    SidebarName,
    SidebarRenderOptions,
    getSidebars,
} from "../sidebar";
import { PF2eHudToken, TokenSettings } from "../token";
import { addDragoverListener } from "../utils";

const ROLLOPTIONS_PLACEMENT = {
    actions: "actions",
    spells: "spellcasting",
    items: "inventory",
    skills: "proficiencies",
    extras: undefined,
} as const;

const sidebarCloseOptionToSetting = {
    sendToChat: "closeOnSendToChat",
    castSpell: "closeOnSpell",
} as const;

abstract class PF2eHudTokenSidebar extends PF2eHudSidebar<TokenSettings, PF2eHudToken> {
    #sidebarsElement!: HTMLElement;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-token-sidebar",
    };

    get partials() {
        return ["rolloptions", "item_image"];
    }

    get fontSize() {
        return this.setting("sidebarFontSize");
    }

    get hudKey(): "token" {
        return "token";
    }

    get parentMainElement() {
        return this.parentHud.mainElement!;
    }

    get itemElements() {
        return this.innerElement.querySelectorAll(".item");
    }

    /**
     * total height if there was overflow allowed
     */
    get virtualHeight() {
        const scrollElement = this.scrollElement;
        return (
            (this.element?.offsetHeight ?? 0) +
            ((scrollElement?.scrollHeight ?? 0) - (scrollElement?.offsetHeight ?? 0))
        );
    }

    async _renderHTML(context: any, options: SidebarRenderOptions): Promise<HTMLElement> {
        const innerElement = await super._renderHTML(context, options);

        const placement = ROLLOPTIONS_PLACEMENT[this.sidebarKey];
        if (placement) {
            const toggles = R.pipe(
                R.values(this.actor.synthetics.toggles).flatMap((domain) => Object.values(domain)),
                R.filter((option) => option.placement === placement)
            );

            const template = await this.renderPartial("rolloptions", { toggles });
            const element = createHTMLFromString(template);

            innerElement.prepend(element);
        }

        return innerElement;
    }

    _insertElement(element: HTMLElement) {
        super._insertElement(element);
        document.body.append(element);
    }

    async _onFirstRender(context: ApplicationRenderContext, options: SidebarRenderOptions) {
        const sidebarsTemplate = await this.renderPartial("sidebars", {
            sidebars: getSidebars(this.actor, this.sidebarKey),
        });
        this.#sidebarsElement = createHTMLFromString(sidebarsTemplate);
        this.#sidebarsElement.classList.add("sidebars");
        this.#sidebarsElement.dataset.tooltipDirection = "DOWN";

        this.element?.prepend(this.#sidebarsElement);
        this.#activateSidebarsListeners(this.#sidebarsElement);
    }

    _onRender(context: ApplicationRenderContext, options: SidebarRenderOptions) {
        if (this.setting("multiColumns")) {
            const winHeight = window.innerHeight;
            const maxHeight = this.setting("sidebarHeight");
            const currentHeight = this.virtualHeight;
            const computedMaxHeight = winHeight * (maxHeight / 100);
            const columns = Math.clamp(Math.ceil(currentHeight / computedMaxHeight), 1, 3);

            this.innerElement.style.setProperty("--nb-columns", String(columns));
        }

        for (const itemElement of this.itemElements) {
            const nameElement = itemElement.querySelector<HTMLElement>(".name")!;

            if (nameElement && nameElement.scrollWidth > nameElement.offsetWidth) {
                nameElement.dataset.tooltip = nameElement.innerHTML.trim();
            }
        }
    }

    _updatePosition(position = {} as ApplicationPosition) {
        const element = this.element;
        if (!element) return position;

        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const maxHeight = this.setting("sidebarHeight");
        const bounds = element.getBoundingClientRect();
        const parentBounds = this.parentMainElement.getBoundingClientRect();

        const center = {
            x: parentBounds.x + parentBounds.width / 2,
            y: parentBounds.y + parentBounds.height / 2,
        };

        position.left = center.x - bounds.width / 2;
        position.top = center.y - bounds.height / 2;

        if (position.left + bounds.width > winWidth) position.left = winWidth - bounds.width;
        if (position.left < 0) position.left = 0;
        if (position.top + bounds.height > winHeight) position.top = winHeight - bounds.height;
        if (position.top < 0) position.top = 0;

        element.style.setProperty("left", `${position.left}px`);
        element.style.setProperty("top", `${position.top}px`);

        if (maxHeight) {
            element.style.setProperty("--max-height", `${maxHeight}vh`);
        } else {
            element.style.removeProperty("--max-height");
        }

        if (center.x <= 0 || center.x >= winWidth || center.y <= 0 || center.y >= winHeight) {
            element.style.setProperty("display", "none");
            return position;
        } else {
            element.style.removeProperty("display");
        }

        return position;
    }

    _onPosition(position: ApplicationPosition) {
        requestAnimationFrame(() => this._updatePosition());
    }

    _activateListener(html: HTMLElement) {
        addDragoverListener(this.element!);

        addListener(html, "[data-option-toggles]", "change", (event) => {
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

    closeIf(option: SidebarCloseOptions) {
        const setting = this.setting(sidebarCloseOptionToSetting[option]);
        if (setting === "all") {
            this.parentHud.close();
        } else if (setting === "sidebar") {
            return this.parentHud.toggleSidebar(null);
        }
    }

    #activateSidebarsListeners(html: HTMLElement) {
        addListenerAll(html, "[data-action='open-sidebar']", (event, el) => {
            const { sidebar } = el.dataset as { sidebar: SidebarName };
            this.parentHud.toggleSidebar(sidebar);
        });
    }
}

export { PF2eHudTokenSidebar };
