import { BaseActorPF2eHUD } from ".";
import {
    activateHooksAndWrappers,
    ActorPF2e,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    createHook,
    disableHooksAndWrappers,
    TokenDocumentPF2e,
    TokenPF2e,
} from "module-helpers";

abstract class BaseTokenPF2eHUD<
    TSettings extends Record<string, any>,
    TActor extends ActorPF2e
> extends BaseActorPF2eHUD<TSettings, TActor> {
    #token: TokenPF2e | null = null;

    #hooks = [
        createHook("deleteToken", this.#onDeleteToken.bind(this)),
        createHook("updateToken", this.#onUpdateToken.bind(this)),
        createHook(["renderTokenHUD", "tearDownTokenLayer"], () => this.close()),
    ];

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

    isValidToken(token: Maybe<TokenPF2e>): token is TokenPF2e & { actor: TActor } {
        return token instanceof foundry.canvas.placeables.Token && this.isValidActor(token.actor);
    }

    setToken(token: TokenPF2e | null) {
        if (token && !this.isValidToken(token)) return;

        this._cleanupToken();

        if (token) {
            token.actor.apps[this.id] = this;
        }

        this.#token = token;

        if (token) {
            this._onSetToken(token);
        } else {
            this.close();
        }
    }

    protected abstract _onSetToken(token: TokenPF2e | null): void;

    protected _onClose(options: ApplicationClosingOptions) {
        this._cleanupToken();
    }

    protected _cleanupToken() {
        this._cleanupActor();
        this.#token = null;
    }

    protected _toggleTokenHooks(enabled: boolean) {
        if (enabled) {
            activateHooksAndWrappers(this.#hooks);
        } else {
            disableHooksAndWrappers(this.#hooks);
        }
    }

    #onDeleteToken(token: TokenDocumentPF2e) {
        if (token === this.token?.document) {
            this.close();
        }
    }

    #onUpdateToken(token: TokenDocumentPF2e, changed: Partial<foundry.documents.TokenSource>) {
        if (token.object === this.token && ("x" in changed || "y" in changed)) {
            this.close();
        }
    }
}

export { BaseTokenPF2eHUD };
