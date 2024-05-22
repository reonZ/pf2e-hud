import { createHook, getSetting, signedInteger, templatePath } from "pf2e-api";
import { BaseActorData, HealthData, getDefaultData, getHealth } from "./shared";

abstract class BaseHUD<TSettings extends Record<string, any>> extends foundry.applications.api
    .ApplicationV2 {
    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        window: {
            positioned: true,
            resizable: false,
            minimizable: false,
            frame: false,
        },
    };

    abstract get partials(): string[] | ReadonlyArray<string>;
    abstract get templates(): string[] | ReadonlyArray<string>;
    abstract get key(): string;
    abstract get enabled(): boolean;
    abstract get settings(): SettingOptions[];

    abstract _onEnable(enabled?: boolean): void;

    async _preFirstRender(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<void> {
        await super._preFirstRender(context, options);

        const templates: Set<string> = new Set();

        for (const template of this.templates) {
            const path = templatePath(this.key, template);
            templates.add(path);
        }

        for (const partial of this.partials) {
            const path = templatePath("partials", partial);
            templates.add(path);
        }

        await loadTemplates(Array.from(templates));
    }

    async _prepareContext(options: ApplicationRenderOptions): Promise<BaseContext> {
        return {
            partial: (key: string) => templatePath("partials", key),
        };
    }

    enable = foundry.utils.debounce((enabled?: boolean) => {
        this._onEnable?.(enabled);
    }, 1);

    close(options: ApplicationClosingOptions = {}): Promise<ApplicationV2> {
        options.animate = false;
        return super.close(options);
    }

    setting<K extends keyof TSettings & string>(key: K): TSettings[K] {
        return getSetting(`${this.key}.${key}`);
    }

    renderTemplate(
        template: (typeof this)["templates"][number],
        context: ApplicationRenderContext
    ) {
        const path = templatePath(this.key, template);
        return renderTemplate(path, context);
    }
}

abstract class BaseActorHUD<
    TSettings extends Record<string, any>,
    TActor extends ActorPF2e = ActorPF2e
> extends BaseHUD<TSettings> {
    abstract get actor(): TActor | null;
    abstract get useModifiers(): boolean;

    async _prepareContext(options: ApplicationRenderOptions): Promise<BaseActorContext> {
        const parentData = await super._prepareContext(options);
        return {
            ...parentData,
            hasActor: !!this.actor,
        };
    }

    isCurrentActor(actor: ActorPF2e | null | undefined) {
        return actor && this.actor?.uuid === actor.uuid;
    }
}

abstract class BaseTokenHUD<
    TSettings extends BaseTokenHUDSettings,
    TActor extends ActorPF2e = ActorPF2e
> extends BaseActorHUD<TSettings, TActor> {
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteToken.bind(this));
    #updateTokenHook = createHook("updateToken", this.#onUpdateToken.bind(this));
    #tearDownHook = createHook("tearDownTokenLayer", () => this.close());

    #token: TokenPF2e<TActor> | null = null;

    get token() {
        return this.#token;
    }

    get actor() {
        return this.token?.actor ?? null;
    }

    abstract _onSetToken(token: TokenPF2e<TActor> | null): void;

    _onEnable(enabled = this.enabled) {
        this.#deleteTokenHook.toggle(enabled);
        this.#updateTokenHook.toggle(enabled);
        this.#tearDownHook.toggle(enabled);
    }

    async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<BaseTokenContext | BaseActorContext> {
        const parentData = await super._prepareContext(options);

        const actor = this.actor;
        if (!actor) return parentData;

        const health = getHealth(actor);
        if (!health) return parentData;

        const isArmy = actor.isOfType("army");
        const defaultData = getDefaultData(actor, this.useModifiers);
        const token = this.token!;
        const { isOwner, isObserver } = defaultData;
        const name =
            isOwner || !game.pf2e.settings.tokens.nameVisibility || isObserver
                ? token.document.name
                : undefined;

        const data: BaseTokenContext = {
            ...parentData,
            ...defaultData,
            health,
            name,
            ac: isArmy ? actor.system.ac.value : actor.attributes.ac?.value,
            scouting: isArmy ? signedInteger(actor.scouting.mod) : undefined,
            hardness: actor.isOfType("vehicle", "hazard") ? actor.attributes.hardness : undefined,
        };

        return data;
    }

    async render(
        options: boolean | ApplicationRenderOptions = {},
        _options: ApplicationRenderOptions = {}
    ): Promise<ApplicationV2> {
        if (!this.actor) return this;

        if (typeof options === "boolean") options = Object.assign(_options, { force: options });
        options.position = {} as ApplicationPosition;

        return super.render(options);
    }

    close(options?: ApplicationClosingOptions): Promise<ApplicationV2> {
        this.setToken(false);
        return super.close(options);
    }

    setToken(token: TokenPF2e<TActor> | null | false) {
        const skipClose = token === false;

        token ||= null;
        if (token === this.token) return;

        delete this.actor?.apps[this.id];

        const actor = token?.actor;
        if (actor) {
            actor.apps[this.id] = this;
        }

        this.#token = token;

        if (token) this._onSetToken(token);
        else if (!skipClose) this.close();
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

    moveOutOfScreen(position: ApplicationPosition) {
        const element = this.element;
        if (!element) return position;

        position.left = -1000;
        position.top = -1000;

        element.style.left = `${-1000}px`;
        element.style.top = `${-1000}px`;

        return position;
    }

    #onDeleteToken(tokenDocument: TokenDocumentPF2e) {
        if (tokenDocument === this.token?.document) {
            this.close();
        }
    }

    #onUpdateToken(tokenDocument: TokenDocumentPF2e, changed: Partial<TokenDocumentSource>) {
        if (tokenDocument.object === this.token && ("x" in changed || "y" in changed)) {
            this.close();
        }
    }
}

type BaseContext = {
    partial: (template: string) => string;
};

type BaseActorContext = BaseContext & {
    hasActor: boolean;
};

type BaseTokenContext = BaseActorContext &
    BaseActorData & {
        health: HealthData;
        name: string | undefined;
        ac: number | undefined;
        scouting: string | undefined;
        hardness: number | undefined;
    };

type BaseTokenHUDSettings = {
    modifiers: boolean;
};

export { BaseActorHUD, BaseHUD, BaseTokenHUD };
export type { BaseActorContext, BaseContext, BaseTokenContext, BaseTokenHUDSettings };
