import {
    ActorPF2e,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    createHook,
    TokenDocumentPF2e,
    TokenPF2e,
} from "module-helpers";
import {
    BaseActorContext,
    BaseActorRenderOptions,
    BaseActorSettings,
    PF2eHudBaseActor,
} from "./actor";

abstract class PF2eHudBaseToken<
    TSettings extends BaseTokenSettings = BaseTokenSettings,
    TActor extends ActorPF2e = ActorPF2e,
    TRenderOptions extends BaseTokenRenderOptions = BaseTokenRenderOptions
> extends PF2eHudBaseActor<TSettings, TActor, any, TRenderOptions> {
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteToken.bind(this));
    #updateTokenHook = createHook("updateToken", this.#onUpdateToken.bind(this));
    #tearDownHook = createHook("tearDownTokenLayer", () => {
        this.close();
    });

    #token: TokenPF2e | null = null;

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        window: {
            positioned: true,
        },
    };

    get token() {
        return this.#token;
    }

    get actor(): TActor | null {
        return (this.token?.actor as TActor) ?? null;
    }

    abstract _onSetToken(token: TokenPF2e | null): void;

    _onEnable(enabled = this.enabled) {
        this.#deleteTokenHook.toggle(enabled);
        this.#updateTokenHook.toggle(enabled);
        this.#tearDownHook.toggle(enabled);
    }

    _tokenCleanup() {
        this._actorCleanup();
        this.#token = null;
    }

    _onClose(options: ApplicationClosingOptions) {
        this._tokenCleanup();
        super._onClose(options);
    }

    async render(
        options: boolean | DeepPartial<TRenderOptions> = {},
        _options: DeepPartial<TRenderOptions> = {}
    ) {
        if (!this.actor) return this;

        if (typeof options === "boolean") {
            options = Object.assign(_options, { force: options });
        }

        options.position = {} as any;

        return super.render(options);
    }

    isValidToken(token: Maybe<TokenPF2e>): token is TokenPF2e & { actor: TActor } {
        return token instanceof Token && this.isValidActor(token.actor);
    }

    setToken(token: TokenPF2e | null) {
        if (token && !this.isValidToken(token)) return;

        this._tokenCleanup();

        if (token) {
            token.actor.apps[this.id] = this;
        }

        this.#token = token;

        if (token) this._onSetToken(token);
        else this.close();
    }

    getTokenPosition() {
        const token = this.token;
        if (!token?.actor) return;

        const scale = token.worldTransform.a;
        const tokenCoords = canvas.clientCoordinatesFromCanvas(token);

        return {
            x: tokenCoords.x,
            y: tokenCoords.y,
            width: token.hitArea.width * scale,
            height: token.hitArea.height * scale,
            get left() {
                return this.x;
            },
            get right() {
                return this.x + this.width;
            },
            get top() {
                return this.y;
            },
            get bottom() {
                return this.y + this.height;
            },
        };
    }

    #onDeleteToken(tokenDocument: TokenDocumentPF2e) {
        if (tokenDocument === this.token?.document) {
            this.close();
        }
    }

    #onUpdateToken(
        tokenDocument: TokenDocumentPF2e,
        changed: Partial<foundry.documents.TokenSource>
    ) {
        if (tokenDocument.object === this.token && ("x" in changed || "y" in changed)) {
            this.close();
        }
    }
}

type BaseTokenContext<TActor extends ActorPF2e = ActorPF2e> = BaseActorContext<TActor>;

type BaseTokenSettings = BaseActorSettings;

type BaseTokenRenderOptions = BaseActorRenderOptions;

export { PF2eHudBaseToken };
export type { BaseTokenContext, BaseTokenRenderOptions, BaseTokenSettings };
