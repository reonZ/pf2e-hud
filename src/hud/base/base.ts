import {
    getFlag,
    getSetting,
    render,
    setFlag,
    setSetting,
    settingPath,
    templatePath,
} from "foundry-pf2e";

const GLOBAL_SETTINGS: ReadonlyArray<keyof GlobalSettings> = [
    "highestSpeed",
    "useModifiers",
] as const;

abstract class PF2eHudBase<
    TSettings extends BaseSettings = BaseSettings,
    TUserSettings extends Record<string, any> = Record<string, any>
> extends foundry.applications.api.ApplicationV2<ApplicationConfiguration> {
    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        window: {
            resizable: false,
            minimizable: false,
            frame: false,
        },
    };

    abstract get key(): string;
    abstract get templates(): string[] | ReadonlyArray<string>;
    abstract get SETTINGS_ORDER(): (keyof TSettings)[];

    getSettings(): SettingOptions[] {
        return [
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "client",
                name: settingPath("shared.enabled.name"),
                hint: settingPath("shared.enabled.hint"),
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

    _configureRenderOptions(options: BaseRenderOptions) {
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

    async close(options: ApplicationClosingOptions = {}): Promise<this> {
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
    getSetting<K extends (keyof TSettings | keyof GlobalSettings) & string>(key: K) {
        if (GLOBAL_SETTINGS.includes(key)) return getSetting(key);
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
}

interface PF2eHudBase<TSettings extends BaseSettings>
    extends foundry.applications.api.ApplicationV2<ApplicationConfiguration> {
    get keybinds(): KeybindingActionConfig[] | undefined;
}

type GlobalSettings = {
    useModifiers: boolean;
    highestSpeed: boolean;
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
