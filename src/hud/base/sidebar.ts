import { ApplicationPosition, assignStyle } from "module-helpers";
import { BasePF2eHUD } from ".";

abstract class FoundrySidebarPF2eHUD<
    TSettings extends Record<string, any>
> extends BasePF2eHUD<TSettings> {
    ready(isGM: boolean): void {
        if (ui.chat.rendered) {
            this.configurate();
        } else {
            Hooks.once("renderChatLog", () => {
                this.configurate();
            });
        }
    }

    protected _insertElement(element: HTMLElement): HTMLElement {
        document.getElementById("sidebar-content")?.classList.add(this.id);
        return element;
    }

    protected _updatePosition(position: ApplicationPosition): ApplicationPosition {
        assignStyle(this.element, {
            height: "",
            width: "100%",
        });

        return position;
    }
}

export { FoundrySidebarPF2eHUD };
