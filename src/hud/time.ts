import {
    addListenerAll,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    createHook,
    DateTime,
    htmlQuery,
    settingPath,
} from "module-helpers";
import { FoundrySidebarPF2eHUD, HUDSettingsList } from "./base";

class TimePF2eHUD extends FoundrySidebarPF2eHUD<TimeSettings> {
    #worldTimeHook = createHook("updateWorldTime", () => {
        this.render();
    });

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-time",
    };

    get settingsSchema(): HUDSettingsList<TimeSettings> {
        return [
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "user",
                name: settingPath("enabled.name"),
                onChange: (value: boolean) => {
                    this.configurate();
                },
            },
            {
                key: "short",
                type: Boolean,
                default: false,
                scope: "user",
                config: false,
                onChange: () => {
                    this.render();
                },
            },
        ];
    }

    get key(): "time" {
        return "time";
    }

    get beforeElement(): HTMLElement | null {
        return this.chatElement;
    }

    get enabledForPlayers(): boolean {
        return game.pf2e.settings.worldClock.playersCanView;
    }

    get worldTime() {
        return game.pf2e.worldClock.worldTime;
    }

    protected _configurate(): void {
        if (this.settings.enabled && (game.user.isGM || this.enabledForPlayers)) {
            this.render(true);
        } else {
            this.close();
        }
    }

    protected async _prepareContext(options: ApplicationRenderOptions): Promise<TimeContext> {
        const isGM = game.user.isGM;
        const worldTime = this.worldTime;
        const data = await game.pf2e.worldClock["_prepareContext"](options);
        const slider = isGM ? worldTime.hour * 3600 + worldTime.minute * 60 : undefined;
        const short = this.settings.short ? getShortDateTime() : undefined;

        return {
            isGM,
            date: data.date,
            time: data.time,
            short,
            slider,
        };
    }

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        this.#worldTimeHook.activate();
    }

    protected _onClose(options: ApplicationClosingOptions): void {
        this.#worldTimeHook.disable();
        super._onClose(options);
    }

    _activateListeners(html: HTMLElement): void {
        addListenerAll(html, "[data-action]", (el) => {
            type EventAction = "toggle-short" | "increment-time" | "toggle-encrypted";

            const action = el.dataset.action as EventAction;

            switch (action) {
                case "toggle-short": {
                    this.settings.short = !this.settings.short;
                    break;
                }

                case "increment-time": {
                    const interval = el.dataset.increment as `${number}`;
                    const direction = el.dataset.direction as "+" | "-";
                    advanceTime(interval, direction);
                    break;
                }
            }
        });

        if (!game.user.isGM) return;

        const slider = htmlQuery<HTMLInputElement>(html, "input[name='time-slider']");
        const timeSpan = htmlQuery(html, ".time span");

        if (slider && timeSpan) {
            const worldTime = this.worldTime;
            const extraSeconds = worldTime.second;
            const originalValue = Number(slider.dataset.value);

            const getDiff = (milliseconds?: boolean) => {
                const newValue = slider.valueAsNumber;
                const diff = newValue - originalValue - extraSeconds;
                return milliseconds ? diff * 1000 : diff;
            };

            slider.addEventListener("input", () => {
                const time = worldTime.plus(getDiff(true));
                timeSpan.innerText = getTimeWithSeconds(time);
            });

            slider.addEventListener("change", () => {
                const diff = getDiff();
                advanceTime(Math.abs(diff), diff < 0 ? "-" : "+");
            });
        }
    }
}

function advanceTime(interval: TimeInterval, direction: "+" | "-") {
    const sign = direction === "+" ? 1 : -1;
    const increment = Number(interval) * sign;

    if (increment !== 0) {
        game.time.advance(increment);
    }
}

function getTimeWithSeconds(time: DateTime) {
    return game.pf2e.worldClock.timeConvention === 24
        ? time.toFormat("HH:mm:ss")
        : time.toLocaleString(DateTime.TIME_WITH_SECONDS);
}

function getShortTime(time: DateTime) {
    return game.pf2e.worldClock.timeConvention === 24
        ? time.toFormat("HH:mm")
        : time.toLocaleString(DateTime.TIME_SIMPLE);
}

function getShortDateTime() {
    const worldClock = game.pf2e.worldClock;
    const worldTime = worldClock.worldTime;
    const time = getShortTime(worldTime);

    const date =
        worldClock.dateTheme === "CE"
            ? worldTime.toLocaleString(DateTime.DATE_SHORT)
            : DateTime.local(worldClock["year"], worldTime.month, worldTime.day).toLocaleString(
                  DateTime.DATE_SHORT
              );

    return {
        worldClock,
        worldTime,
        time,
        date,
    };
}

type TimeInterval = "dawn" | "noon" | "dusk" | "midnight" | `${number}` | number;

type TimeContext = {
    isGM: boolean;
    date: string;
    time: string;
    slider: number | undefined;
    short: { date: string; time: string } | undefined;
};

type TimeSettings = {
    enabled: boolean;
    short: boolean;
};

export { TimePF2eHUD };
