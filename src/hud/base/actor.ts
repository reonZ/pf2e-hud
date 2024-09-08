import { BaseRenderOptions, BaseSettings, PF2eHudBase } from "./base";

abstract class PF2eHudBaseActor<
    TSettings extends BaseActorSettings = BaseActorSettings,
    TActor extends ActorPF2e = ActorPF2e,
    TUserSettings extends Record<string, any> = Record<string, any>,
    TRenderOptions extends BaseActorRenderOptions = BaseActorRenderOptions
> extends PF2eHudBase<TSettings, TUserSettings, TRenderOptions> {
    abstract get actor(): TActor | null;
    abstract get allowedActorTypes(): (ActorType | "creature")[];

    async _prepareContext(options: TRenderOptions): Promise<BaseActorContext<TActor>> {
        if (this.actor !== null) {
            return { hasActor: true, actor: this.actor };
        } else {
            return { hasActor: false };
        }
    }

    _actorCleanup() {
        delete this.actor?.apps[this.id];
        delete this.actor?.token?.baseActor.apps[this.id];
    }

    _onClose(options: ApplicationClosingOptions) {
        this._actorCleanup();
        super._onClose(options);
    }

    isValidActor(actor: Maybe<ActorPF2e>): actor is ActorPF2e {
        const types = this.allowedActorTypes;
        return actor instanceof Actor && (types.length === 0 || actor.isOfType(...types));
    }

    isCurrentActor(actor: Maybe<ActorPF2e>): actor is TActor {
        return !!actor && this.actor?.uuid === actor.uuid;
    }
}

type BaseActorSettings = BaseSettings;

type BaseActorContext<TActor extends ActorPF2e> =
    | { actor: TActor; hasActor: true }
    | { hasActor: false };

type BaseActorRenderOptions = BaseRenderOptions;

export { PF2eHudBaseActor };
export type { BaseActorContext, BaseActorRenderOptions, BaseActorSettings };
