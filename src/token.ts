import {
    R,
    addListener,
    addListenerAll,
    createHTMLFromString,
    createHook,
    elementData,
    getFlag,
    libWrapper,
    localizePath,
    registerWrapper,
    setFlag,
    signedInteger,
    templateLocalize,
} from "pf2e-api";
import { BaseTokenHUD, type BaseTokenHUDSettings } from "./hud";
import { ADJUSTMENTS, ADJUSTMENTS_INDEX, canObserve } from "./shared";

const SIDEBARS = {
    actions: { icon: "fa-solid fa-sword" },
    items: { icon: "fa-solid fa-backpack" },
    spells: { icon: "fa-solid fa-wand-magic-sparkles" },
    skills: { icon: "fa-solid fa-hand" },
    extras: { icon: "fa-solid fa-cubes" },
};

class PF2eHudToken extends BaseTokenHUD<TokenSettings, ActorType> {
    #canvasPanHook = createHook("canvasPan", () => this._updatePosition());

    #sidebarName: SidebarType | null = null;
    #sidebarElement: HTMLElement | null = null;
    #mainElement: HTMLElement | null = null;
    #initialized = false;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-token",
    };

    get templates(): ["main"] {
        return ["main"];
    }

    get key(): "token" {
        return "token";
    }

    get enabled() {
        return this.setting("enabled");
    }

    get mainElement() {
        return this.#mainElement;
    }

    get sidebarElement() {
        return this.#sidebarElement;
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
        const enabled = this.enabled;
        if (this.#initialized || !enabled) return enabled;

        super._onEnable();

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
            if (sheet.actor.uuid === this.actor?.uuid) this.close();
        });

        return true;
    }

    #clickClose() {
        const focused = document.activeElement as HTMLElement;

        if (focused?.closest("[id='pf2e-hud.token']")) {
            focused.blur();
        } else {
            this.close();
        }
    }

    async _prepareContext(options: ApplicationRenderOptions) {
        const token = this.token;
        const actor = token?.actor;
        if (!actor) return {};

        const parentData = await super._prepareContext(options);
        if (!parentData) return {};

        const isNPC = actor.isOfType("npc");
        const isCharacter = actor.isOfType("character");
        const { speeds } = parentData;

        const mainSpeed = (() => {
            if (!speeds?.length) return;

            const selectedSpeed = getFlag<MovementType>(actor, "speed");
            if (selectedSpeed) {
                const index = speeds.findIndex((speed) => speed.type === selectedSpeed);
                if (index !== -1) return speeds.splice(index, 1)[0];
            }

            const landSpeed = speeds[0];
            if (!this.setting("highestSpeed")) {
                return speeds.shift();
            }

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

            if (highestSpeeds.includes(landSpeed)) {
                return speeds.shift();
            }

            const highestSpeed = highestSpeeds[0];
            const index = speeds.findIndex((speed) => speed === highestSpeed);
            return speeds.splice(index, 1)[0];
        })();

        const scale = this.setting("scale");

        const otherSpeeds = speeds
            ?.map((speed) => `<i class="${speed.icon}"></i> <span>${speed.total}</span>`)
            .join("");

        return {
            ...parentData,
            i18n: templateLocalize("hud"),
            level: actor.level,
            shield: actor.attributes.shield,
            dying: isCharacter ? actor.attributes.dying : undefined,
            wounded: isCharacter ? actor.attributes.wounded : undefined,
            heroPoints: isCharacter ? actor.heroPoints : undefined,
            adjustment:
                (isNPC && ADJUSTMENTS[actor.attributes.adjustment ?? "normal"]) || undefined,
            resolve: isCharacter ? actor.system.resources.resolve : undefined,
            sidebars: Object.entries(SIDEBARS).map(([type, { icon }]) => ({
                type,
                icon,
                label: localizePath("token.sidebars", type, "title"),
                disabled: false,
            })),
            isFamiliar: actor.isOfType("familiar"),
            isCombatant: isCharacter || isNPC,
            mainSpeed,
            otherSpeeds: otherSpeeds
                ? `<div class="pf2e-hud-list" style="--font-size: ${scale}px">${otherSpeeds}</div>`
                : undefined,
            recall: isNPC ? actor.identificationDCs.standard.dc : undefined,
        };
    }

    _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        this.#canvasPanHook.activate();
    }

    async _renderHTML(context: ApplicationRenderContext, options: ApplicationRenderOptions) {
        return this.renderTemplate("main", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: ApplicationRenderOptions) {
        content.dataset.tokenUuid = this.token?.document.uuid;
        content.dataset.tooltipDirection = "UP";
        content.style.setProperty("--font-size", `${this.setting("scale")}px`);

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
        if (!actor?.isOwner || actor.isOfType("loot", "party") || actor.sheet.rendered) {
            token = null;
        }

        super.setToken(token as TokenPF2e<ActorType>);
    }

    close(options?: ApplicationClosingOptions): Promise<ApplicationV2> {
        this.#canvasPanHook.disable();
        return super.close(options);
    }

    #onActionListener(event: MouseEvent, el: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        const action = elementData<{ action: ActionEvent }>(el).action;

        switch (action) {
            case "change-speed": {
                const selected = elementData<{ speed: MovementType }>(el).speed;
                const speeds: MovementType[] = [
                    "land",
                    ...(actor as CreaturePF2e).attributes.speed.otherSpeeds.map(
                        (speed) => speed.type
                    ),
                ];
                const speedIndex = speeds.indexOf(selected);
                const newSpeed = speeds[(speedIndex + 1) % speeds.length];
                setFlag(actor, "speed", newSpeed);
                break;
            }
        }
    }

    #onToggleListener(event: MouseEvent, el: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        const action = elementData<{ toggleAction: ToggleEvent }>(el).toggleAction;
        const direction = event.type === "click" ? +1 : -1;

        switch (action) {
            case "adjustment": {
                const npc = actor as NPCPF2e;
                const currentAdjustment = npc.attributes.adjustment ?? null;
                const currentIndex = ADJUSTMENTS_INDEX.indexOf(currentAdjustment);
                const adjustment = ADJUSTMENTS_INDEX[Math.clamp(currentIndex + direction, 0, 2)];
                if (adjustment !== currentAdjustment) {
                    npc.applyAdjustment(adjustment);
                }
                break;
            }
            case "hero": {
                const { max, value } = (actor as CharacterPF2e).heroPoints;
                const newValue = Math.clamp(value + direction, 0, max);
                if (newValue !== value) {
                    actor.update({ "system.resources.heroPoints.value": newValue });
                }
                break;
            }
            case "dying":
            case "wounded": {
                const max = (actor as CharacterPF2e).system.attributes[action].max;
                if (direction === 1) {
                    actor.increaseCondition(action, { max });
                } else {
                    actor.decreaseCondition(action);
                }
                break;
            }
        }
    }

    #activateListeners(html: HTMLElement) {
        const actor = this.actor;
        const mainElement = this.mainElement;
        if (!actor || !mainElement) return;

        addListenerAll(
            mainElement,
            "[data-action]:not(.disabled)",
            this.#onActionListener.bind(this)
        );

        addListenerAll(
            mainElement,
            "[data-toggle-action]:not(.disabled)",
            "click",
            this.#onToggleListener.bind(this)
        );

        addListenerAll(
            mainElement,
            "[data-toggle-action]:not(.disabled)",
            "contextmenu",
            this.#onToggleListener.bind(this)
        );

        addListenerAll(html, "input[type='number']", "keyup", (event, el) => {
            if (event.key === "Enter") {
                el.blur();
            }
        });

        addListenerAll(html, "input[type='number']", "change", (event, el: HTMLInputElement) => {
            let path = el.name;
            let value = Math.max(el.valueAsNumber, 0);

            const cursor = foundry.utils.getProperty(actor, path);
            if (cursor === undefined || Number.isNaN(value)) return;

            if (
                R.isObjectType<{ value: number; max: number } | null>(cursor) &&
                "value" in cursor &&
                "max" in cursor
            ) {
                path += ".value";
                value = Math.min(el.valueAsNumber, cursor.max);
            }

            if (path === "system.attributes.shield.hp.value") {
                const heldShield = actor.isOfType("creature") ? actor.heldShield : undefined;
                if (heldShield) {
                    heldShield.update({ "system.hp.value": value });
                }
            } else {
                actor.update({ [path]: value });
            }
        });
    }
}

type ActionEvent =
    | "use-resolve"
    | "take-cover"
    | "raise-shield"
    | "show-notes"
    | "recovery-chec"
    | "recall-knowledge"
    | "roll-save"
    | "roll-other"
    | "open-sidebar"
    | "change-speed";

type ToggleEvent = "hero" | "wounded" | "dying" | "adjustment";

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
