import {
    R,
    createHTMLFromString,
    createHook,
    getFlag,
    libWrapper,
    localizePath,
    registerWrapper,
} from "pf2e-api";
import { BaseActorContext, BaseTokenContext, BaseTokenHUD, type BaseTokenHUDSettings } from "./hud";
import { hud } from "./main";
import {
    ADJUSTMENTS,
    SHARED_PARTIALS,
    addArmorListeners,
    addSharedListeners,
    addUpdateActorFromInput,
    getCoverEffect,
} from "./shared";

const SIDEBARS = {
    actions: { icon: "fa-solid fa-sword" },
    items: { icon: "fa-solid fa-backpack" },
    spells: { icon: "fa-solid fa-wand-magic-sparkles" },
    skills: { icon: "fa-solid fa-hand" },
    extras: { icon: "fa-solid fa-cubes" },
};

class PF2eHudToken extends BaseTokenHUD<TokenSettings, ActorType> {
    #canvasPanHook = createHook("canvasPan", () => this._updatePosition());

    #mainElement: HTMLElement | null = null;
    #initialized = false;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-token",
    };

    get partials() {
        return SHARED_PARTIALS;
    }

    get templates(): ["main"] {
        return ["main"];
    }

    get key(): "token" {
        return "token";
    }

    get enabled() {
        return this.setting("enabled");
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
                key: "scaleDimensions",
                type: Boolean,
                default: false,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "scale",
                type: Number,
                range: {
                    min: 10,
                    max: 50,
                    step: 1,
                },
                default: 14,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "mode",
                type: String,
                choices: ["exploded", "left", "right"],
                default: "exploded",
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
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
                event: PIXI.FederatedEvent
            ) {
                wrapped(event);
                if (game.activeTool !== "select") return;
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
                event: PIXI.FederatedEvent
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

    async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<TokenContext | TokenContextBase> {
        const parentData = await super._prepareContext(options);
        if (!("health" in parentData)) return parentData;

        const actor = this.token!.actor!;
        const isNPC = actor.isOfType("npc");
        const isCharacter = actor.isOfType("character");
        const { speeds } = parentData as BaseTokenContext;

        const mainSpeed = (() => {
            if (!speeds?.length) return;

            const selectedSpeed = getFlag<MovementType>(actor, "speed");
            if (selectedSpeed) {
                const index = speeds.findIndex((speed) => speed.type === selectedSpeed);
                if (index !== -1) return speeds.splice(index, 1)[0];
            }

            const landSpeed = speeds[0];
            if (!this.setting("highestSpeed")) return speeds.shift();

            const [_, highestSpeeds] =
                speeds.length === 1
                    ? ["", speeds]
                    : R.pipe(
                          speeds,
                          R.groupBy((x) => x.total),
                          R.toPairs.strict,
                          R.sortBy([(x) => Number(x[0]), "desc"]),
                          R.first()
                      )!;
            if (highestSpeeds.includes(landSpeed)) return speeds.shift();

            const highestSpeed = highestSpeeds[0];
            const index = speeds.findIndex((speed) => speed === highestSpeed);

            return speeds.splice(index, 1)[0];
        })();

        const scale = this.setting("scale");
        const otherSpeeds = speeds
            ?.map((speed) => `<i class="${speed.icon}"></i> <span>${speed.total}</span>`)
            .join("");

        const sidebars = Object.entries(SIDEBARS).map(([type, { icon }]) => ({
            type,
            icon,
            label: localizePath("token.sidebars", type, "title"),
            disabled: false,
        }));

        const data: TokenContext = {
            ...parentData,
            sidebars,
            mainSpeed,
            level: actor.level,
            isFamiliar: actor.isOfType("familiar"),
            isCombatant: isCharacter || isNPC,
            hasCover: !!getCoverEffect(actor),
            shield: isCharacter || isNPC ? actor.attributes.shield : undefined,
            dying: isCharacter ? actor.attributes.dying : undefined,
            wounded: isCharacter ? actor.attributes.wounded : undefined,
            resolve: isCharacter ? actor.system.resources.resolve : undefined,
            adjustment:
                (isNPC && ADJUSTMENTS[actor.attributes.adjustment ?? "normal"]) || undefined,
            otherSpeeds: otherSpeeds
                ? `<div class="pf2e-hud-list" style="--font-size: ${scale}px">${otherSpeeds}</div>`
                : undefined,
        };

        return data;
    }

    _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        this.#canvasPanHook.activate();
    }

    async _renderHTML(context: Partial<TokenContext>, options: ApplicationRenderOptions) {
        return this.renderTemplate("main", context);
    }

    _insertElement(element: HTMLElement) {
        element.dataset.tooltipDirection = "UP";
        super._insertElement(element);
    }

    _replaceHTML(result: string, content: HTMLElement, options: ApplicationRenderOptions) {
        content.dataset.tokenUuid = this.token?.document.uuid;
        content.style.setProperty("--font-size", `${this.setting("scale")}px`);

        const focusName = this.#mainElement?.querySelector<HTMLInputElement>("input:focus")?.name;

        this.#mainElement?.remove();
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

        content.replaceChildren(this.#mainElement);
        this.#activateListeners(content);
    }

    _updatePosition(position: ApplicationPosition = {} as ApplicationPosition) {
        const element = this.element;
        if (!element) return position;

        const token = this.token;
        if (!token?.actor) return this.moveOutOfScreen(position);

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

        element.style.left = `${canvasPosition.x}px`;
        element.style.top = `${canvasPosition.y}px`;
        element.style.width = `${canvasDimensions.width * usedScale}px`;
        element.style.height = `${canvasDimensions.height * usedScale}px`;
        element.style.transform = `scale(${scaleDimensions ? scale : 1})`;

        if (mainElement) {
            const tokenBounds = token.bounds;
            const tokenDimensions = token.document;
            const ratio = canvas.dimensions.size / 100;

            mainElement.style.left = `${tokenBounds.left * usedScale}px`;
            mainElement.style.top = `${tokenBounds.top * usedScale}px`;
            mainElement.style.width = `${tokenDimensions.width * ratio * 100 * usedScale}px`;
            mainElement.style.height = `${tokenDimensions.height * ratio * 100 * usedScale}px`;
        }

        return position;
    }

    _onSetToken(token: TokenPF2e<ActorPF2e> | null) {
        this.render(true);
    }

    setToken(token: TokenPF2e | null | false) {
        if (!token) return super.setToken(token);

        const actor = token?.actor;
        if (
            !actor?.isOwner ||
            actor.isOfType("loot", "party") ||
            actor.sheet.rendered ||
            hud.persistent.isCurrentActor(actor)
        ) {
            token = null;
        }

        super.setToken(token as TokenPF2e<ActorType>);
    }

    close(options?: ApplicationClosingOptions): Promise<ApplicationV2> {
        this.#canvasPanHook.disable();
        return super.close(options);
    }

    #clickClose() {
        const focused = document.activeElement as HTMLElement;

        if (focused?.closest("[id='pf2e-hud.token']")) {
            focused.blur();
        } else {
            this.close();
        }
    }

    #activateListeners(html: HTMLElement) {
        const actor = this.actor;
        const mainElement = this.mainElement;
        if (!actor || !mainElement) return;

        addUpdateActorFromInput(mainElement, actor);
        addSharedListeners(mainElement, actor);
        addArmorListeners(mainElement, actor, this.token);
    }
}

type TokenContextBase = BaseActorContext;

type TokenContext = BaseTokenContext & {
    mainSpeed:
        | {
              icon: string;
              total: number;
              label: string;
              type: "land" | "burrow" | "climb" | "fly" | "swim";
          }
        | undefined;
    otherSpeeds: string | undefined;
    level: number;
    dying: ValueAndMax | undefined;
    wounded: ValueAndMax | undefined;
    adjustment: (typeof ADJUSTMENTS)[keyof typeof ADJUSTMENTS] | undefined;
    resolve: ValueAndMax | undefined;
    isFamiliar: boolean;
    isCombatant: boolean;
    hasCover: boolean;
    shield: HeldShieldData | undefined;
    sidebars: {
        type: string;
        icon: string;
        label: `${string}.${string}`;
        disabled: boolean;
    }[];
    partial: (key: string) => string;
};

type ActionEvent =
    | "use-resolve"
    | "take-cover"
    | "raise-shield"
    | "show-notes"
    | "recovery-chec"
    | "recall-knowledge"
    | "roll-statistic"
    | "open-sidebar"
    | "change-speed";

type SliderEvent = "hero" | "wounded" | "dying" | "adjustment";

type SidebarType = keyof typeof SIDEBARS;

type TokenSettings = BaseTokenHUDSettings & {
    enabled: boolean;
    scaleDimensions: boolean;
    mode: "exploded" | "left" | "right";
    scale: number;
    highestSpeed: boolean;
};

type ActorType = Exclude<ActorInstances[keyof ActorInstances], LootPF2e | PartyPF2e>;

export { PF2eHudToken };
