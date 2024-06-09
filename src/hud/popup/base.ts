import { addDragoverListener } from "../shared/advanced";

abstract class PF2eHudPopup<TConfig extends PopupConfig> extends foundry.applications.api
    .ApplicationV2 {
    #config: TConfig;

    constructor(config: TConfig, options?: PartialApplicationConfiguration) {
        super(options);
        this.#config = config;
    }

    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        id: "pf2e-hud-popup-{id}",
        window: {
            positioned: true,
            resizable: false,
            minimizable: true,
            frame: true,
        },
    };

    get config() {
        return this.#config;
    }

    get actor() {
        return this.config.actor;
    }

    get event() {
        return this.config.event;
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement, options: ApplicationRenderOptions) {
        content.replaceChildren(result);
        this.#activateListeners(result);
        this._activateListeners(result);
    }

    abstract _activateListeners(html: HTMLElement): void;

    close(options: ApplicationClosingOptions = {}): Promise<this> {
        options.animate = false;
        return super.close(options);
    }

    #activateListeners(html: HTMLElement) {
        // InlineRollLinks.listen(description, item);
        addDragoverListener(this.element);
    }
}

type PopupConfig = {
    actor: ActorPF2e;
    event: MouseEvent;
};

export { PF2eHudPopup };
export type { PopupConfig };
