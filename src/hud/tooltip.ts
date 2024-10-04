import {
    R,
    createGlobalEvent,
    createHook,
    createTimeout,
    createWrapper,
    isHoldingModifierKeys,
    libWrapper,
    localize,
} from "foundry-pf2e";
import { hud } from "../main";
import {
    BaseTokenContext,
    BaseTokenRenderOptions,
    BaseTokenSettings,
    PF2eHudBaseToken,
} from "./base/token";
import {
    HealthData,
    IWR_DATA,
    StatsSpeed,
    StatsStatistic,
    getSpeeds,
    getStatistics,
    getStatsHeader,
    userCanObserveActor,
} from "./shared/base";

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

const DELAY_BUFFER = 50;
const SETTING_POSITION = R.keys(POSITIONS);
const SETTING_TYPE = ["never", "owned", "observed"] as const;
const SETTING_SHOW_STATUS = ["never", "small", "all"] as const;
const SETTING_DISTANCE = ["never", "idiot", "smart", "weird"] as const;
const SETTING_NO_DEAD = ["none", "small", "full"] as const;

class PF2eHudTooltip extends PF2eHudBaseToken<TooltipSettings, ActorPF2e, TooltipRenderOptions> {
    #hoverTokenHook = createHook("hoverToken", this.#onHoverToken.bind(this));
    #canvasTearDownHook = createHook("canvasTearDown", this.#onCanvasTearDown.bind(this));

    #tokenRefreshWrapper = createWrapper(
        "CONFIG.Token.objectClass.prototype._refreshVisibility",
        this.#tokenRefreshVisibility,
        {
            context: this,
            onDisable: this.clearDistance.bind(this),
        }
    );

    #renderTimeout = createTimeout(this.render.bind(this), DELAY_BUFFER);
    #closeTimeout = createTimeout(this.close.bind(this), DELAY_BUFFER);

    #clickEvent = createGlobalEvent("mousedown", () => {
        this.cancelRender();
        this.close();
    });

    #targetToken: TokenPF2e | null = null;
    #graphics: PIXI.Graphics | null = null;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-tooltip",
        position: {
            width: "auto",
            height: "auto",
        },
    };

    get SETTINGS_ORDER(): (keyof TooltipSettings)[] {
        return [
            "status",
            "enabled",
            "type",
            "showStatus",
            "delay",
            "position",
            "fontSize",
            "showDistance",
            "drawDistance",
            "noDead",
        ];
    }

    getSettings() {
        return super.getSettings().concat([
            {
                key: "status",
                type: String,
                default: undefined,
                onChange: () => this.enable(),
            },
            {
                key: "showStatus",
                type: String,
                choices: SETTING_SHOW_STATUS,
                default: "small",
                scope: "client",
            },
            {
                key: "type",
                type: String,
                choices: SETTING_TYPE,
                default: "never",
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
                onChange: (value: number) => {
                    const enableDraw = value > 0 && this.enabled;
                    this.#tokenRefreshWrapper.toggle(enableDraw);
                    this.#canvasTearDownHook.toggle(enableDraw);
                },
            },
            {
                key: "noDead",
                type: String,
                choices: SETTING_NO_DEAD,
                default: "none",
                scope: "client",
            },
        ]);
    }

    get key() {
        return "tooltip";
    }

    get templates() {
        return ["tooltip"] as const;
    }

    get allowedActorTypes() {
        return [];
    }

    get enabled(): boolean {
        return (
            this.getSetting("enabled") &&
            (this.getSetting("showDistance") !== "never" || !!this.healthStatuses)
        );
    }

    get targetToken() {
        return this.#targetToken;
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

    get distanceDetails() {
        const setting = this.getSetting("showDistance");
        if (setting === "never") return;

        const { decimals, multiplier, unit } = DISTANCES[setting];
        return {
            decimals,
            multiplier,
            unit: localize("tooltip.distance", unit),
        };
    }

    get healthStatuses() {
        const statuses = R.pipe(
            this.getSetting("status").split(","),
            R.map((status) => status.trim()),
            R.filter(R.isTruthy)
        );
        return statuses.length >= 3 ? statuses : null;
    }

    _onEnable(enabled = this.enabled) {
        super._onEnable(enabled);

        this.#clickEvent.toggle(enabled);
        this.#hoverTokenHook.toggle(enabled);

        const enableDraw = enabled && this.getSetting("drawDistance") > 0;
        this.#tokenRefreshWrapper.toggle(enableDraw);
        this.#canvasTearDownHook.toggle(enableDraw);

        if (!enabled && this.rendered) {
            this.close();
        }
    }

    _tokenCleanup() {
        this.#targetToken = null;

        this.cancelRender();
        this.clearDistance();

        super._tokenCleanup();
    }

    _onSetToken(token: TokenPF2e | null): void {
        this.renderWithDelay();
    }

    async _prepareContext(
        options: TooltipRenderOptions
    ): Promise<TooltipContext | StatusedTooltipContext | TooltipContextBase> {
        const parentData = await super._prepareContext(options);
        const baseData: TooltipContextBase = {
            ...parentData,
            distance: undefined,
        };

        if (!parentData.hasActor) return baseData;

        const actor = parentData.actor;
        const token = this.token!;

        baseData.distance = (() => {
            const distanceData = this.distanceDetails;
            if (!distanceData) return;

            const user = game.user;
            const checks: [TargetIcon, (TokenPF2e | null)[]][] = [
                ["selected", [hud.token.token]],
                ["selected", canvas.tokens.controlled],
                ["targeted", [...user.targets]],
                ["persistent", hud.persistent.actor?.getActiveTokens() ?? []],
                ["character", user.character?.getActiveTokens() ?? []],
            ];

            let icon;

            for (const [type, targets] of checks) {
                const target = R.only(targets);
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

        const statsMain = getStatsHeader(actor);

        if (!statsMain.health) {
            return baseData;
        }

        const isOwner = actor.isOwner;
        const isObserver = userCanObserveActor(actor);
        const extendedType = this.getSetting("type");
        const extended =
            (extendedType === "owned" && isOwner) || (extendedType === "observed" && isObserver);

        const status = (() => {
            const statusType = this.getSetting("showStatus");
            if (statusType === "never" || (statusType === "small" && extended)) return;

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

            statuses.shift();
            statuses.pop();

            const pick = Math.ceil(ratio * statuses.length);
            return statuses.at(pick - 1);
        })();

        if (!extended) {
            return {
                ...baseData,
                status,
                health: statsMain.health,
            } satisfies StatusedTooltipContext;
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
            adjustment: (actor.isOfType("npc") && actor.attributes.adjustment) || "normal",
            statistics: getStatistics(actor),
            distance: baseData.distance,
            health: statsMain.health,
            level: actor.level,
            extended,
            status,
            name,
            iwr,
        };

        return data;
    }

    async _renderHTML(context: Partial<TooltipContext>, options: TooltipRenderOptions) {
        return this.renderTemplate("tooltip", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: TooltipRenderOptions) {
        content.style.setProperty("--font-size", `${options.fontSize}px`);
        content.innerHTML = result;
    }

    _onRender(context: ApplicationRenderContext, options: TooltipRenderOptions) {
        this.cancelClose();
        this.drawDistance();
    }

    _updatePosition(position: ApplicationPosition) {
        const token = this.token;
        const element = this.element;
        if (!element || !token || !canvas.ready) return position;

        const scale = token.worldTransform.a;
        const gridSize = canvas.grid.size;
        const tokenCoords = canvas.clientCoordinatesFromCanvas(token);
        const targetCoords = {
            left: tokenCoords.x,
            top: tokenCoords.y,
            width: token.document.width * gridSize * scale,
            height: token.document.height * gridSize * scale,
            get right() {
                return this.left + this.width;
            },
            get bottom() {
                return this.top + this.height;
            },
        };

        const positions = POSITIONS[this.getSetting("position")].slice();
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

    cancelRender() {
        this.#renderTimeout.cancel();
    }

    renderWithDelay(force?: boolean, options?: ApplicationRenderOptions) {
        if (!this.actor || this.token === hud.token.token) return;

        if (this.rendered) {
            this.render(force, options);
            return;
        }

        const delay = this.getSetting("delay");
        if (delay > 0) {
            this.cancelClose();
            this.#renderTimeout.start(Math.max(DELAY_BUFFER, delay), true);
        } else {
            this.render(true, options);
        }
    }

    async render(
        options?: boolean | Partial<TooltipRenderOptions>,
        _options?: Partial<TooltipRenderOptions>
    ) {
        if (!this.actor || this.token === hud.token.token) return this;
        return super.render(options, _options);
    }

    cancelClose() {
        this.clearDistance();
        this.#closeTimeout.cancel();
    }

    closeWithDelay(options?: ApplicationClosingOptions) {
        this.#closeTimeout(options);
    }

    drawDistance() {
        if (!canvas.ready || !canvas.scene || !this.canDrawDistance) return;

        const origin = this.token!;
        const target = this.targetToken!;
        const graphics = this.graphics;
        const originCenter = origin.center;
        const targetCenter = target.center;
        const lineColor = game.user.color;
        const thickness = this.getSetting("drawDistance");
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

    #onCanvasTearDown() {
        this.clearDistance();
        this.setToken(null);
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
            (this.getSetting("noDead") === "none" && actor.isDead) ||
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

type TargetIcon = keyof typeof TARGET_ICONS;

type TooltipRenderOptions = BaseTokenRenderOptions;

type DistanceContext = {
    unit: string;
    icon: string;
    range: string;
};

type DistanceType = (typeof SETTING_DISTANCE)[number];

type TooltipContextBase = BaseTokenContext & {
    distance: DistanceContext | undefined;
};

type StatusedTooltipContext = TooltipContextBase & {
    status: string | undefined;
    health: HealthData;
};

type TooltipContext = StatusedTooltipContext & {
    distance: DistanceContext | undefined;
    status: string | undefined;
    extended: boolean;
    level: number;
    name: string | undefined;
    speeds: StatsSpeed[];
    speedNote: string | undefined;
    adjustment: "elite" | "weak" | "normal";
    statistics: StatsStatistic[];
    iwr: {
        active: boolean;
        icon: string;
        label: string;
    }[];
};

type TooltipSettings = BaseTokenSettings & {
    delay: number;
    status: string;
    drawDistance: number;
    showStatus: (typeof SETTING_SHOW_STATUS)[number];
    type: (typeof SETTING_TYPE)[number];
    noDead: (typeof SETTING_NO_DEAD)[number];
    position: (typeof SETTING_POSITION)[number];
    showDistance: (typeof SETTING_DISTANCE)[number];
};

export { PF2eHudTooltip };
