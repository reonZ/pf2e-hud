import {
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    htmlQuery,
    render,
} from "module-helpers";
import { BasePF2eHUD } from "./base";

abstract class FoundrySidebarPF2eHUD<
    TSettings extends { enabled: boolean }
> extends BasePF2eHUD<TSettings> {
    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-dice",
    };

    abstract get beforeElement(): HTMLElement | null;

    get chatElement(): HTMLElement | null {
        return ui.chat.element;
    }

    get chatMessageElement(): HTMLElement | null {
        return htmlQuery(this.chatElement, "#chat-message");
    }

    ready(isGM: boolean): void {
        const hookId = Hooks.on("renderChatInput", () => {
            if (this.chatMessageElement) {
                Hooks.off("renderChatInput", hookId);
                this._configurate();
            }
        });
    }

    abstract _activateListeners(html: HTMLElement): void;

    protected _renderHTML(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<unknown> {
        return render(this.key, context);
    }

    protected _replaceHTML(
        result: string,
        content: HTMLElement,
        options: ApplicationRenderOptions
    ): void {
        content.innerHTML = result;
        content.dataset.tooltipClass = "pf2e-hud-element";
        content.dataset.tooltipDirection = "DOWN";

        this._activateListeners(content);
    }

    protected _onClose(options: ApplicationClosingOptions): void {
        document.getElementById("sidebar-content")?.classList.remove(this.id);
    }

    protected _insertElement(element: HTMLElement): HTMLElement {
        this.beforeElement?.before(element);
        document.getElementById("sidebar-content")?.classList.add(this.id);
        return element;
    }
}

export { FoundrySidebarPF2eHUD };
