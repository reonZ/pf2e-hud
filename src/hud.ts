import { getSetting, templatePath } from "pf2e-api";

abstract class BaseHUD<TSettings extends Record<string, any>> extends foundry.applications.api
    .ApplicationV2 {
    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        window: {
            frame: false,
            minimizable: false,
        },
    };

    abstract get templates(): string[];
    abstract get key(): string;
    abstract get enabled(): boolean;
    abstract get actor(): ActorPF2e | null;
    abstract get settings(): SettingOptions[];

    abstract _onEnable(enabled: boolean): void;

    enable = foundry.utils.debounce((enabled: boolean = this.enabled) => {
        this._onEnable(enabled);
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
    TSettings extends Record<string, any>,
    TActor extends ActorPF2e = ActorPF2e
> extends BaseHUD<TSettings> {
    #token: TokenPF2e<TActor> | null = null;

    get token() {
        return this.#token;
    }

    get actor() {
        return this.token?.actor ?? null;
    }

    async render(
        options: boolean | ApplicationRenderOptions = {},
        _options: ApplicationRenderOptions = {}
    ): Promise<ApplicationV2> {
        if (!this.actor) return this;
        return super.render(options, _options);
    }

    close(options?: ApplicationClosingOptions): Promise<ApplicationV2> {
        this.setToken(null);
        return super.close(options);
    }

    setToken(token: TokenPF2e<TActor> | null) {
        if (token === this.token) return false;

        delete this.actor?.apps[this.id];

        const actor = token?.actor;
        if (actor) {
            actor.apps[this.id] = this;
        }

        this.#token = token;
        return true;
    }
}

function canObserve(actor: ActorPF2e) {
    return (
        actor.testUserPermission(game.user, "OBSERVER") ||
        (getSetting("partyObserved") && actor.system.details.alliance === "party")
    );
}

function getActorHealth(actor: ActorPF2e) {
    const hp = actor.attributes.hp as CharacterHitPoints;
    if (!hp?.max) return;

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

    return {
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
}

export { BaseHUD, BaseTokenHUD, canObserve, getActorHealth };
