import { hud } from "main";
import {
    ActorInstances,
    ActorPF2e,
    ActorSheetPF2e,
    ActorType,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationPosition,
    ApplicationRenderOptions,
    createHook,
    createToggleableEvent,
    createToggleableWrapper,
    LootPF2e,
    PartyPF2e,
    render,
    settingPath,
    signedInteger,
    TokenDocumentPF2e,
    TokenPF2e,
} from "module-helpers";
import {
    AdvancedHudContext,
    BaseTokenPF2eHUD,
    HUDSettingsList,
    IAdvancedPF2eHUD,
    makeAdvancedHUD,
    makeFadeable,
    SidebarCoords,
    SidebarMenu,
} from ".";

const TOKEN_MODE = ["exploded", "left", "right"] as const;

class TokenPF2eHUD
    extends makeAdvancedHUD(BaseTokenPF2eHUD<TokenSettings, TokenHudActor>)
    implements IAdvancedPF2eHUD
{
    #canvasPanHook = createHook("canvasPan", this.#onCanvasPan.bind(this));
    #canvasTearDownHook = createHook("canvasTearDown", () => this.setToken(null));
    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));

    #mouseDownEvent = createToggleableEvent("mousedown", "#board", this.#onMouseDown.bind(this));

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

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-token",
    };

    get key(): "token" {
        return "token";
    }

    get settingsSchema(): HUDSettingsList<TokenSettings> {
        return [
            {
                key: "enabled",
                default: true,
                hint: settingPath("enabled.hint"),
                name: settingPath("enabled.name"),
                onChange: () => {
                    this.configurate();
                },
                scope: "user",
                type: Boolean,
            },
            {
                choices: TOKEN_MODE,
                default: "exploded",
                key: "mode",
                onChange: () => {
                    this.render();
                },
                scope: "user",
                type: String,
            },
        ];
    }

    get sidebarCoords(): SidebarCoords {
        const bounds = this.element.getBoundingClientRect();

        return {
            origin: {
                x: bounds.x + bounds.width / 2,
                y: bounds.y + bounds.height / 2,
            },
            limits: {
                left: 0,
                right: window.innerWidth,
                top: 0,
                bottom: window.innerHeight,
            },
        };
    }

    get sidebarCeption(): boolean {
        return true;
    }

    protected _configurate(): void {
        const enabled =
            this.settings.enabled &&
            (hud.persistent.settings.display === "disabled" ||
                !["select", "combat"].includes(hud.persistent.settings.selection));

        this._toggleTokenHooks(enabled);
        this.#tokenClickLeftWrapper.toggle(enabled);
        this.#tokenDragLeftStartWrapper.toggle(enabled);

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
        );
    }

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        this.#canvasPanHook.activate();
        this.#mouseDownEvent.activate();

        makeFadeable(this);
    }

    protected _onClose(options: ApplicationClosingOptions) {
        this.#canvasPanHook.disable();
        this.#mouseDownEvent.disable();

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
        const context = (await super._prepareContext(options)) as AdvancedHudContext;
        const isArmy = actor.isOfType("army");
        const isHazard = actor.isOfType("hazard");
        const isVehicle = actor.isOfType("vehicle");
        const isFamiliar = actor.isOfType("familiar");
        const sidebars = isHazard || isArmy ? context.sidebars.slice(0, 1) : context.sidebars;

        return {
            ...context,
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

    protected _updatePosition(position: ApplicationPosition): ApplicationPosition {
        super._updatePosition(position);

        this.element.style.setProperty("z-index", String(position.zIndex));

        return position;
    }

    #onCanvasPan() {
        requestAnimationFrame(() => {
            this.setPosition(this.position);
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

        if (event.altKey || event.shiftKey || event.ctrlKey || game.activeTool !== "select") return;

        if (token === this.token) {
            this.close();
            return;
        }

        // we delay this because of the #onMouseDown which is fucking annoying
        requestAnimationFrame(() => {
            this.setToken(token);
        });
    }

    #tokenOnDragLeftStart(
        token: TokenPF2e,
        wrapped: libWrapper.RegisterCallback,
        event: PIXI.FederatedEvent
    ) {
        wrapped(event);
        this.close();
    }

    #onMouseDown(event: MouseEvent) {
        if (event.button !== 0) return;

        const focused = document.activeElement as HTMLElement;

        if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
            focused.blur();
        } else {
            this.close();
        }
    }
}

type TokenHudActor = Exclude<ActorInstances<TokenDocumentPF2e>[ActorType], LootPF2e | PartyPF2e>;

type TokenMode = (typeof TOKEN_MODE)[number];

type TokenSettings = {
    enabled: boolean;
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
