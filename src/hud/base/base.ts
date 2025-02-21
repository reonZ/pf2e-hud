import {
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    R,
    getFlag,
    getSetting,
    render,
    setFlag,
    setSetting,
    settingPath,
    templatePath,
} from "module-helpers";
import { getHealthStatus } from "../../utils/health-status";
import { HealthData } from "../shared/base";

const GLOBAL_SETTINGS: ReadonlyArray<keyof GlobalSettings> = [
    "highestSpeed",
    "useModifiers",
    "partyAsObserved",
] as const;

abstract class PF2eHudBase<
    TSettings extends BaseSettings = BaseSettings,
    TUserSettings extends Record<string, any> = Record<string, any>,
    TRenderOptions extends BaseRenderOptions = BaseRenderOptions
> extends foundry.applications.api.ApplicationV2<ApplicationConfiguration, TRenderOptions> {
    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        window: {
            resizable: false,
            minimizable: false,
            frame: false,
        },
        classes: ["pf2e-hud"],
    };

    abstract get key(): string;
    abstract get templates(): string[];
    abstract get SETTINGS_ORDER(): (keyof TSettings)[];

    get SUB_SETTINGS_ORDER(): (keyof TSettings)[] {
        return [];
    }

    get requiresReload(): boolean {
        return false;
    }

    getSettings(): SettingOptions[] {
        return [
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "client",
                name: settingPath("shared.enabled.name"),
                hint: settingPath("shared.enabled.hint"),
                requiresReload: this.requiresReload,
                onChange: () => {
                    this.enable();
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
                name: settingPath("shared.fontSize.name"),
                hint: settingPath("shared.fontSize.hint"),
                onChange: () => {
                    this.render();
                },
            },
        ];
    }

    get enabled(): boolean {
        return this.getSetting("enabled");
    }

    abstract _onEnable(enabled?: boolean): void;

    _configureRenderOptions(options: TRenderOptions) {
        super._configureRenderOptions(options);
        options.fontSize = this.getSetting("fontSize");
    }

    async _preFirstRender(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<void> {
        const templates: Set<string> = new Set();

        for (const template of this.templates) {
            const path = templatePath(this.key, template);
            templates.add(path);
        }

        await loadTemplates(Array.from(templates));
    }

    enable = foundry.utils.debounce((enabled?: boolean) => {
        this._onEnable?.(enabled);
    }, 1);

    async render(
        options?: boolean | DeepPartial<TRenderOptions>,
        _options?: DeepPartial<TRenderOptions>
    ) {
        if (!this.enabled) return this;
        return super.render(options, _options);
    }

    async close(options: ApplicationClosingOptions = {}) {
        options.animate = false;
        return super.close(options);
    }

    renderTemplate(
        template: (typeof this)["templates"][number],
        context: ApplicationRenderContext
    ) {
        return render(this.key, template, context);
    }

    getSetting<K extends keyof TSettings & string>(key: K): TSettings[K];
    getSetting<K extends keyof GlobalSettings & string>(key: K): GlobalSettings[K];
    getSetting(key: (keyof TSettings | keyof GlobalSettings) & string) {
        if (GLOBAL_SETTINGS.includes(key as keyof GlobalSettings)) {
            return getSetting(key);
        }

        return getSetting(`${this.key}.${key}`);
    }

    setSetting<K extends keyof TSettings & string>(key: K, value: TSettings[K]) {
        return setSetting(`${this.key}.${key}`, value);
    }

    getUserSetting<TKey extends keyof TUserSettings & string>(key: TKey) {
        return getFlag<TUserSettings[TKey]>(game.user, this.key, key);
    }

    setUserSetting<TKey extends keyof TUserSettings & string>(
        key: TKey,
        value: TUserSettings[TKey]
    ) {
        return setFlag(game.user, this.key, key, value);
    }

    getSelectedHealthStatusEntry(health: HealthData, status = getHealthStatus()): string {
        let { value, max, ratio } = health.total;
        value = Math.clamp(value, 0, max);

        if (value === 0) {
            return status.dead;
        }

        if (value === max) {
            return status.full;
        }

        const percent = ratio * 100;

        return (
            R.pipe(
                status.entries,
                R.sortBy([R.prop("marker"), "desc"]),
                R.find((entry) => percent >= entry.marker)
            )?.label ?? "???"
        );
    }
}

type GlobalSettings = {
    useModifiers: boolean;
    highestSpeed: boolean;
    partyAsObserved: boolean;
};

type BaseSettings = {
    fontSize: number;
    enabled: boolean;
};

type BaseRenderOptions = ApplicationRenderOptions & {
    fontSize: number;
};

export { PF2eHudBase };
export type { BaseRenderOptions, BaseSettings, GlobalSettings };
