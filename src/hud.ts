import { R, createHook, getHighestName, getSetting, saveTypes, templatePath } from "pf2e-api";
import { signedInteger } from "pf2e-api/src/utils";
import { OTHER_ICONS, OTHER_SLUGS, SAVES_ICONS, SPEEDS_ICONS, canObserve } from "./shared";

abstract class BaseHUD<TSettings extends Record<string, any>> extends foundry.applications.api
    .ApplicationV2 {
    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        window: {
            positioned: true,
            resizable: false,
            minimizable: false,
            frame: false,
        },
    };

    abstract get templates(): string[];
    abstract get key(): string;
    abstract get enabled(): boolean;
    abstract get actor(): ActorPF2e | null;
    abstract get settings(): SettingOptions[];

    abstract _onEnable(): boolean;

    enable = foundry.utils.debounce(() => {
        this._onEnable?.();
    }, 1);

    close(options: ApplicationClosingOptions = {}): Promise<ApplicationV2> {
        options.animate = false;
        return super.close(options);
    }

    setting<K extends keyof TSettings & string>(key: K): TSettings[K] {
        return getSetting(`${this.key}.${key}`);
    }

    renderTemplate(
        template: (typeof this)["templates"][number],
        context: ApplicationRenderContext
    ) {
        const path = templatePath(this.key, template);
        return renderTemplate(path, context);
    }

    async _preFirstRender(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<void> {
        await super._preFirstRender(context, options);

        const templates: Set<string> = new Set();

        for (const template of this.templates) {
            const path = templatePath(this.key, template);
            templates.add(path);
        }

        await loadTemplates(Array.from(templates));
    }
}

abstract class BaseTokenHUD<
    TSettings extends BaseTokenHUDSettings,
    TActor extends ActorPF2e = ActorPF2e
> extends BaseHUD<TSettings> {
    #deleteTokenHook = createHook("deleteToken", this.#onDeleteToken.bind(this));
    #updateTokenHook = createHook("updateToken", this.#onUpdateToken.bind(this));
    #tearDownHook = createHook("tearDownTokenLayer", () => this.close());

    #token: TokenPF2e<TActor> | null = null;

    get token() {
        return this.#token;
    }

    get actor() {
        return this.token?.actor ?? null;
    }

    abstract _onSetToken(token: TokenPF2e<TActor> | null): void;

    _onEnable() {
        const enabled = this.enabled;

        this.#deleteTokenHook.toggle(enabled);
        this.#updateTokenHook.toggle(enabled);
        this.#tearDownHook.toggle(enabled);

        return enabled;
    }

    async _prepareContext(options: ApplicationRenderOptions) {
        const token = this.token;
        const actor = token?.actor;
        if (!actor) return {};

        const hp = actor.attributes.hp as CharacterHitPoints;
        if (!hp?.max) return {};

        const isNPC = actor.isOfType("npc");
        const isArmy = actor.isOfType("army");
        const isHazard = actor.isOfType("hazard");
        const isVehicle = actor.isOfType("vehicle");
        const isCreature = actor.isOfType("creature");
        const isCharacter = actor.isOfType("character");
        const useStamina = isCharacter && game.pf2e.settings.variants.stamina;
        const currentHP = Math.clamp(hp.value, 0, hp.max);
        const maxSP = (useStamina && hp.sp?.max) || 0;
        const currentSP = Math.clamp((useStamina && hp.sp?.value) || 0, 0, maxSP);
        const currentTotal = currentHP + currentSP;
        const maxTotal = hp.max + maxSP;

        const calculateRation = (value: number, max: number) => {
            const ratio = value / max;
            return {
                ratio,
                hue: ratio * ratio * 122 + 3,
            };
        };

        const health = {
            value: currentHP,
            max: hp.max,
            ...calculateRation(currentHP, hp.max),
            temp: hp.temp,
            sp: {
                value: currentSP,
                max: maxSP,
                ...calculateRation(currentSP, maxSP),
            },
            useStamina,
            total: {
                value: currentTotal,
                max: maxTotal,
                ...calculateRation(currentTotal, maxTotal),
            },
        };

        const showModifiers = this.setting("modifiers");
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
                        slug,
                        value,
                        label: statistic.label,
                        icon: icons[statistic.slug],
                    };
                }),
                R.compact
            );
        };

        const saves = isCreature || isVehicle ? getStatistics(saveTypes, SAVES_ICONS) : [];
        const others = isCreature ? getStatistics(OTHER_SLUGS, OTHER_ICONS) : [];

        const speeds = isCreature
            ? R.pipe(
                  [actor.attributes.speed, ...actor.attributes.speed.otherSpeeds] as const,
                  R.filter(
                      ({ total, type }) =>
                          type === "land" || (typeof total === "number" && total > 0)
                  ),
                  R.map(({ type, total, label }) => ({
                      icon: SPEEDS_ICONS[type],
                      total,
                      label,
                      type,
                  }))
              )
            : [];

        const speedNote = isNPC
            ? actor.attributes.speed.details
            : isVehicle
            ? actor.system.details.speed
            : undefined;

        const isOwner = actor.isOwner;
        const isObserver = canObserve(actor);
        const name =
            isOwner || !game.pf2e.settings.tokens.nameVisibility || isObserver
                ? token.document.name
                : undefined;

        return {
            health,
            isNPC,
            isArmy,
            isHazard,
            isVehicle,
            isCreature,
            isCharacter,
            saves,
            others,
            speeds,
            speedNote,
            name,
            isOwner,
            isObserver,
            scouting: isArmy ? signedInteger(actor.scouting.mod) : undefined,
            ac: isArmy ? actor.system.ac.value : actor.attributes.ac?.value,
            hardness: isVehicle || isHazard ? actor.attributes.hardness : undefined,
        };
    }

    async render(
        options: boolean | ApplicationRenderOptions = {},
        _options: ApplicationRenderOptions = {}
    ): Promise<ApplicationV2> {
        if (!this.actor) return this;

        if (typeof options === "boolean") options = Object.assign(_options, { force: options });
        options.position = {} as ApplicationPosition;

        return super.render(options);
    }

    close(options?: ApplicationClosingOptions): Promise<ApplicationV2> {
        this.setToken(null);
        return super.close(options);
    }

    setToken(token: TokenPF2e<TActor> | null) {
        if (token === this.token) return;

        delete this.actor?.apps[this.id];

        const actor = token?.actor;
        if (actor) {
            actor.apps[this.id] = this;
        }

        this.#token = token;

        this._onSetToken(token);
    }

    getTokenPosition() {
        const token = this.token;
        if (!token?.actor) return;

        const scale = token.worldTransform.a;
        const tokenCoords = canvas.clientCoordinatesFromCanvas(token);

        return {
            x: tokenCoords.x,
            y: tokenCoords.y,
            width: token.hitArea.width * scale,
            height: token.hitArea.height * scale,
            get left() {
                return this.x;
            },
            get right() {
                return this.x + this.width;
            },
            get top() {
                return this.y;
            },
            get bottom() {
                return this.y + this.height;
            },
        };
    }

    moveOutOfScreen(position: ApplicationPosition) {
        const element = this.element;

        position.left = -1000;
        position.top = -1000;

        element.style.left = `${-1000}px`;
        element.style.top = `${-1000}px`;

        return position;
    }

    #onDeleteToken(tokenDocument: TokenDocumentPF2e) {
        if (tokenDocument === this.token?.document) {
            this.close();
        }
    }

    #onUpdateToken(tokenDocument: TokenDocumentPF2e, changed: Partial<TokenDocumentSource>) {
        if (tokenDocument.object === this.token && ("x" in changed || "y" in changed)) {
            this.close();
        }
    }
}

type BaseTokenHUDSettings = {
    modifiers: boolean;
};

export { BaseHUD, BaseTokenHUD };
export type { BaseTokenHUDSettings };
