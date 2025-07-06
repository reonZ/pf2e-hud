import {
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    CreaturePF2e,
    htmlQuery,
} from "module-helpers";
import { PersistentPF2eHUD } from ".";

abstract class PersistentPartPF2eHUD extends foundry.applications.api.ApplicationV2 {
    #parent: PersistentPF2eHUD;

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        window: {
            resizable: false,
            minimizable: false,
            frame: false,
            positioned: false,
        },
    };

    constructor(parent: PersistentPF2eHUD, options?: DeepPartial<ApplicationConfiguration>) {
        super(options);
        this.#parent = parent;
    }

    abstract get name(): string;

    get parent(): PersistentPF2eHUD {
        return this.#parent;
    }

    get actor(): CreaturePF2e | null {
        return this.parent.actor;
    }

    get worldActor(): CreaturePF2e | null {
        return this.parent.worldActor;
    }

    get currentPanel(): HTMLElement | null {
        return htmlQuery(this.parent.element, `[data-panel="${this.name}"]`);
    }

    close(options: ApplicationClosingOptions = {}): Promise<this> {
        return super.close({ animate: false });
    }

    abstract _activateListeners(html: HTMLElement): void;

    protected _onRender(context: object, options: ApplicationRenderOptions): void {
        const currentPanel = this.currentPanel;

        if (currentPanel) {
            currentPanel.replaceWith(this.element);
        } else {
            this.parent.element.appendChild(this.element);
        }
    }

    protected _replaceHTML(
        result: string,
        content: HTMLElement,
        options: ApplicationRenderOptions
    ): void {
        content.innerHTML = result;
        content.dataset.panel = this.name;

        this._activateListeners(content);
    }
}

export { PersistentPartPF2eHUD };
