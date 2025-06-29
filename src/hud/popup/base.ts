import { makeFadeable } from "hud";
import {
    ActorPF2e,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderOptions,
} from "module-helpers";

abstract class BaseHudPopup<TActor extends ActorPF2e = ActorPF2e> extends foundry.applications.api
    .ApplicationV2 {
    #actor: TActor;

    static apps: Set<BaseHudPopup> = new Set();

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-popup-{id}",
        window: {
            positioned: true,
            resizable: false,
            minimizable: true,
            frame: true,
        },
        classes: ["pf2e-hud-popup"],
    };

    constructor(actor: TActor, options?: DeepPartial<ApplicationConfiguration>) {
        super(options);

        this.#actor = actor;
        actor.apps[this.id] = this;

        BaseHudPopup.apps.add(this);
    }

    get actor(): TActor {
        return this.#actor;
    }

    close(options: ApplicationClosingOptions = {}): Promise<this> {
        options.animate = false;
        return super.close(options);
    }

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        makeFadeable(this);
    }

    _onClose(options?: ApplicationClosingOptions) {
        delete this.actor?.apps[this.id];
        BaseHudPopup.apps.delete(this);
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement, options: ApplicationRenderOptions) {
        content.replaceChildren(result);
    }
}

export { BaseHudPopup };
