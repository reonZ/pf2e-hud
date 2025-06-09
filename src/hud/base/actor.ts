import { ActorPF2e, ApplicationClosingOptions } from "module-helpers";
import { BasePF2eHUD } from ".";

abstract class BaseActorPF2eHUD<
    TSettings extends Record<string, any>,
    TActor extends ActorPF2e
> extends BasePF2eHUD<TSettings> {
    abstract get actor(): TActor | null;

    isValidActor(actor: Maybe<ActorPF2e>): actor is ActorPF2e {
        return actor instanceof Actor;
    }

    isCurrentActor(actor: Maybe<ActorPF2e>): actor is TActor {
        return !!actor && this.actor?.uuid === actor.uuid;
    }

    protected _onClose(options: ApplicationClosingOptions) {
        this._cleanupActor();
    }

    protected _cleanupActor() {
        delete this.actor?.apps[this.id];
        delete this.actor?.token?.baseActor?.apps[this.id];
    }
}

export { BaseActorPF2eHUD };
