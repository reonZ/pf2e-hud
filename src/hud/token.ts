import { hud } from "main";
import {
    ActorInstances,
    ActorPF2e,
    ActorSheetPF2e,
    ActorType,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    createHook,
    createToggleableWrapper,
    LootPF2e,
    PartyPF2e,
    render,
    signedInteger,
    TokenDocumentPF2e,
    TokenPF2e,
} from "module-helpers";
import {
    AdvancedHudContext,
    BaseTokenPF2eHUD,
    HUDSettingsList,
    makeAdvancedHUD,
    SidebarMenu,
} from ".";

const TOKEN_MODE = ["disabled", "exploded", "left", "right"] as const;

class TokenPF2eHUD extends makeAdvancedHUD(BaseTokenPF2eHUD<TokenSettings, TokenHudActor>) {
    #canvasPanHook = createHook("canvasPan", this.#onCanvasPan.bind(this));
    #canvasTearDownHook = createHook("canvasTearDown", () => this.setToken(null));
    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));

    #tokenClickLeftWrapper = createToggleableWrapper(
        "WRAPPER",
        "CONFIG.Token.objectClass.prototype._onClickLeft",
        this.#tokenOnClickLeft,
        { context: this }
    );

    #tokenDragLeftStartWrapper = createToggleableWrapper(
        "WRAPPER",
        "CONFIG.Token.objectClass.prototype._onDragLeftStart",
        this.#tokenOnDragLeftStart,
        { context: this }
    );

    #tokenLayerClickLeftWrapper = createToggleableWrapper(
        "WRAPPER",
        "foundry.canvas.layers.TokenLayer.prototype._onClickLeft",
        this.#tokenLayerOnClickLeft,
        { context: this }
    );

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-token",
    };

    get key(): "token" {
        return "token";
    }

    get settingsSchema(): HUDSettingsList<TokenSettings> {
        return [
            {
                key: "mode",
                type: String,
                default: "exploded",
                scope: "user",
                choices: TOKEN_MODE,
                onChange: () => {
                    this.configurate();
                },
            },
            {
                key: "close",
                type: Boolean,
                default: false,
                scope: "user",
            },
        ];
    }

    protected _configurate(): void {
        const enabled = this.settings.mode !== "disabled";

        this._toggleTokenHooks(enabled);
        this.#tokenClickLeftWrapper.toggle(enabled);
        this.#tokenDragLeftStartWrapper.toggle(enabled);
        this.#tokenLayerClickLeftWrapper.toggle(enabled);

        this.#canvasTearDownHook.toggle(enabled);
        this.#renderActorSheetHook.toggle(enabled);

        if (enabled) {
            this.render();
        } else {
            this.close();
        }
    }

    init(): void {
        this._configurate();
    }

    isValidActor(actor: Maybe<ActorPF2e>): actor is TokenHudActor {
        return (
            super.isValidActor(actor) &&
            !actor.sheet.rendered &&
            !actor.isOfType("loot", "party") &&
            actor.isOwner &&
            !hud.persistent.isCurrentActor(actor, true)
            // && (hud.persistent.getSetting("autoSet") !== "select" ||
            // !hud.persistent.acceptsActor(actor))
        );
    }

    _onRender(context: ApplicationRenderContext, options: TokenRenderOptions) {
        this.#canvasPanHook.activate();
        // this.sidebar?.render(true);
    }

    _onClose(options: ApplicationClosingOptions) {
        // this.#mainElement = null;
        this.#canvasPanHook.disable();
        return super._onClose(options);
    }

    protected _onSetToken(token: TokenPF2e | null): void {
        this.render(true);
    }

    protected _configureRenderOptions(options: TokenRenderOptions): void {
        super._configureRenderOptions(options);
        options.mode = this.settings.mode;
    }

    async _prepareContext(options: TokenRenderOptions): Promise<TokenContext> {
        const actor = this.actor!;
        const settings = (await super._prepareContext(options)) as AdvancedHudContext;
        const isArmy = actor.isOfType("army");
        const isHazard = actor.isOfType("hazard");
        const isVehicle = actor.isOfType("vehicle");
        const isFamiliar = actor.isOfType("familiar");
        const sidebars = isHazard || isArmy ? settings.sidebars.slice(0, 1) : settings.sidebars;

        return {
            ...settings,
            ac: isArmy ? actor.system.ac.value : actor.attributes.ac?.value,
            hardness: isVehicle || isHazard ? actor.attributes.hardness : undefined,
            isArmy,
            isFamiliar,
            isHazard,
            isVehicle,
            isExploded: options.mode === "exploded",
            scouting: isArmy ? signedInteger(actor.scouting.mod) : undefined,
            sidebars: sidebars.some((sidebar) => !sidebar.disabled) ? sidebars : undefined,
        };
    }

    async _renderHTML(context: TokenContext, options: TokenRenderOptions): Promise<string> {
        return render("actor-hud", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: TokenRenderOptions): void {
        const mode = options.mode;
        content.dataset.mode = mode;
        content.innerHTML = mode === "exploded" ? result : `<div class="wrapper">${result}</div>`;
        super._replaceHTML(result, content, options);
    }

    #onCanvasPan() {
        requestAnimationFrame(() => {
            this._updatePosition();
            // this.sidebar?._updatePosition();
        });
    }

    #onRenderActorSheet(sheet: ActorSheetPF2e<ActorPF2e>) {
        if (this.isCurrentActor(sheet.actor)) {
            this.close();
        }
    }

    #tokenOnClickLeft(
        token: TokenPF2e,
        wrapped: libWrapper.RegisterCallback,
        event: PIXI.FederatedEvent & MouseEvent
    ) {
        wrapped(event);

        if (!event.altKey && !event.shiftKey && !event.ctrlKey && game.activeTool === "select") {
            if (token === this.token) {
                this.close();
            } else {
                this.setToken(token);
            }
        }
    }

    #tokenOnDragLeftStart(
        token: TokenPF2e,
        wrapped: libWrapper.RegisterCallback,
        event: PIXI.FederatedEvent
    ) {
        wrapped(event);
        this.close();
    }

    #tokenLayerOnClickLeft(
        canvas: Canvas,
        wrapped: libWrapper.RegisterCallback,
        event: PIXI.FederatedEvent & MouseEvent
    ) {
        wrapped(event);

        if (this.settings.close) {
            this.close();
            return;
        }

        const focused = document.activeElement as HTMLElement;

        if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
            focused.blur();
            // } else if (this.sidebar) {
            //     this.toggleSidebar(null);
        } else {
            this.close();
        }
    }
}

type TokenHudActor = Exclude<ActorInstances<TokenDocumentPF2e>[ActorType], LootPF2e | PartyPF2e>;

type TokenMode = (typeof TOKEN_MODE)[number];

type TokenSettings = {
    close: boolean;
    mode: TokenMode;
};

type TokenContext = Omit<AdvancedHudContext, "sidebars"> & {
    ac: number | undefined;
    hardness: number | undefined;
    isArmy: boolean;
    isExploded: boolean;
    isFamiliar: boolean;
    isHazard: boolean;
    isVehicle: boolean;
    scouting: string | undefined;
    sidebars: SidebarMenu[] | undefined;
};

type TokenRenderOptions = ApplicationRenderOptions & {
    mode: TokenMode;
};

export { TokenPF2eHUD };
