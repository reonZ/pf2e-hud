import {
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    render,
} from "module-helpers";
import { BasePF2eHUD } from ".";

abstract class FoundrySidebarPF2eHUD<
    TSettings extends SidebarSettings
> extends BasePF2eHUD<TSettings> {
    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        window: {
            positioned: false,
        },
    };

    abstract get beforeElement(): string;

    ready(isGM: boolean): void {
        if (ui.chat.rendered) {
            this._configurate();
        } else {
            Hooks.once("renderChatLog", () => {
                this._configurate();
            });
        }
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
        this._activateListeners(content);
    }

    protected _insertElement(element: HTMLElement): HTMLElement {
        document.getElementById(this.beforeElement)?.before(element);
        document.getElementById("sidebar-content")?.classList.add(this.id);
        return element;
    }
}

type SidebarSettings = {
    enabled: boolean;
};

export { FoundrySidebarPF2eHUD };
export type { SidebarSettings };
