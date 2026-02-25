import {
    activateHooksAndWrappers,
    ActorPF2e,
    assignStyle,
    createToggleHook,
    disableHooksAndWrappers,
    TokenDocumentPF2e,
    TokenPF2e,
} from "foundry-helpers";
import { BaseActorPF2eHUD } from ".";

abstract class BaseTokenPF2eHUD<
    TSettings extends Record<string, any>,
    TActor extends ActorPF2e,
> extends BaseActorPF2eHUD<TSettings, TActor> {
    #token: TokenPF2e | null = null;

    #hooks = [
        createToggleHook("deleteToken", this.#onDeleteToken.bind(this)),
        createToggleHook("updateToken", this.#onUpdateToken.bind(this)),
        createToggleHook(["renderTokenHUD", "tearDownTokenLayer"], () => this.close()),
    ];

    static DEFAULT_OPTIONS: DeepPartial<fa.ApplicationConfiguration> = {
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

    isValidToken(token: Maybe<TokenPF2e>): token is TokenPF2e & { actor: ActorPF2e } {
        return token instanceof foundry.canvas.placeables.Token && this.isValidActor(token.actor);
    }

    setToken(token: TokenPF2e | null) {
        if (token && !this.isValidToken(token)) {
            token = null;
        }

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

    protected abstract _onSetToken(token: TokenPF2e): void;

    protected _onClose(options: fa.ApplicationClosingOptions) {
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

    protected _updatePosition(position: fa.ApplicationPosition) {
        const token = this.token;
        if (!token || !canvas.ready) return position;

        super._updatePosition(position);

        const gridSize = canvas.grid.size;
        const scale = token.worldTransform.a;
        const uiScale = canvas.dimensions.uiScale;
        const transform = canvas.stage.worldTransform;
        const bounds = token.bounds;

        const worldLeft = transform.a * bounds.x + transform.c * bounds.y + transform.tx;
        const worldTop = transform.b * bounds.x + transform.d * bounds.y + transform.ty;
        const worldWidth = bounds.width * scale;
        const worldHeight = bounds.height * scale;

        const width = (worldWidth / uiScale) * (gridSize / 100);
        const height = (worldHeight / uiScale) * (gridSize / 100);
        const left = worldLeft + (worldWidth - width) / 2;
        const top = worldTop + (worldHeight - height) / 2;

        assignStyle(this.element, {
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
        });

        Object.assign(position, { left, top, width, height });

        return position;
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
