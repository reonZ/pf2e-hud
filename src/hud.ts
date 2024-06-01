import { createHook, getSetting, setSetting, templatePath } from "pf2e-api";

abstract class PF2eHudBase<TSettings extends Record<string, any>> extends foundry.applications.api
    .ApplicationV2 {
    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        window: {
            positioned: true,
            resizable: false,
            minimizable: false,
            frame: false,
        },
    };

    abstract get fontSize(): number;
    abstract get templates(): string[] | ReadonlyArray<string>;
    abstract get hudKey(): string;

    get partials(): string[] | ReadonlyArray<string> {
        return [];
    }

    async _preFirstRender(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<void> {
        await super._preFirstRender(context, options);

        const templates: Set<string> = new Set();

        for (const template of this.templates) {
            const path = templatePath(this.hudKey, template);
            templates.add(path);
        }

        for (const partial of this.partials) {
            const path = templatePath("partials", partial);
            templates.add(path);
        }

        await loadTemplates(Array.from(templates));
    }

    _configureRenderOptions(options: RenderOptionsHUD) {
        super._configureRenderOptions(options);
        options.fontSize = this.fontSize;
    }

    async _prepareContext(options: ApplicationRenderOptions): Promise<BaseContext> {
        return {
            partial: (key: string) => templatePath("partials", key),
        };
    }

    close(options: ApplicationClosingOptions = {}): Promise<ApplicationV2> {
        options.animate = false;
        return super.close(options);
    }

    setting<K extends keyof TSettings & string>(key: K): TSettings[K] {
        return getSetting(`${this.hudKey}.${key}`);
    }

    renderTemplate(
        template: (typeof this)["templates"][number],
        context: ApplicationRenderContext
    ) {
        const path = templatePath(this.hudKey, template);
        return renderTemplate(path, context);
    }

    renderPartial(partial: (typeof this)["partials"][number], data: ApplicationRenderContext) {
        const path = templatePath("partials", partial);
        return renderTemplate(path, data);
    }
}

abstract class PF2eHudBaseMain<
    TSettings extends Record<string, any>
> extends PF2eHudBase<TSettings> {
    abstract get enabled(): boolean;
    abstract get settings(): SettingOptions[];

    get keybinds(): KeybindingActionConfig[] {
        return [];
    }

    abstract _onEnable(enabled?: boolean): void;

    enable = foundry.utils.debounce((enabled?: boolean) => {
        this._onEnable?.(enabled);
    }, 1);

    setSetting<K extends keyof TSettings & string>(key: K, value: TSettings[K]) {
        return setSetting(`${this.hudKey}.${key}`, value);
    }
}

abstract class PF2eHudBaseActor<
    TSettings extends Record<string, any>,
    TActor extends ActorPF2e = ActorPF2e
> extends PF2eHudBaseMain<TSettings> {
    abstract get actor(): TActor | null;
    abstract get useModifiers(): boolean;

    async _prepareContext(options: ApplicationRenderOptions): Promise<BaseActorContext> {
        const parentData = await super._prepareContext(options);
        return {
            ...parentData,
            hasActor: !!this.actor,
        };
    }

    close(options?: ApplicationClosingOptions): Promise<ApplicationV2> {
        delete this.actor?.apps[this.id];
        return super.close(options);
    }

    isCurrentActor(actor: ActorPF2e | null | undefined) {
        return actor && this.actor?.uuid === actor.uuid;
    }
}

abstract class PF2eHudBaseToken<
    TSettings extends BaseTokenHUDSettings,
    TActor extends ActorPF2e = ActorPF2e
> extends PF2eHudBaseActor<TSettings, TActor> {
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

type RenderOptionsHUD<TParts extends string = string> = ApplicationRenderOptions<TParts> & {
    fontSize: number;
};

type BaseContext = {
    partial: (template: string) => string;
};

type BaseActorContext = BaseContext & {
    hasActor: boolean;
};

type BaseTokenHUDSettings = {
    modifiers: boolean;
};

export { PF2eHudBase, PF2eHudBaseActor, PF2eHudBaseMain, PF2eHudBaseToken };
export type { BaseActorContext, BaseContext, BaseTokenHUDSettings, RenderOptionsHUD };
