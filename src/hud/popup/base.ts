import { ActorPF2e } from "foundry-helpers";
import { makeFadeable } from "hud";

abstract class BaseHudPopup<TActor extends ActorPF2e = ActorPF2e> extends foundry.applications.api.ApplicationV2 {
    #actor: TActor;

    static apps: Set<BaseHudPopup> = new Set();

    static DEFAULT_OPTIONS: DeepPartial<fa.ApplicationConfiguration> = {
        id: "pf2e-hud-popup-{id}",
        window: {
            positioned: true,
            resizable: false,
            minimizable: true,
            frame: true,
        },
        classes: ["pf2e-hud-popup"],
    };

    constructor(actor: TActor, options?: DeepPartial<fa.ApplicationConfiguration>) {
        super(options);

        this.#actor = actor;
        actor.apps[this.id] = this;

        BaseHudPopup.apps.add(this);
    }

    get actor(): TActor {
        return this.#actor;
    }

    close(options: fa.ApplicationClosingOptions = {}): Promise<this> {
        options.animate = false;
        return super.close(options);
    }

    protected async _onFirstRender(context: object, options: fa.ApplicationRenderOptions) {
        makeFadeable(this);
    }

    _onClose(options?: fa.ApplicationClosingOptions) {
        delete this.actor?.apps[this.id];
        BaseHudPopup.apps.delete(this);
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement, options: fa.ApplicationRenderOptions) {
        content.replaceChildren(result);
    }
}

export { BaseHudPopup };
