import {
    R,
    addListenerAll,
    createHTMLFromString,
    createHook,
    elementData,
    libWrapper,
    registerWrapper,
} from "pf2e-api";
import {
    BaseActorContext,
    PF2eHudBaseToken,
    RenderOptionsHUD,
    type BaseTokenHUDSettings,
} from "./hud";
import { hud } from "./main";
import { SidebarElement, SidebarHUD, SidebarName, getSidebars } from "./sidebar";
import { PF2eHudActionsSidebar } from "./token-sidebars/actions";
import { PF2eHudTokenSidebar } from "./token-sidebars/base";
import { PF2eHudExtrasSidebar } from "./token-sidebars/extras";
import { PF2eHudItemsSidebar } from "./token-sidebars/items";
import { PF2eHudSkillsSidebar } from "./token-sidebars/skills";
import { PF2eHudSpellsSidebar } from "./token-sidebars/spells";
import {
    STATS_PARTIALS,
    StatsAdvanced,
    StatsHeaderWithExtras,
    addStatsAdvancedListeners,
    addStatsHeaderListeners,
    getStatsAdvanced,
    getStatsHeader,
} from "./utils";

const CLOSE_SETTINGS = ["closeOnSendToChat", "closeOnSpell"] as const;
const CLOSE_OPTIONS = ["never", "sidebar", "all"] as const;

const CLOSE_CHOICES = R.mapToObj(CLOSE_OPTIONS, (option) => [
    option,
    `pf2e-hud.token.closeChoices.${option}`,
]);

class PF2eHudToken
    extends PF2eHudBaseToken<TokenSettings, ActorType>
    implements SidebarHUD<TokenSettings, PF2eHudToken>
{
    #canvasPanHook = createHook("canvasPan", () => {
        this._updatePosition();
        this.#sidebar?._updatePosition();
    });

    #usedScale = 1;
    #mainCenter = { x: 0, y: 0 };
    #mainElement: HTMLElement | null = null;
    #initialized = false;
    #sidebar: PF2eHudTokenSidebar | null = null;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-token",
    };

    get partials() {
        return STATS_PARTIALS;
    }

    get templates(): ["main"] {
        return ["main"];
    }

    get hudKey(): "token" {
        return "token";
    }

    get fontSize() {
        return this.setting("fontSize");
    }

    get enabled() {
        return this.setting("enabled");
    }

    get usedScale() {
        return this.#usedScale;
    }

    get mainCenter() {
        return this.#mainCenter;
    }

    get sidebar() {
        return this.#sidebar;
    }

    get useModifiers(): boolean {
        return this.setting("modifiers");
    }

    get mainElement() {
        return this.#mainElement;
    }

    get settings(): SettingOptions[] {
        return [
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "client",
                requiresReload: true,
            },
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
                key: "fontSize",
                type: Number,
                range: {
                    min: 10,
                    max: 30,
                    step: 1,
                },
                default: 14,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "sidebarFontSize",
                type: Number,
                range: {
                    min: 10,
                    max: 30,
                    step: 1,
                },
                default: 14,
                scope: "client",
                onChange: () => {
                    this.sidebar?.render();
                },
            },

            {
                key: "sidebarHeight",
                type: Number,
                range: {
                    min: 50,
                    max: 100,
                    step: 1,
                },
                default: 100,
                scope: "client",
                onChange: () => {
                    this.sidebar?.render();
                },
            },
            {
                key: "multiColumns",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: () => {
                    this.sidebar?.render();
                },
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
            {
                key: "modifiers",
                type: Boolean,
                default: false,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "highestSpeed",
                type: Boolean,
                default: false,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
        ];
    }

    _onEnable() {
        if (this.#initialized) return;

        const enabled = this.enabled;
        if (!enabled) return;

        super._onEnable(enabled);

        this.#initialized = true;

        const context = this;

        registerWrapper(
            "CONFIG.Token.objectClass.prototype._onClickLeft",
            function (
                this: TokenPF2e,
                wrapped: libWrapper.RegisterCallback,
                event: PIXI.FederatedMouseEvent
            ) {
                wrapped(event);
                if (event.shiftKey || event.ctrlKey || game.activeTool !== "select") return;
                if (this === context.token) context.#clickClose();
                else context.setToken(this);
            },
            "WRAPPER"
        );

        registerWrapper(
            "CONFIG.Token.objectClass.prototype._onDragLeftStart",
            function (
                this: TokenPF2e,
                wrapped: libWrapper.RegisterCallback,
                event: PIXI.FederatedEvent
            ) {
                wrapped(event);
                context.close();
            },
            "WRAPPER"
        );

        registerWrapper(
            "TokenLayer.prototype._onClickLeft",
            function (
                this: Canvas,
                wrapped: libWrapper.RegisterCallback,
                event: PIXI.FederatedMouseEvent
            ) {
                wrapped(event);
                context.#clickClose();
            },
            "WRAPPER"
        );

        Hooks.on("renderTokenHUD", () => {
            this.close();
        });

        Hooks.on("renderActorSheet", (sheet: ActorSheetPF2e) => {
            if (this.isCurrentActor(sheet.actor)) this.close();
        });
    }

    async _prepareContext(options: RenderOptionsHUD): Promise<TokenContext | TokenContextBase> {
        const actor = this.actor!;
        const parentData = await super._prepareContext(options);
        const statsMain = getStatsHeader(actor, true);
        if (!statsMain.health) return parentData;

        const data: TokenContext = {
            ...parentData,
            ...statsMain,
            ...getStatsAdvanced(actor, {
                useModifier: this.useModifiers,
                useHighestSpeed: this.setting("highestSpeed"),
            }),
            sidebars: getSidebars({}),
            name: this.token!.document.name,
        };

        return data;
    }

    async _renderHTML(context: Partial<TokenContext>, options: RenderOptionsHUD) {
        if (!context.health) return "";
        return this.renderTemplate("main", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: RenderOptionsHUD) {
        content.dataset.tokenUuid = this.token?.document.uuid;
        content.style.setProperty("--font-size", `${options.fontSize}px`);

        const oldElement = this.#mainElement;
        const focusName = oldElement?.querySelector<HTMLInputElement>("input:focus")?.name;

        this.#mainElement = createHTMLFromString(result);

        const mode = this.setting("mode");

        if (mode === "exploded") {
            this.#mainElement.classList.add("exploded");
        } else {
            const wrapper = createHTMLFromString("<div class='joined'></div>");
            if (mode === "left") wrapper.classList.add("left");

            wrapper.replaceChildren(...this.#mainElement.children);
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
    }

    _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        this.#canvasPanHook.activate();
        this.#sidebar?.render(true);
    }

    _updatePosition(position = {} as ApplicationPosition) {
        const token = this.token;
        const element = this.element;
        if (!element || !token) return position;

        const canvasPosition = canvas.primary.getGlobalPosition();
        const canvasDimensions = canvas.dimensions;
        const scale = canvas.stage.scale.x;
        const mainElement = this.mainElement;
        const scaleDimensions = this.setting("scaleDimensions");
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

        this.#mainCenter = { x: 0, y: 0 };

        if (mainElement) {
            const tokenBounds = token.bounds;
            const tokenDimensions = token.document;
            const ratio = canvas.dimensions.size / 100;

            const mainLeft = tokenBounds.left * usedScale;
            const mainTop = tokenBounds.top * usedScale;
            const mainWidth = tokenDimensions.width * ratio * 100 * usedScale;
            const mainHeight = tokenDimensions.height * ratio * 100 * usedScale;

            this.#mainCenter = {
                x: mainLeft + mainWidth / 2,
                y: mainTop + mainHeight / 2,
            };

            mainElement.style.setProperty("left", `${mainLeft}px`);
            mainElement.style.setProperty("top", `${mainTop}px`);
            mainElement.style.setProperty("width", `${mainWidth}px`);
            mainElement.style.setProperty("height", `${mainHeight}px`);
        }

        this.#usedScale = position.scale;

        return position;
    }

    _onSetToken(token: TokenPF2e<ActorPF2e> | null) {
        this.render(true);
    }

    setToken(token: TokenPF2e | null | false) {
        this.toggleSidebar(null);

        if (!token) return super.setToken(token);

        const actor = token?.actor;
        if (
            !actor?.isOwner ||
            actor.isOfType("loot", "party") ||
            actor.sheet.rendered ||
            hud.persistent.isCurrentActor(actor, true)
        ) {
            token = null;
        }

        super.setToken(token as TokenPF2e<ActorType>);
    }

    close(options?: ApplicationClosingOptions): Promise<ApplicationV2> {
        this.toggleSidebar(null);
        this.#mainElement = null;
        this.#canvasPanHook.disable();
        return super.close(options);
    }

    toggleSidebar(sidebar: SidebarName | null) {
        if (this.#sidebar?.sidebarKey === sidebar) sidebar = null;

        this.#sidebar?.close();
        this.#sidebar = null;

        if (!sidebar) return;

        switch (sidebar) {
            case "actions":
                this.#sidebar = new PF2eHudActionsSidebar(this);
                break;
            case "extras":
                this.#sidebar = new PF2eHudExtrasSidebar(this);
                break;
            case "items":
                this.#sidebar = new PF2eHudItemsSidebar(this);
                break;
            case "skills":
                this.#sidebar = new PF2eHudSkillsSidebar(this);
                break;
            case "spells":
                this.#sidebar = new PF2eHudSpellsSidebar(this);
                break;
        }

        this.#sidebar.render(true);
    }

    closeIf(option: SidebarCloseOptions) {
        const setting = this.setting(option);

        if (setting === "all") {
            return this.close();
        } else if (setting === "sidebar") {
            return this.toggleSidebar(null);
        }
    }

    #clickClose() {
        const focused = document.activeElement as HTMLElement;

        if (focused?.closest("[id='pf2e-hud.token']")) {
            focused.blur();
        } else if (this.sidebar) {
            this.toggleSidebar(null);
        } else {
            this.close();
        }
    }

    #activateListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addStatsHeaderListeners(actor, html, this.token);
        addStatsAdvancedListeners(actor, html);

        addListenerAll(html, "[data-action='open-sidebar']:not(.disabled)", (event, el) => {
            const { sidebar } = elementData<{ sidebar: SidebarName }>(el);
            this.toggleSidebar(sidebar);
        });
    }
}

type TokenContextBase = BaseActorContext;

type TokenContext = BaseActorContext &
    StatsHeaderWithExtras &
    StatsAdvanced & {
        name: string;
        sidebars: SidebarElement[];
    };

type SidebarCloseOptions = (typeof CLOSE_SETTINGS)[number];
type SidebarCloseOption = (typeof CLOSE_OPTIONS)[number];

type TokenSettings = BaseTokenHUDSettings &
    Record<SidebarCloseOptions, SidebarCloseOption> & {
        enabled: boolean;
        scaleDimensions: boolean;
        mode: "exploded" | "left" | "right";
        fontSize: number;
        sidebarFontSize: number;
        highestSpeed: boolean;
        sidebarHeight: number;
        multiColumns: boolean;
    };

type ActorType = Exclude<ActorInstances[keyof ActorInstances], LootPF2e | PartyPF2e>;

export { PF2eHudToken };
export type { SidebarCloseOption, TokenSettings };
