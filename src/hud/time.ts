import {
    addListenerAll,
    advanceTime,
    ApplicationConfiguration,
    createHook,
    getShortDateTime,
    getTimeWithSeconds,
    htmlQuery,
} from "module-helpers";
import { BaseRenderOptions, BaseSettings } from "./base/base";
import { PF2eHudDirectory } from "./base/directory";

class PF2eHudTime extends PF2eHudDirectory<TimeSettings, TimeRenderOptions> {
    #worldTimeHook = createHook("updateWorldTime", () => {
        this.render();
    });

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-time",
    };

    get SETTINGS_ORDER(): (keyof TimeSettings)[] {
        return ["enabled", "fontSize", "short"];
    }

    get key(): "time" {
        return "time";
    }

    get templates() {
        return ["hud"];
    }

    get worldTime() {
        return game.pf2e.worldClock.worldTime;
    }

    getSettings() {
        return super.getSettings().concat([
            {
                key: "short",
                type: Boolean,
                default: false,
                scope: "client",
                onChange: () => {
                    this.render();
                },
            },
        ]);
    }

    _onEnable(enabled = this.enabled) {
        this.#worldTimeHook.toggle(enabled);
        super._onEnable(enabled);
    }

    async _prepareContext(options: BaseRenderOptions): Promise<TimeContext> {
        const isGM = game.user.isGM;
        const worldTime = this.worldTime;
        const short = this.getSetting("short") ? getShortDateTime() : undefined;
        const { time, date } = game.pf2e.worldClock.getData();

        const slider = isGM ? worldTime.hour * 3600 + worldTime.minute * 60 : undefined;

        return {
            isGM,
            date,
            time,
            short,
            slider,
        };
    }

    async _renderHTML(context: TimeContext, options: TimeRenderOptions): Promise<string> {
        return await this.renderTemplate("hud", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: TimeRenderOptions): void {
        content.innerHTML = result;
        this.#activateListeners(content);
    }

    protected _insertElement(element: HTMLElement): HTMLElement {
        document.getElementById("sidebar")?.prepend(element);
        element.classList.toggle("is-gm", game.user.isGM);
        return element;
    }

    #activateListeners(html: HTMLElement) {
        addListenerAll(html, "[data-action]", (event, el) => {
            const action = el.dataset.action as EventAction;

            switch (action) {
                case "toggle-short": {
                    this.setSetting("short", !this.getSetting("short"));
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

type EventAction = "toggle-short" | "increment-time";

type TimeContext = {
    isGM: boolean;
    date: string;
    time: string;
    slider: number | undefined;
    short: { date: string; time: string } | undefined;
};

type TimeSettings = BaseSettings & {
    short: boolean;
};

type TimeRenderOptions = BaseRenderOptions;

export { PF2eHudTime };
