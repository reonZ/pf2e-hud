import {
    addListenerAll,
    advanceTime,
    ApplicationConfiguration,
    createHook,
    getShortDateTime,
    getTimeWithSeconds,
    htmlQuery,
    localize,
} from "module-helpers";
import { BaseRenderOptions, BaseSettings } from "./base/base";
import { PF2eHudDirectory } from "./base/directory";

const DIGIT_REGEX = /\d/g;
const WORD_REGEX = /\b([a-zA-Z\d]+?)\b/g;

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
            {
                key: "encrypted",
                type: Boolean,
                default: false,
                scope: "world",
                config: false,
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
        const data = game.pf2e.worldClock.getData();
        const encrypted = this.getSetting("encrypted");
        const slider = isGM ? worldTime.hour * 3600 + worldTime.minute * 60 : undefined;
        const short = this.getSetting("short") ? getShortDateTime() : undefined;

        if (!isGM && encrypted) {
            if (short) {
                data.date = "";
                short.date = short.date.replace(DIGIT_REGEX, "?");
                short.time = short.time.replace(DIGIT_REGEX, "?");
            } else {
                data.date = data.date.replace(WORD_REGEX, "???");
                data.time = data.time.replace(DIGIT_REGEX, "?");
            }
        }

        return {
            isGM,
            date: data.date,
            time: data.time,
            short,
            slider,
            encrypt: {
                encrypted,
                tooltip: localize("time.encrypt", encrypted ? "encrypted" : "clear"),
            },
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

                case "toggle-encrypted": {
                    this.setSetting("encrypted", !this.getSetting("encrypted"));
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

type EventAction = "toggle-short" | "increment-time" | "toggle-encrypted";

type TimeContext = {
    isGM: boolean;
    date: string;
    time: string;
    slider: number | undefined;
    encrypt: {
        encrypted: boolean;
        tooltip: string;
    };
    short: { date: string; time: string } | undefined;
};

type TimeSettings = BaseSettings & {
    short: boolean;
    encrypted: boolean;
};

type TimeRenderOptions = BaseRenderOptions;

export { PF2eHudTime };
