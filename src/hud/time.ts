import {
    addListenerAll,
    advanceTime,
    ApplicationConfiguration,
    createHook,
    getShortDateTime,
    runWhenReady,
} from "module-helpers";
import { BaseRenderOptions, BaseSettings, PF2eHudBase } from "./base/base";

class PF2eHudTime extends PF2eHudBase<TimeSettings, any, TimeRenderOptions> {
    #worldTimeHook = createHook("updateWorldTime", () => {
        this.render();
    });

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-time",
    };

    get SETTINGS_ORDER(): (keyof TimeSettings)[] {
        return ["enabled", "fontSize"];
    }

    get key(): "time" {
        return "time";
    }

    get templates() {
        return ["hud"];
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

        if (enabled && !this.rendered) {
            runWhenReady(() => this.render(true));
        } else if (!enabled && this.rendered) {
            this.close();
        }
    }

    async _prepareContext(options: BaseRenderOptions): Promise<TimeContext> {
        const short = this.getSetting("short") ? getShortDateTime() : undefined;

        return {
            ...game.pf2e.worldClock.getData(),
            short,
            isGM: game.user.isGM,
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
    }
}

type EventAction = "toggle-short" | "increment-time";

type TimeContext = {
    isGM: boolean;
    date: string;
    time: string;
    short: { date: string; time: string } | undefined;
};

type TimeSettings = BaseSettings & {
    short: boolean;
};

type TimeRenderOptions = BaseRenderOptions;

export { PF2eHudTime };
