import { ActorPF2e } from "foundry-helpers";
import { BasePF2eHUD } from ".";

abstract class BaseActorPF2eHUD<
    TSettings extends Record<string, any> = Record<string, any>,
    TActor extends ActorPF2e = ActorPF2e,
> extends BasePF2eHUD<TSettings> {
    abstract get actor(): TActor | null;

    isValidActor(actor: any): actor is ActorPF2e {
        return actor instanceof Actor;
    }

    isCurrentActor(actor: any): actor is TActor {
        return !!actor && this.actor?.uuid === actor.uuid;
    }

    protected _onClose(_options: fa.ApplicationClosingOptions) {
        this._cleanupActor();
    }

    protected _cleanupActor() {
        const actor = this.actor;

        delete actor?.apps[this.id];
        delete actor?.token?.baseActor?.apps[this.id];
    }
}

export { BaseActorPF2eHUD };
