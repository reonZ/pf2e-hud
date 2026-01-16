import { hud } from "main";
import {
    ActorPF2e,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationPosition,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    createToggleableHook,
    createTimeout,
    createToggleableEvent,
    createToggleableWrapper,
    htmlQuery,
    isHoldingModifierKey,
    localize,
    R,
    render,
    TokenPF2e,
} from "module-helpers";
import { getHealthStatusData } from "settings";
import { BaseTokenPF2eHUD, calculateActorHealth, HUDSettingsList } from ".";

const TARGET_ICONS = {
    selected: "fa-solid fa-expand",
    targeted: "fa-solid fa-crosshairs-simple",
    persistent: "fa-solid fa-image-user",
    character: "fa-solid fa-user",
};

const TARGET_CHECKS: [TargetIcon, () => (TokenPF2e | null)[]][] = [
    ["selected", () => [hud.token.token]],
    ["selected", () => canvas.tokens.controlled],
    ["targeted", () => [...game.user.targets]],
    ["persistent", () => hud.persistent.actor?.getActiveTokens() ?? []],
    ["character", () => game.user.character?.getActiveTokens() ?? []],
];

const DISTANCES: Record<Exclude<TooltipDistance, "never">, DistanceDetails> = {
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
const SETTING_DISTANCE = ["never", "idiot", "smart", "weird"] as const;

class TooltipPF2eHUD extends BaseTokenPF2eHUD<TooltipSettings, ActorPF2e> {
    #graphics: PIXI.Graphics | null = null;
    #targetToken: TokenPF2e | null = null;

    #closeTimeout = createTimeout(this.close.bind(this), { minDelay: DELAY_BUFFER });
    #renderTimeout = createTimeout(this.render.bind(this), { minDelay: DELAY_BUFFER });

    #mouseDownEvent = createToggleableEvent("mousedown", null, this._onMouseDown.bind(this));

    #canvasPanHook = createToggleableHook("canvasPan", this.#onCanvasPan.bind(this));
    #hoverTokenHook = createToggleableHook("hoverToken", this.#onHoverToken.bind(this));
    #canvasTearDownHook = createToggleableHook("canvasTearDown", this.#onCanvasTearDown.bind(this));

    #tokenRefreshWrapper = createToggleableWrapper(
        "WRAPPER",
        "CONFIG.Token.objectClass.prototype._refreshVisibility",
        this.#tokenRefreshVisibility,
        {
            context: this,
            onDisable: this.clearDistance.bind(this),
        },
    );

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-tooltip",
    };

    get settingsSchema(): HUDSettingsList<TooltipSettings> {
        return [
            {
                key: "distance",
                type: String,
                default: "idiot",
                scope: "user",
                choices: SETTING_DISTANCE,
                onChange: () => {
                    this.configurate();
                },
            },
            {
                key: "status",
                type: Boolean,
                default: true,
                scope: "user",
                onChange: () => {
                    this.configurate();
                },
            },
            {
                key: "delay",
                type: Number,
                default: 250,
                scope: "user",
                range: {
                    min: 0,
                    max: 2000,
                    step: 50,
                },
            },
            {
                key: "draw",
                type: Number,
                default: 4,
                scope: "user",
                range: {
                    min: 0,
                    max: 20,
                    step: 1,
                },
                onChange: () => {
                    this.configurate();
                },
            },
        ];
    }

    get key(): "tooltip" {
        return "tooltip";
    }

    get targetToken(): TokenPF2e | null {
        return this.#targetToken;
    }

    get distanceDetails(): WithRequired<DistanceDetails, "label"> | undefined {
        const setting = this.settings.distance;
        if (setting === "never") return;

        const details = DISTANCES[setting];
        details.label ??= localize("tooltip.distance", details.unit);

        return details as WithRequired<DistanceDetails, "label">;
    }

    protected _configurate(): void {
        const distanceEnabled = this.settings.distance !== "never";
        const drawEnabled = distanceEnabled && this.settings.draw > 0;
        const enabled = distanceEnabled || (this.settings.status && getHealthStatusData().enabled);

        this._toggleTokenHooks(enabled);
        this.#mouseDownEvent.toggle(enabled);
        this.#hoverTokenHook.toggle(enabled);

        this.#tokenRefreshWrapper.toggle(drawEnabled);
        this.#canvasTearDownHook.toggle(drawEnabled);

        if (enabled) {
            this.render();
        } else {
            this.close();
        }

        if (distanceEnabled && game.pf2e.settings.distanceDisplay !== "never") {
            game.settings.set("pf2e", "distanceDisplay", "never");
        }
    }

    init(): void {
        this._configurate();
    }

    renderWithDelay(force?: boolean, options?: ApplicationRenderOptions) {
        if (this.rendered) {
            this.render(force, options);
            return;
        }

        this.cancelClose();

        const delay = this.settings.delay;
        if (delay > 0) {
            this.#renderTimeout.startWithDelay(delay, true);
        } else {
            this.render(true, options);
        }
    }

    closeWithDelay(options?: ApplicationClosingOptions) {
        this.#closeTimeout.start(options);
    }

    cancelRender() {
        this.#renderTimeout.stop();
    }

    cancelClose() {
        this.clearDistance();
        this.#closeTimeout.stop();
    }

    clearDistance() {
        this.#graphics?.destroy({ children: true });
        this.#graphics = null;
    }

    drawDistance() {
        const thickness = this.settings.draw;
        if (thickness < 1 || !canvas.ready || !canvas.scene) return;

        const origin = this.token;
        const target = this.targetToken;
        if (!tokenCanDraw(origin) || !tokenCanDraw(target)) return;

        const graphics = (this.#graphics ??= canvas.interface.grid.addChild(new PIXI.Graphics()));
        const originCenter = origin.center;
        const targetCenter = target.center;
        const lineColor = game.user.color;
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

    protected _onSetToken(token: TokenPF2e): void {
        this.renderWithDelay();
    }

    protected async _prepareContext(options: ApplicationRenderOptions): Promise<TooltipContext> {
        const status = ((): TooltipContext["status"] => {
            if (!this.settings.status) return;

            const data = getHealthStatusData();
            if (!data.enabled) return;

            const actor = this.actor!;
            const health = calculateActorHealth(actor);
            if (!health) return;

            const label = data.getEntryFromHealthData(health);
            if (!label) return;

            return {
                label,
                hue: health.total.hue,
            };
        })();

        const distance = ((): TooltipContext["distance"] => {
            const details = this.distanceDetails;
            if (!details) return;

            let icon;
            const token = this.token!;

            for (const [type, getTargets] of TARGET_CHECKS) {
                const target = R.only(getTargets());
                if (!target || target === token) continue;

                icon = TARGET_ICONS[type];
                this.#targetToken = target;

                break;
            }

            if (!this.#targetToken) return;

            const gridUnits = canvas.grid.units;
            if (canvas.grid.units !== game.system.grid.units) {
                return {
                    icon: `<i class="${icon}"></i>`,
                    range: token.distanceTo(this.#targetToken).toFixed(0),
                    unit: gridUnits,
                };
            }

            const { multiplier, label, decimals } = details;

            return {
                icon: `<i class="${icon}"></i>`,
                range: (token.distanceTo(this.#targetToken) * multiplier).toFixed(decimals),
                unit: label,
            };
        })();

        return {
            distance,
            status,
        };
    }

    protected _renderHTML(context: ApplicationRenderContext, options: ApplicationRenderOptions): Promise<string> {
        return render("tooltip", context);
    }

    protected _replaceHTML(result: string, content: HTMLElement, options: ApplicationRenderOptions): void {
        content.innerHTML = result;
    }

    protected _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        this.cancelClose();
        this.drawDistance();
        this.#canvasPanHook.activate();
    }

    protected _onClose(options: ApplicationClosingOptions): void {
        this.#canvasPanHook.disable();
        return super._onClose(options);
    }

    protected _cleanupToken(): void {
        this.#targetToken = null;

        this.cancelRender();
        this.clearDistance();

        super._cleanupToken();
    }

    protected _updatePosition(position: ApplicationPosition) {
        super._updatePosition(position);

        const element = this.element;
        const wrapper = htmlQuery(element, ":scope > .wrapper");

        if (wrapper) {
            const hudBounds = element.getBoundingClientRect();
            const wrapperBounds = wrapper.getBoundingClientRect();

            wrapper.dataset.mode = hudBounds.top - wrapperBounds.height < 0 ? "bottom" : "top";
        }

        return position;
    }

    _onMouseDown() {
        this._cleanupToken();
        this.cancelRender();
        this.close();
    }

    #onCanvasPan() {
        requestAnimationFrame(() => {
            this.setPosition(this.position);
        });
    }

    #onCanvasTearDown() {
        this.clearDistance();
        this.setToken(null);
    }

    #onHoverToken(token: TokenPF2e, hovered: boolean) {
        if (hovered && !isHoldingModifierKey(["Shift", "Control"])) {
            this.#tokenHoverIn(token);
        } else {
            this.#tokenHoverOut(token);
        }
    }

    #tokenHoverIn(token: TokenPF2e) {
        if (window.document.querySelector(".app:hover")) return;

        const actor = token.actor;

        if (
            actor &&
            hud.token.token !== token &&
            (token.document.disposition !== CONST.TOKEN_DISPOSITIONS.SECRET || actor.isOwner)
        ) {
            this.setToken(token);
        }
    }

    #tokenHoverOut(token: TokenPF2e) {
        this._cleanupToken();
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

function tokenCanDraw(token: Maybe<TokenPF2e>): token is TokenPF2e {
    return !!token && token.visible && !token.isPreview && !token.isAnimating;
}

type TooltipContext = {
    status: { label: string; hue: number } | undefined;
    distance: { unit: string; icon: string; range: string } | undefined;
};

type TargetIcon = keyof typeof TARGET_ICONS;
type TooltipDistance = (typeof SETTING_DISTANCE)[number];

type TooltipSettings = {
    delay: number;
    distance: TooltipDistance;
    draw: number;
    status: boolean;
};

type DistanceDetails = {
    multiplier: number;
    unit: string;
    decimals: number;
    label?: string;
};

export { TooltipPF2eHUD };
