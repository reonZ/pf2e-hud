import {
    ActorInstances,
    ActorPF2e,
    ActorSheetPF2e,
    ActorType,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationPosition,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    LootPF2e,
    PartyPF2e,
    R,
    TokenDocumentPF2e,
    TokenPF2e,
    createHTMLElement,
    createHook,
    createWrapper,
    htmlQuery,
    render,
} from "module-helpers";
import { hud } from "../main";
import {
    AdvancedHudAnchor,
    AdvancedHudEvent,
    AdvancedHudSettings,
    CLOSE_SETTINGS,
    addSidebarsListeners,
    makeAdvancedHUD,
} from "./base/advanced";
import {
    BaseTokenContext,
    BaseTokenRenderOptions,
    BaseTokenSettings,
    PF2eHudBaseToken,
} from "./base/token";
import {
    StatsAdvanced,
    StatsHeaderExtras,
    getAdvancedStats,
    getStatsHeaderExtras,
} from "./shared/advanced";
import { StatsHeader, getStatsHeader } from "./shared/base";
import { addStatsAdvancedListeners, addStatsHeaderListeners } from "./shared/listeners";
import { SidebarMenu, SidebarName, getSidebars } from "./sidebar/base";

const CLOSE_OPTIONS = ["never", "sidebar", "all"] as const;
const CLOSE_CHOICES = R.mapToObj(CLOSE_OPTIONS, (option) => [
    option,
    `pf2e-hud.token.closeChoices.${option}`,
]);

class PF2eHudToken extends makeAdvancedHUD(
    PF2eHudBaseToken<TokenSettings, TokenHudActor, TokenRenderOptions>
) {
    #tokenClickLeftWrapper = createWrapper(
        "CONFIG.Token.objectClass.prototype._onClickLeft",
        this.#tokenClickLeft,
        { context: this }
    );

    #tokenDragLeftStartWrapper = createWrapper(
        "CONFIG.Token.objectClass.prototype._onDragLeftStart",
        this.#tokenDragLeftStart,
        { context: this }
    );

    #tokenLayerClickLeftWrapper = createWrapper(
        "TokenLayer.prototype._onClickLeft",
        this.#tokenLayerClickLeft,
        { context: this }
    );

    #canvasPanHook = createHook("canvasPan", this.#onCanvasPan.bind(this));
    #canvasTearDownHook = createHook("canvasTearDown", () => this.setToken(null));
    #renderActorSheetHook = createHook("renderActorSheet", this.#onRenderActorSheet.bind(this));
    #renderTokenHudHook = createHook("renderTokenHUD", () => {
        this.close();
    });

    #mainElement: HTMLElement | null = null;

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-token",
    };

    get SETTINGS_ORDER(): (keyof TokenSettings)[] {
        return [
            "enabled",
            "mode",
            "scaleDimensions",
            "fontSize",
            "closeAllOnCLick",
            "closeOnSendToChat",
            "closeOnSpell",
            "closeOnSkill",
            "showAlliance",
        ];
    }

    getSettings() {
        const parentSettings = super.getSettings();
        const enabledSetting = parentSettings.find((setting) => setting.key === "enabled");

        if (enabledSetting) {
            enabledSetting.requiresReload = true;
        }

        return parentSettings.concat([
            {
                key: "mode",
                type: String,
                choices: ["exploded", "left", "right"],
                default: "exploded",
                scope: "client",
                onChange: () => {
                    this.toggleSidebar(null);
                    this.render();
                },
            },
            {
                key: "scaleDimensions",
                type: Boolean,
                default: false,
                scope: "client",
                onChange: () => {
                    this.toggleSidebar(null);
                    this.render();
                },
            },
            {
                key: "closeAllOnCLick",
                type: Boolean,
                default: false,
                scope: "client",
            },
            ...CLOSE_SETTINGS.map(
                (key): SettingOptions => ({
                    key,
                    type: String,
                    choices: CLOSE_CHOICES,
                    default: "never",
                    scope: "client",
                })
            ),
        ]);
    }

    get enabled(): boolean {
        return this.getSetting("enabled");
    }

    get key(): "token" {
        return "token";
    }

    get templates() {
        return ["hud"];
    }

    get allowedActorTypes(): (ActorType | "creature")[] {
        return ["army", "creature", "hazard", "vehicle"];
    }

    get mainElement() {
        return this.#mainElement;
    }

    get anchor(): AdvancedHudAnchor {
        const bounds = this.mainElement?.getBoundingClientRect() ?? {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        };
        return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
        };
    }

    get sidebars() {
        return this.mainElement?.querySelector<HTMLElement>(".panel.bottom") ?? null;
    }

    _onEnable(enabled: boolean = this.enabled) {
        super._onEnable(enabled);

        this.#tokenClickLeftWrapper.toggle(enabled);
        this.#tokenDragLeftStartWrapper.toggle(enabled);
        this.#tokenLayerClickLeftWrapper.toggle(enabled);

        this.#canvasTearDownHook.toggle(enabled);
        this.#renderTokenHudHook.toggle(enabled);
        this.#renderActorSheetHook.toggle(enabled);

        if (!enabled && this.rendered) {
            this.close();
        }
    }

    _onSetToken(token: TokenPF2e | null): void {
        this.render(true);
    }

    async _prepareContext(options: TokenRenderOptions): Promise<TokenContext | TokenContextBase> {
        const parentData = await super._prepareContext(options);
        if (!parentData.hasActor) return parentData;

        const actor = parentData.actor;
        const statsHeader = getStatsHeader(actor);
        const isHazard = actor.isOfType("hazard");
        if (!isHazard && !statsHeader.health) return parentData;

        const sidebars =
            isHazard || actor.isOfType("army")
                ? getSidebars(actor).slice(0, 1)
                : getSidebars(actor);

        const data: TokenContext = {
            ...parentData,
            ...statsHeader,
            ...getStatsHeaderExtras(actor, this),
            ...getAdvancedStats(actor, this),
            sidebars,
            noSidebars: isHazard || !sidebars.some((sidebar) => !sidebar.disabled),
            name: this.token.document.name,
        };

        return data;
    }

    async _renderHTML(context: Partial<TokenContext>, options: TokenRenderOptions) {
        if (!context.isHazard && !context.health) return "";
        return this.renderTemplate("hud", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: TokenRenderOptions) {
        content.style.setProperty("--font-size", `${options.fontSize}px`);

        const oldElement = this.#mainElement;
        const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

        this.#mainElement = createHTMLElement("div", {
            id: "pf2e-hud-token-main",
            innerHTML: result,
            classes: ["pf2e-hud"],
        });

        const mode = this.getSetting("mode");

        if (mode === "exploded") {
            this.#mainElement.classList.add("exploded");
        } else {
            const classes = ["joined"];
            if (mode === "left") classes.push("left");

            const wrapper = createHTMLElement("div", {
                classes,
                children: this.#mainElement.children,
            });

            this.#mainElement.appendChild(wrapper);
        }

        if (focusName) {
            this.#mainElement
                .querySelector<HTMLInputElement>(`input[name="${focusName}"]`)
                ?.focus();
        }

        if (oldElement) oldElement.replaceWith(this.#mainElement);
        else content.appendChild(this.#mainElement);

        this.#activateListeners(content);
    }

    _insertElement(element: HTMLElement) {
        element.dataset.tooltipDirection = "UP";
        super._insertElement(element);
        return element;
    }

    _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        this.#canvasPanHook.activate();
        this.sidebar?.render(true);
    }

    _onClose(options: ApplicationClosingOptions) {
        this.#mainElement = null;
        this.#canvasPanHook.disable();
        return super._onClose(options);
    }

    _updatePosition(position = {} as ApplicationPosition) {
        const token = this.token;
        const element = this.element;
        if (!element || !token) return position;

        const canvasPosition = canvas.primary.getGlobalPosition();
        const canvasDimensions = canvas.dimensions;
        const scale = canvas.stage.scale.x;
        const mainElement = this.mainElement;
        const scaleDimensions = this.getSetting("scaleDimensions");
        const usedScale = scaleDimensions ? 1 : scale;

        position.left = canvasPosition.x;
        position.top = canvasPosition.y;
        position.width = canvasDimensions.width;
        position.height = canvasDimensions.height;
        position.scale = scaleDimensions ? scale : 1;

        element.style.setProperty("left", `${canvasPosition.x}px`);
        element.style.setProperty("top", `${canvasPosition.y}px`);
        element.style.setProperty("width", `${canvasDimensions.width * usedScale}px`);
        element.style.setProperty("height", `${canvasDimensions.height * usedScale}px`);
        element.style.setProperty("transform", `scale(${position.scale})`);

        if (mainElement) {
            const tokenBounds = token.bounds;
            const tokenDimensions = token.document;
            const ratio = canvas.dimensions.size / 100;

            const mainLeft = tokenBounds.left * usedScale;
            const mainTop = tokenBounds.top * usedScale;
            const mainWidth = tokenDimensions.width * ratio * 100 * usedScale;
            const mainHeight = tokenDimensions.height * ratio * 100 * usedScale;

            mainElement.style.setProperty("left", `${mainLeft}px`);
            mainElement.style.setProperty("top", `${mainTop}px`);
            mainElement.style.setProperty("width", `${mainWidth}px`);
            mainElement.style.setProperty("height", `${mainHeight}px`);
        }

        return position;
    }

    async _renderSidebarHTML(innerElement: HTMLElement, sidebar: SidebarName) {
        if (this.actor.isOfType("hazard", "army")) return;

        const sidebarsElement = createHTMLElement("div", {
            classes: ["sidebars"],
            innerHTML: await render("partials/sidebars", {
                sidebars: getSidebars(this.actor, sidebar),
            }),
        });

        innerElement.prepend(sidebarsElement);
    }

    _onRenderSidebar(innerElement: HTMLElement) {
        const sidebars = htmlQuery(innerElement, ":scope > .sidebars");
        sidebars?.classList.toggle("bottom", innerElement.offsetHeight < sidebars.offsetHeight);

        const itemElements = innerElement.querySelectorAll<HTMLElement>(".item[data-item-id]");
        for (const itemElement of itemElements) {
            const nameElement = itemElement.querySelector<HTMLElement>(".name");
            if (nameElement && nameElement.scrollWidth > nameElement.offsetWidth) {
                nameElement.dataset.tooltip = nameElement.innerHTML.trim();
            }
        }
    }

    _updateSidebarPosition(
        element: HTMLElement,
        center: Point,
        { bottom, right }: { right: number; bottom: number }
    ) {
        if (center.x <= 0 || center.x >= right || center.y <= 0 || center.y >= bottom) {
            element.style.setProperty("display", "none");
        } else {
            element.style.removeProperty("display");
        }
    }

    setToken(token: TokenPF2e | null) {
        this.toggleSidebar(null);

        if (!token) return super.setToken(token);

        const actor = token?.actor;
        if (
            !actor?.isOwner ||
            actor.isOfType("loot", "party") ||
            actor.sheet.rendered ||
            hud.persistent.isCurrentActor(actor, true) ||
            (hud.persistent.getSetting("autoSet") === "select" &&
                hud.persistent.acceptsActor(actor))
        ) {
            token = null;
        }

        super.setToken(token);
    }

    closeIf(event: AdvancedHudEvent) {
        const settingKey = this.eventToSetting(event);
        const setting = this.getSetting(settingKey);
        if (setting === "never") return false;

        if (setting === "all") {
            this.close();
        } else if (setting === "sidebar") {
            this.toggleSidebar(null);
        }

        return true;
    }

    #onRenderActorSheet(sheet: ActorSheetPF2e<ActorPF2e>) {
        if (this.isCurrentActor(sheet.actor)) this.close();
    }

    #onCanvasPan() {
        this._updatePosition();
        this.sidebar?._updatePosition();
    }

    #tokenClickLeft(
        token: TokenPF2e,
        wrapped: libWrapper.RegisterCallback,
        event: PIXI.FederatedEvent & MouseEvent
    ) {
        wrapped(event);

        if (event.altKey || event.shiftKey || event.ctrlKey || game.activeTool !== "select") return;

        if (token === this.token) this.close();
        else this.setToken(token);
    }

    #tokenDragLeftStart(
        token: TokenPF2e,
        wrapped: libWrapper.RegisterCallback,
        event: PIXI.FederatedEvent
    ) {
        wrapped(event);
        this.close();
    }

    #tokenLayerClickLeft(
        canvas: Canvas,
        wrapped: libWrapper.RegisterCallback,
        event: PIXI.FederatedEvent & MouseEvent
    ) {
        wrapped(event);

        if (this.getSetting("closeAllOnCLick")) {
            this.close();
            return;
        }

        const focused = document.activeElement as HTMLElement;

        if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
            focused.blur();
        } else if (this.sidebar) {
            this.toggleSidebar(null);
        } else {
            this.close();
        }
    }

    #activateListeners(html: HTMLElement) {
        addStatsHeaderListeners(this.actor, html, this.token);
        addStatsAdvancedListeners(this.actor, html);
        addSidebarsListeners(this, html);
    }
}

interface PF2eHudToken {
    get token(): TokenPF2e;
    get actor(): TokenHudActor;
}

type TokenHudActor = Exclude<ActorInstances<TokenDocumentPF2e>[ActorType], LootPF2e | PartyPF2e>;

type TokenRenderOptions = BaseTokenRenderOptions;

type TokenContextBase = BaseTokenContext<TokenHudActor>;

type TokenContext = TokenContextBase &
    StatsHeader &
    StatsHeaderExtras &
    StatsAdvanced & {
        name: string;
        sidebars: SidebarMenu[];
        noSidebars: boolean;
    };

type TokenCloseOption = (typeof CLOSE_OPTIONS)[number];

type TokenSettings = BaseTokenSettings &
    AdvancedHudSettings<TokenCloseOption> & {
        scaleDimensions: boolean;
        mode: "exploded" | "left" | "right";
        closeAllOnCLick: boolean;
    };

export { PF2eHudToken };
