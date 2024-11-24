import {
    ActorPF2e,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    getSetting,
} from "module-helpers";
import { addDragoverListener } from "../shared/advanced";

abstract class PF2eHudPopup<TConfig extends PopupConfig = PopupConfig> extends foundry.applications
    .api.ApplicationV2 {
    #config: TConfig;

    static apps: Set<PF2eHudPopup> = new Set();

    static getSetting<K extends keyof PopupSettings>(key: K): PopupSettings[K] {
        return getSetting(`popup.${key}`);
    }

    constructor(config: TConfig, options?: DeepPartial<ApplicationConfiguration>) {
        super(options);

        this.#config = config;
        config.actor.apps[this.id] = this;

        PF2eHudPopup.apps.add(this);
    }

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-popup-{id}",
        window: {
            positioned: true,
            resizable: true,
            minimizable: true,
            frame: true,
        },
        classes: ["pf2e-hud-popup", "pf2e-hud"],
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

    _onClose(options?: ApplicationClosingOptions) {
        delete this.actor?.apps[this.id];
        PF2eHudPopup.apps.delete(this);
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement, options: ApplicationRenderOptions) {
        content.replaceChildren(result);
        content.style.setProperty("--font-size", `${PF2eHudPopup.getSetting("fontSize")}px`);

        this.#activateListeners(result);
        this._activateListeners?.(result);
    }

    _onFirstRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        if (!PF2eHudPopup.getSetting("onCursor")) return;

        const event = this.event;
        const bounds = this.element.getBoundingClientRect();

        options.position ??= {};
        options.position.left = event.clientX - bounds.width / 2;
        options.position.top = event.clientY - bounds.height / 2 - 50;
    }

    close(options: ApplicationClosingOptions = {}): Promise<this> {
        options.animate = false;
        return super.close(options);
    }

    #activateListeners(html: HTMLElement) {
        addDragoverListener(this.element);
    }
}

interface PF2eHudPopup<TConfig extends PopupConfig> extends foundry.applications.api.ApplicationV2 {
    _activateListeners?(html: HTMLElement): void;
}

type PopupConfig = {
    actor: ActorPF2e;
    event: MouseEvent;
};

type PopupSettings = {
    onCursor: boolean;
    fontSize: number;
    closeOnSendToChat: boolean;
};

export { PF2eHudPopup };
export type { PopupConfig };
