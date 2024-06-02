import {
    R,
    createGlobalEvent,
    createHook,
    createTimeout,
    createWrapper,
    getOnly,
    isHoldingModifierKeys,
    libWrapper,
    localize,
} from "pf2e-api";
import {
    BaseActorContext,
    PF2eHudBaseToken,
    RenderOptionsHUD,
    type BaseTokenHUDSettings,
} from "./hud";
import { hud } from "./main";
import {
    HealthData,
    IWR_DATA,
    StatsHeader,
    StatsSpeed,
    StatsStatistic,
    canObserve,
    getSpeeds,
    getStatistics,
    getStatsHeader,
} from "./utils";

const DELAY_BUFFER = 50;

const POSITIONS = {
    left: ["left", "right", "top", "bottom"],
    right: ["right", "left", "top", "bottom"],
    top: ["top", "bottom", "left", "right"],
    bottom: ["bottom", "top", "left", "right"],
};

const TARGET_ICONS = {
    selected: "fa-solid fa-expand",
    targeted: "fa-solid fa-crosshairs-simple",
    persistent: "fa-solid fa-image-user",
    character: "fa-solid fa-user",
};

const DISTANCES: Record<
    Exclude<DistanceType, "never">,
    { multiplier: number; unit: string; decimals: number }
> = {
    idiot: {
        multiplier: 1,
        decimals: 0,
        unit: "feet",
    },
    smart: {
        multiplier: 0.3048,
        decimals: 2,
        unit: "meter",
    },
    weird: {
        multiplier: 0.2,
        decimals: 0,
        unit: "square",
    },
};

const SETTING_TYPE = ["never", "owned", "observed"] as const;
const SETTING_DISTANCE = ["never", "idiot", "smart", "weird"] as const;
const SETTING_NO_DEAD = ["none", "small", "full"] as const;
const SETTING_POSITION = R.keys.strict(POSITIONS);

class PF2eHudTooltip extends PF2eHudBaseToken<TooltipSettings, ActorPF2e> {
    #hoverTokenHook = createHook("hoverToken", this.#onHoverToken.bind(this));

    #renderTimeout = createTimeout(this.render.bind(this), DELAY_BUFFER);
    #closeTimeout = createTimeout(this.close.bind(this), DELAY_BUFFER);

    #clickEvent = createGlobalEvent("mousedown", () => this.close());

    #targetToken: TokenPF2e | null = null;
    #graphics: PIXI.Graphics | null = null;

    #tokenRefreshWrapper = createWrapper(
        "CONFIG.Token.objectClass.prototype._refreshVisibility",
        this.#tokenRefreshVisibility,
        {
            context: this,
            onDisable: this.clearDistance.bind(this),
        }
    );

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-tooltip",
        position: {
            width: "auto",
            height: "auto",
        },
    };

    get templates(): ["tooltip"] {
        return ["tooltip"];
    }

    get fontSize() {
        return this.setting("fontSize");
    }

    get hudKey(): "tooltip" {
        return "tooltip";
    }

    get enabled(): boolean {
        return (
            this.setting("enabled") &&
            (this.setting("showDistance") !== "never" || !!this.healthStatuses)
        );
    }

    get useModifiers() {
        return this.setting("modifiers");
    }

    get targetToken() {
        return this.#targetToken;
    }

    get healthStatuses() {
        const statuses = R.pipe(
            this.setting("status").split(","),
            R.map((status) => status.trim()),
            R.compact
        );
        return statuses.length >= 3 ? statuses : null;
    }

    get distanceDetails() {
        const setting = this.setting("showDistance");
        if (setting === "never") return;

        const { decimals, multiplier, unit } = DISTANCES[setting];
        return {
            decimals,
            multiplier,
            unit: localize("tooltip.distance", unit),
        };
    }

    get graphics() {
        if (!this.#graphics) {
            this.#graphics = new PIXI.Graphics();
            canvas.interface.grid.addChild(this.#graphics);
        }
        return this.#graphics;
    }

    get canDrawDistance() {
        const isValidToken = (token: TokenPF2e | null): token is TokenPF2e => {
            return !!token && token.visible && !token.isPreview && !token.isAnimating;
        };
        return isValidToken(this.token) && isValidToken(this.targetToken);
    }

    get settings(): SettingOptions[] {
        return [
            {
                key: "status",
                type: String,
                default: undefined,
                onChange: () => this.enable(),
            },
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "client",
                onChange: () => this.enable(),
            },
            {
                key: "type",
                type: String,
                choices: SETTING_TYPE,
                default: "owned",
                scope: "client",
            },
            {
                key: "delay",
                type: Number,
                range: {
                    min: 0,
                    max: 2000,
                    step: 50,
                },
                default: 250,
                scope: "client",
            },
            {
                key: "position",
                type: String,
                choices: SETTING_POSITION,
                default: "top",
                scope: "client",
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
            },
            {
                key: "showDistance",
                type: String,
                choices: SETTING_DISTANCE,
                default: "idiot",
                scope: "client",
                onChange: () => this.enable(),
            },
            {
                key: "drawDistance",
                type: Number,
                range: {
                    min: 0,
                    max: 20,
                    step: 1,
                },
                default: 4,
                scope: "client",
                onChange: (value) => {
                    this.#tokenRefreshWrapper.toggle(value > 0 && this.enabled);
                },
            },
            {
                key: "noDead",
                type: String,
                choices: SETTING_NO_DEAD,
                default: "small",
                scope: "client",
            },
            {
                key: "modifiers",
                type: Boolean,
                default: false,
                scope: "client",
            },
        ];
    }

    _onEnable(enabled = this.enabled) {
        super._onEnable(enabled);

        this.#clickEvent.toggle(enabled);
        this.#hoverTokenHook.toggle(enabled);
        this.#tokenRefreshWrapper.toggle(enabled && this.setting("drawDistance") > 0);
    }

    async _prepareContext(
        options: RenderOptionsHUD
    ): Promise<TooltipContext | StatusedTooltipContext | TooltipContextBase> {
        const parentData = await super._prepareContext(options);
        const baseData: TooltipContextBase = {
            ...parentData,
            distance: undefined,
        };

        const token = this.token;
        const actor = token?.actor;
        if (!actor) return baseData;

        baseData.distance = (() => {
            const distanceData = this.distanceDetails;
            if (!distanceData) return;

            const user = game.user as UserPF2e;
            const checks: [TargetIcon, (TokenPF2e | null)[] | Set<TokenPF2e> | undefined][] = [
                ["selected", [hud.token.token]],
                ["selected", canvas.tokens.controlled as TokenPF2e[]],
                ["targeted", user.targets],
                ["persistent", hud.persistent.actor?.getActiveTokens()],
                ["character", user.character?.getActiveTokens()],
            ];

            let icon;

            for (const [type, targets] of checks) {
                const target = getOnly(targets);
                if (!target || target === token) continue;

                icon = TARGET_ICONS[type];
                this.#targetToken = target;

                break;
            }

            if (!this.#targetToken) return;

            const { multiplier, unit, decimals } = distanceData;

            return {
                unit,
                icon: `<i class="${icon}"></i>`,
                range: (token.distanceTo(this.#targetToken) * multiplier).toFixed(decimals),
            };
        })();

        const statsMain = getStatsHeader(actor, false);

        if (!statsMain.health || hud.persistent.isCurrentActor(actor)) {
            return baseData;
        }

        const status = (() => {
            const statuses = this.healthStatuses;
            if (!statuses) return;

            let { value, max, ratio } = statsMain.health.total;
            value = Math.clamp(value, 0, max);

            if (value === 0) {
                return statuses.at(0)!;
            }

            if (value === max) {
                return statuses.at(-1)!;
            }

            const pick = Math.ceil(ratio * (statuses.length - 2));
            return statuses.at(pick - 1);
        })();

        const setting = this.setting("type");
        const isOwner = actor.isOwner;
        const isObserver = canObserve(actor);

        const expended = (setting === "owned" && isOwner) || (setting === "observed" && isObserver);
        if (!expended) {
            const data: StatusedTooltipContext = {
                ...baseData,
                status,
                health: statsMain.health,
            };

            return data;
        }

        const name =
            isOwner || !game.pf2e.settings.tokens.nameVisibility || isObserver
                ? token.document.name
                : undefined;

        const iwr = IWR_DATA.map((iwr) => ({
            ...iwr,
            active: actor.attributes[iwr.type].length > 0,
        }));

        const data: TooltipContext = {
            ...parentData,
            ...statsMain,
            ...getSpeeds(actor),
            statistics: getStatistics(actor, this.useModifiers),
            distance: baseData.distance,
            expended,
            status,
            name,
            iwr,
        };

        return data;
    }

    async _renderHTML(
        context: Partial<TooltipContext>,
        options: ApplicationRenderOptions
    ): Promise<string> {
        return await this.renderTemplate("tooltip", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: RenderOptionsHUD) {
        content.dataset.tokenUuid = this.token?.document.uuid;
        content.style.setProperty("--font-size", `${options.fontSize}px`);
        content.innerHTML = result;
    }

    _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        this.cancelClose();
        this.drawDistance();
    }

    _updatePosition(position: ApplicationPosition) {
        const token = this.token;
        const element = this.element;
        if (!element || !token || !canvas.ready) return position;

        const scale = token.worldTransform.a;
        const tokenCoords = canvas.clientCoordinatesFromCanvas(token);
        const targetCoords = {
            left: tokenCoords.x,
            top: tokenCoords.y,
            width: token.hitArea.width * scale,
            height: token.hitArea.height * scale,
            get right() {
                return this.left + this.width;
            },
            get bottom() {
                return this.top + this.height;
            },
        };

        const positions = POSITIONS[this.setting("position")].slice();
        const hudBounds = element.getBoundingClientRect();
        const limitX = window.innerWidth - hudBounds.width;
        const limitY = window.innerHeight - hudBounds.height;

        let coords: Point | undefined;

        while (positions.length && !coords) {
            const selected = positions.shift();

            if (selected === "left") {
                coords = {
                    x: targetCoords.left - hudBounds.width,
                    y: postionFromTargetY(hudBounds, targetCoords),
                };
                if (coords.x < 0) coords = undefined;
            } else if (selected === "right") {
                coords = {
                    x: targetCoords.right,
                    y: postionFromTargetY(hudBounds, targetCoords),
                };
                if (coords.x > limitX) coords = undefined;
            } else if (selected === "top") {
                coords = {
                    x: postionFromTargetX(hudBounds, targetCoords),
                    y: targetCoords.top - hudBounds.height,
                };
                if (coords.y < 0) coords = undefined;
            } else if (selected === "bottom") {
                coords = {
                    x: postionFromTargetX(hudBounds, targetCoords),
                    y: targetCoords.bottom,
                };
                if (coords.y > limitY) coords = undefined;
            }
        }

        if (coords) {
            element.style.setProperty("left", `${coords.x}px`);
            element.style.setProperty("top", `${coords.y}px`);

            position.left = coords.x;
            position.top = coords.y;
        }

        return super._updatePosition(position);
    }

    _onSetToken(token: TokenPF2e<ActorPF2e> | null) {
        this.#targetToken = null;
        this.renderWithDelay();
    }

    async render(
        options?: boolean | ApplicationRenderOptions,
        _options?: ApplicationRenderOptions
    ): Promise<ApplicationV2> {
        if (this.token === hud.token.token) return this;
        return super.render(options, _options);
    }

    renderWithDelay(force?: boolean, options?: ApplicationRenderOptions) {
        if (!this.token?.actor) return;

        if (this.rendered) {
            this.render(force, options);
            return;
        }

        const delay = this.setting("delay");
        if (delay > 0) {
            this.cancelClose();
            this.#renderTimeout.start(Math.max(DELAY_BUFFER, delay), true);
        } else {
            this.render(true, options);
        }
    }

    cancelRender() {
        this.#renderTimeout.cancel();
    }

    close(options?: ApplicationClosingOptions): Promise<ApplicationV2> {
        this.#targetToken = null;
        this.cancelRender();
        this.clearDistance();
        return super.close(options);
    }

    closeWithDelay(options?: ApplicationClosingOptions) {
        this.#closeTimeout(options);
    }

    cancelClose() {
        this.clearDistance();
        this.#closeTimeout.cancel();
    }

    drawDistance() {
        if (!canvas.ready || !canvas.scene || !this.canDrawDistance) return;

        const origin = this.token!;
        const target = this.targetToken!;
        const graphics = this.graphics;
        const originCenter = origin.center;
        const targetCenter = target.center;
        const lineColor = game.user.color;
        const thickness = this.setting("drawDistance");
        const outerThickness = Math.round(thickness * 1.5);

        graphics
            .lineStyle(outerThickness, 0x000000, 0.5)
            .moveTo(originCenter.x, originCenter.y)
            .lineTo(targetCenter.x, targetCenter.y);
        graphics
            .lineStyle(thickness, lineColor, 0.5)
            .moveTo(originCenter.x, originCenter.y)
            .lineTo(targetCenter.x, targetCenter.y);
    }

    clearDistance() {
        this.#graphics?.destroy({ children: true });
        this.#graphics = null;
    }

    #onHoverToken(token: TokenPF2e, hovered: boolean) {
        if (hovered && !isHoldingModifierKeys(["Shift", "Control"])) {
            this.#tokenHoverIn(token);
        } else {
            this.#tokenHoverOut(token);
        }
    }

    #tokenHoverIn(token: TokenPF2e) {
        if (window.document.querySelector(".app:hover")) return;

        const actor = token.actor;

        if (
            !actor ||
            (token.document.disposition === CONST.TOKEN_DISPOSITIONS.SECRET && !actor.isOwner) ||
            (this.setting("noDead") === "none" && actor.isDead) ||
            hud.token.token === token
        )
            return;

        this.setToken(token);
    }

    #tokenHoverOut(token: TokenPF2e) {
        this.cancelRender();
        this.closeWithDelay();
    }

    #tokenRefreshVisibility(token: TokenPF2e, wrapped: libWrapper.RegisterCallback) {
        wrapped();

        if (!this.token || !this.targetToken) return;
        if (this.token !== token && this.targetToken !== token) return;

        this.clearDistance();
        this.drawDistance();
    }
}

function postionFromTargetY(
    bounds: DOMRect,
    targetCoords: { top: number; height: number },
    margin = 0
) {
    let y = targetCoords.top + targetCoords.height / 2 - bounds.height / 2;

    if (y + bounds.height > window.innerHeight) {
        y = window.innerHeight - bounds.height - margin;
    }

    if (y < 0) {
        y = margin;
    }

    return y;
}

function postionFromTargetX(
    bounds: DOMRect,
    targetCoords: { left: number; width: number },
    margin = 0
) {
    let x = targetCoords.left + targetCoords.width / 2 - bounds.width / 2;

    if (x + bounds.width > window.innerWidth) {
        x = window.innerWidth - bounds.width;
    }

    if (x < 0) {
        x = margin;
    }

    return x;
}

type TooltipContextBase = BaseActorContext & {
    distance: DistanceContext | undefined;
};

type StatusedTooltipContext = TooltipContextBase & {
    status: string | undefined;
    health: HealthData;
};

type TooltipContext = BaseActorContext &
    StatsHeader & {
        distance: DistanceContext | undefined;
        status: string | undefined;
        expended: boolean;
        name: string | undefined;
        speeds: StatsSpeed[];
        speedNote: string | undefined;
        statistics: StatsStatistic[];
        iwr: {
            active: boolean;
            icon: string;
            label: string;
        }[];
    };

type DistanceType = (typeof SETTING_DISTANCE)[number];

type TooltipSettings = BaseTokenHUDSettings & {
    status: string;
    enabled: boolean;
    type: (typeof SETTING_TYPE)[number];
    delay: number;
    position: (typeof SETTING_POSITION)[number];
    fontSize: number;
    noDead: (typeof SETTING_NO_DEAD)[number];
    showDistance: DistanceType;
    drawDistance: number;
};

type DistanceContext = {
    unit: string;
    icon: string;
    range: string;
};

type TargetIcon = keyof typeof TARGET_ICONS;

export { PF2eHudTooltip };
export type { TooltipSettings };
