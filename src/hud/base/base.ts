import {
    ApplicationClosingOptions,
    ApplicationConfiguration,
    getSetting,
    RegisterSettingOptions,
    setSetting,
} from "module-helpers";

abstract class BasePF2eHUD<
    TSettings extends Record<string, any> = Record<string, any>
> extends foundry.applications.api.ApplicationV2 {
    #settings: Record<string, any> = {};

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        window: {
            resizable: false,
            minimizable: false,
            frame: false,
        },
        classes: ["pf2e-hud-element"],
    };

    declare settings: TSettings;

    abstract get key(): string;
    abstract get settingsSchema(): HUDSettingsList<TSettings>;

    get keybindsSchema(): KeybindingActionConfig[] {
        return [];
    }

    init(isGM: boolean) {}
    ready(isGM: boolean) {}
    protected _configurate() {}

    configurate = foundry.utils.debounce(this._configurate, 1);

    async close(options: ApplicationClosingOptions = {}) {
        options.animate = false;
        return super.close(options);
    }

    getSettingKey<K extends keyof TSettings & string>(setting: K): string {
        return `${this.key}.${setting}`;
    }

    _initialize() {
        const settings = {};
        const self = this;

        for (const setting of this.settingsSchema) {
            const key = this.getSettingKey(setting.key);
            this.#settings[key] = getSetting(key);

            Object.defineProperty(settings, setting.key, {
                get() {
                    return self.#settings[key];
                },
                set(value) {
                    setSetting(key, value);
                },
            });
        }

        Object.defineProperty(this, "settings", {
            get() {
                return settings;
            },
        });
    }

    _getHudSettings(): HUDSettingsList<TSettings> {
        return this.settingsSchema.map((setting) => {
            const _onChange = setting.onChange;

            setting.onChange = (value, operation, userId) => {
                this.#settings[setting.key] = value;
                _onChange?.(value, operation, userId);
            };

            return setting;
        });
    }
}

type HUDSetting<TSettings extends Record<string, any>> = TSettings extends Record<infer K, infer V>
    ? RegisterSettingOptions & { key: K; type: FromPrimitive<V> }
    : never;

type HUDSettingsList<TSettings extends Record<string, any>> = Array<HUDSetting<TSettings>>;

export { BasePF2eHUD };
export type { HUDSettingsList };
