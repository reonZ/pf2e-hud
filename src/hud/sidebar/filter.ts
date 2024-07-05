import { addListener, render, templateLocalize } from "foundry-pf2e";
import { PF2eHudSidebar } from "./base";

class PF2eHudFilter extends foundry.applications.api.ApplicationV2 {
    #sidebar: PF2eHudSidebar;

    constructor(sidebar: PF2eHudSidebar, options?: PartialApplicationConfiguration) {
        super(options);

        this.#sidebar = sidebar;
        sidebar.addEventListener("close", this.#onSidebarClose, { once: true });
    }

    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        id: "pf2e-hud-sidebar-filter",
        window: {
            positioned: false,
            resizable: false,
            minimizable: false,
            frame: false,
        },
    };

    get sidebar() {
        return this.#sidebar;
    }

    _renderHTML(context: never, options: ApplicationRenderOptions): Promise<string> {
        return render("sidebars/filter", {
            i18n: templateLocalize("sidebars.filter"),
        });
    }

    _replaceHTML(result: string, content: HTMLElement, options: ApplicationRenderOptions): void {
        content.innerHTML = result;
        this.#activateListeners(content);
    }

    _onRender(context: never, options: ApplicationRenderOptions): void {
        this.element.querySelector<HTMLInputElement>("input")?.focus();
    }

    _onClose(options: ApplicationClosingOptions): void {
        this.sidebar.removeEventListener("close", this.#onSidebarClose);
    }

    async close(options: ApplicationClosingOptions = {}): Promise<this> {
        options.animate = false;
        return super.close(options);
    }

    #onSidebarClose = () => this.close();

    #activateListeners(html: HTMLElement) {
        addListener(html, "input", "keyup", (event, el) => {
            if (event.key === "Enter") {
                this.close();
            } else if (event.key === "Escape") {
                this.sidebar.filter = "";
                this.close();
            }
        });

        addListener(html, "input", "blur", () => {
            this.close();
        });

        const filterDebounce = foundry.utils.debounce((value: string) => {
            this.sidebar.filter = value;
        }, 500);

        addListener(html, "input", "input", (event, el) => {
            filterDebounce(el.value);
        });
    }
}

export { PF2eHudFilter };
