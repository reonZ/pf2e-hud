import {
    R,
    createGlobalEvent,
    createHook,
    createTimeout,
    createWrapper,
    getOnly,
    libWrapper,
    saveTypes,
} from "pf2e-api";
import { BaseTokenHUD, canObserve, getActorHealth } from "./hud";
import { hud } from "./main";
import { signedInteger } from "pf2e-api/src/utils";

const DELAY_BUFFER = 50;

const SPEEDS = [
    { type: "land", icon: "fa-solid fa-shoe-prints" },
    { type: "burrow", icon: "fa-solid fa-chevrons-down" },
    { type: "climb", icon: "fa-solid fa-spider" },
    { type: "fly", icon: "fa-solid fa-feather" },
    { type: "swim", icon: "fa-solid fa-person-swimming" },
] as const;

const SPEEDS_ICONS = R.mapToObj(SPEEDS, ({ icon, type }) => [type, icon]);

const SAVES = [
    { slug: "fortitude", icon: "fa-solid fa-chess-rook", label: "PF2E.SavesFortitude" },
    { slug: "reflex", icon: "fa-solid fa-person-running", label: "PF2E.SavesReflex" },
    { slug: "will", icon: "fa-solid fa-brain", label: "PF2E.SavesWill" },
] as const;

const SAVES_ICONS = R.mapToObj(SAVES, ({ icon, slug }) => [slug, icon]);

const OTHER_STATISTICS = [
    { slug: "perception", icon: "fa-solid fa-eye", label: "PF2E.PerceptionLabel" },
    { slug: "stealth", icon: "fa-duotone fa-eye-slash", label: "PF2E.SkillStealth" },
    { slug: "athletics", icon: "fa-solid fa-hand-fist", label: "PF2E.SkillAthletics" },
] as const;

const OTHER_SLUGS = OTHER_STATISTICS.map((x) => x.slug);
const OTHER_ICONS = R.mapToObj(OTHER_STATISTICS, ({ icon, slug }) => [slug, icon]);

const TARGET_ICONS = {
    token: "fa-duotone fa-square-list",
    selected: "fa-solid fa-expand",
    targeted: "fa-solid fa-crosshairs-simple",
    persistent: "fa-solid fa-image-user",
    character: "fa-solid fa-user",
} as const;

const POSITIONS = {
    left: ["left", "right", "top", "bottom"],
    right: ["right", "left", "top", "bottom"],
    top: ["top", "bottom", "left", "right"],
    bottom: ["bottom", "top", "left", "right"],
} as const;

const SETTING_ENABLED = ["never", "small", "owned", "observed"] as const;
const SETTING_DISTANCE = ["never", "idiot", "smart", "weird"] as const;
const SETTING_NO_DEAD = ["none", "small", "full"] as const;
const SETTING_POSITION = R.keys.strict(POSITIONS);

class TooltipHUD extends BaseTokenHUD<TooltipSettings> {
    #hoverTokenHook = createHook("hoverToken", this.#onHoverToken.bind(this));
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteToken.bind(this));
    #updateTokenHook = createHook("updateToken", this.#onUpdateToken.bind(this));

    #renderTimeout = createTimeout(this.render.bind(this), DELAY_BUFFER);
    #closeTimeout = createTimeout(this.close.bind(this), DELAY_BUFFER);

    #clickEvent = createGlobalEvent("mousedown", () => this.close());

    #graphics: PIXI.Graphics | null = null;
    #targetToken: TokenPF2e | null = null;

    #tokenRefreshWrapper = createWrapper(
        "CONFIG.Token.objectClass.prototype._refreshVisibility",
        this.#tokenRefreshVisibility,
        {
            context: this,
            onDisable: this.clearDistance.bind(this),
        }
    );

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud.tooltip",
        position: {
            width: "auto",
            height: "auto",
        },
    };

    get templates(): ["tooltip"] {
        return ["tooltip"];
    }

    get key(): "tooltip" {
        return "tooltip";
    }

    get enabled(): boolean {
        const setting = this.setting("enabled");
        if (setting === "never") return false;
        if (setting !== "small") return true;
        return this.setting("showDistance") !== "never" || !!this.healthStatuses;
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
        const setting = this.setting("showDistance").split(",");
        return {
            multiplier: Number(setting[0]?.trim()) || 1,
            unit: setting[1]?.trim() || "ft.",
            decimals: Number(setting[2]?.trim()) || 0,
        };
    }

    get drawGraphics() {
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

        return (
            this.setting("drawDistance") > 0 &&
            isValidToken(this.token) &&
            isValidToken(this.targetToken)
        );
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
                type: String,
                choices: SETTING_ENABLED,
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
                key: "scale",
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

    async _prepareContext(options: ApplicationRenderOptions) {
        const token = this.token;
        const actor = token?.actor;
        if (!actor) return {};

        const distance = (() => {
            const user = game.user as UserPF2e;
            const checks: [TargetIcon, TokenPF2e[] | Set<TokenPF2e> | undefined][] = [
                ["token", R.compact([hud.token.token])],
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

            const { multiplier, unit, decimals } = this.distanceDetails;

            return {
                unit,
                icon: `<i class="${icon}"></i>`,
                range: (token.distanceTo(this.#targetToken) * multiplier).toFixed(decimals),
            };
        })();

        const isCharacter = actor.isOfType("character");
        const health = getActorHealth(actor);

        const status = (() => {
            if (!health) return;

            const statuses = this.healthStatuses;
            if (!statuses) return;

            let { value, max, ratio } = health.total;
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

        const data = {
            distance,
            status,
            isCharacter,
            health,
        };

        if (!health) return data;

        const setting = this.setting("enabled");
        const expended =
            (setting === "owned" && actor.isOwner) || (setting === "observed" && canObserve(actor));

        if (!expended) return data;

        const isNPC = actor.isOfType("npc");
        const isVehicle = actor.isOfType("vehicle");
        const isHazard = actor.isOfType("hazard");
        const isCreature = actor.isOfType("creature");
        const showModifiers = this.setting("modifiers");
        const speeds = isCreature
            ? R.pipe(
                  [
                      { type: "land", total: actor.attributes.speed.total },
                      ...actor.attributes.speed.otherSpeeds,
                  ] as const,
                  R.filter(({ total }) => typeof total === "number" && total > 0),
                  R.map(({ type, total }) => ({ icon: SPEEDS_ICONS[type], total }))
              )
            : [];

        const speedNote = isNPC
            ? actor.attributes.speed.details
            : isVehicle
            ? actor.system.details.speed
            : undefined;

        const getStatistics = (
            statistics: ReadonlyArray<string>,
            icons: Record<string, string>
        ) => {
            return R.pipe(
                statistics,
                R.map((slug) => {
                    const statistic = actor.getStatistic(slug);
                    if (!statistic) return;

                    const value = showModifiers ? signedInteger(statistic.mod) : statistic.dc.value;
                    return {
                        value,
                        icon: icons[statistic.slug],
                    };
                }),
                R.compact
            );
        };

        const saves = isCreature || isVehicle ? getStatistics(saveTypes, SAVES_ICONS) : [];
        const others = isCreature ? getStatistics(OTHER_SLUGS, OTHER_ICONS) : [];

        return {
            ...data,
            ac: actor.attributes.ac?.value,
            hardness: isVehicle || isHazard ? actor.attributes.hardness : undefined,
            saves,
            others,
            speeds,
            speedNote,
            expended,
            isHazard,
            isVehicle,
            isCreature,
            immunities: !!actor.attributes.immunities.length,
            resistances: !!actor.attributes.resistances.length,
            weaknesses: !!actor.attributes.weaknesses.length,
        };
    }

    async _renderHTML(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<string> {
        return await this.renderTemplate("tooltip", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: ApplicationRenderOptions) {
        content.dataset.tokenUuid = this.token?.document.uuid;
        content.style.setProperty("--font-size", `${this.setting("scale")}px`);
        content.innerHTML = result;
    }

    _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        this.cancelClose();
        this.drawDistance();
    }

    _updatePosition(position: ApplicationPosition) {
        const element = this.element;
        if (!element) return position;

        const token = this.token;
        if (!token?.actor) {
            position.left = -1000;
            position.top = -1000;

            element.style.left = `${-1000}px`;
            element.style.top = `${-1000}px`;

            return position;
        }

        const scale = token.worldTransform.a;
        const tokenCoords = canvas.clientCoordinatesFromCanvas(token);
        const targetCoords = {
            x: tokenCoords.x,
            y: tokenCoords.y,
            width: token.hitArea.width * scale,
            height: token.hitArea.height * scale,
            get right() {
                return this.x + this.width;
            },
            get bottom() {
                return this.y + this.height;
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
                    x: targetCoords.x - hudBounds.width,
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
                    y: targetCoords.y - hudBounds.height,
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
            element.style.left = `${coords.x}px`;
            element.style.top = `${coords.y}px`;

            position.left = coords.x;
            position.top = coords.y;
        }

        return super._updatePosition(position);
    }

    _onEnable(enabled: boolean) {
        this.#hoverTokenHook.toggle(enabled);
        this.#deleteTokenHook.toggle(enabled);
        this.#updateTokenHook.toggle(enabled);

        this.#clickEvent.toggle(enabled);

        this.#tokenRefreshWrapper.toggle(enabled && this.canDrawDistance);
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

    setToken(token: TokenPF2e<ActorPF2e> | null) {
        if (super.setToken(token)) {
            this.#targetToken = null;
            this.renderWithDelay();
            return true;
        }
        return false;
    }

    drawDistance() {
        if (!canvas.ready || !canvas.scene || !this.canDrawDistance) return;

        const origin = this.token!;
        const target = this.targetToken!;
        const graphics = this.drawGraphics;
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
        this.drawGraphics.clear();
    }

    #onHoverToken(token: TokenPF2e, hovered: boolean) {
        if (hovered) {
            this.#tokenHoverIn(token);
        } else {
            this.#tokenHoverOut(token);
        }
    }

    #onUpdateToken(tokenDocument: TokenDocumentPF2e, changed: Partial<TokenDocumentSource>) {
        if (tokenDocument.object === this.token && ("x" in changed || "y" in changed)) {
            this.close();
        }
    }

    #onDeleteToken(tokenDocument: TokenDocumentPF2e) {
        if (tokenDocument === this.token?.document) {
            this.close();
        }
    }

    #tokenHoverIn(token: TokenPF2e) {
        if (window.document.querySelector(".app:hover")) return;

        const actor = token.actor;

        if (
            !actor ||
            (token.document.disposition === CONST.TOKEN_DISPOSITIONS.SECRET && !actor.isOwner) ||
            (this.setting("noDead") === "none" && actor.isDead)
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
    targetCoords: { y: number; height: number },
    margin = 0
) {
    let y = targetCoords.y + targetCoords.height / 2 - bounds.height / 2;

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
    targetCoords: { x: number; width: number },
    margin = 0
) {
    let x = targetCoords.x + targetCoords.width / 2 - bounds.width / 2;

    if (x + bounds.width > window.innerWidth) {
        x = window.innerWidth - bounds.width;
    }

    if (x < 0) {
        x = margin;
    }

    return x;
}

type TooltipSettings = {
    status: string;
    enabled: (typeof SETTING_ENABLED)[number];
    delay: number;
    position: (typeof SETTING_POSITION)[number];
    scale: number;
    noDead: (typeof SETTING_NO_DEAD)[number];
    modifiers: boolean;
    showDistance: (typeof SETTING_DISTANCE)[number];
    drawDistance: number;
};

type TargetIcon = keyof typeof TARGET_ICONS;

export { TooltipHUD };
export type { TooltipSettings };
