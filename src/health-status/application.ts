import {
    addEnterKeyListeners,
    addListenerAll,
    htmlClosest,
    htmlQuery,
    localize,
    R,
    render,
    waitDialog,
} from "foundry-helpers";
import { getHealthStatusData, setGlobalSetting } from "settings";
import { filterHealthStatusSourceEntries, HEALTH_STATUS_DEFAULT_LABEL, HealthStatus, zHealthStatusData } from ".";
import utils = foundry.utils;

class HealthStatusMenu extends foundry.applications.api.ApplicationV2 {
    #status: HealthStatus;

    constructor(options: DeepPartial<fa.ApplicationConfiguration> = {}) {
        super(options);
        this.#status = getHealthStatusData();
    }

    static DEFAULT_OPTIONS: DeepPartial<fa.ApplicationConfiguration> = {
        id: "pf2e-hud-health-status",
    };

    get title(): string {
        return localize("health-status.title");
    }

    protected async _prepareContext(_options?: fa.ApplicationRenderOptions): Promise<HealthStatuContext> {
        const status = this.#status;
        const entries = R.pipe(
            status.entries,
            R.map((entry, i): HealthStatusDataEntry => {
                const previous = status.entries[i - 1]?.marker ?? 0;
                const next = status.entries[i + 1]?.marker ?? 100;
                const add = next - entry.marker > 1 ? Math.floor((entry.marker + next) / 2) : undefined;

                return {
                    add,
                    index: i,
                    label: entry.label,
                    marker: entry.marker,
                    max: next - 1,
                    min: previous + 1,
                };
            }),
            R.sortBy([R.prop("index"), "desc"]),
        );

        return {
            dead: status.dead,
            enabled: status.enabled,
            full: status.full,
            entries,
        };
    }

    protected _renderHTML(context: object, _options: fa.ApplicationRenderOptions): Promise<string> {
        return render("health-status", context);
    }

    protected _replaceHTML(result: string, content: HTMLElement, _options: fa.ApplicationRenderOptions): void {
        const scrollPosition = htmlQuery(content, ".scroll")?.scrollTop;

        content.innerHTML = result;

        if (scrollPosition) {
            const scrollEl = htmlQuery(content, ".scroll");
            if (scrollEl) {
                scrollEl.scrollTop = scrollPosition;
            }
        }

        this.#activateListeners(content);
    }

    #activateListeners(html: HTMLElement) {
        addEnterKeyListeners(html);

        addListenerAll(html, "input[type='number']", "focus", (el: HTMLInputElement) => {
            el.select();
        });

        addListenerAll(html, "input[type='text']", "change", (el: HTMLInputElement) => {
            utils.setProperty(this.#status, el.name, el.value);
        });

        addListenerAll(html, "input[type='checkbox']", "change", (el: HTMLInputElement) => {
            this.#status.enabled = el.checked;
        });

        addListenerAll(html, "input[type='number']", "change", (el: HTMLInputElement) => {
            const min = Number(el.min);
            const max = Number(el.max);

            utils.setProperty(this.#status, el.name, Math.clamp(el.valueAsNumber, min, max));
        });

        addListenerAll(html, "[data-action]", (el) => {
            type EventAction = "add-entry" | "delete-entry" | "export" | "import" | "save" | "cancel";

            const action = el.dataset.action as EventAction;

            const getIndex = () => {
                const parent = htmlClosest(el, "[data-index]");
                return Number(parent?.dataset.index);
            };

            if (action === "add-entry") {
                const index = getIndex();
                const marker = Number(el.dataset.marker);

                this.#status.entries.splice(index + 1, 0, {
                    label: HEALTH_STATUS_DEFAULT_LABEL,
                    marker,
                });

                this.render();
            } else if (action === "cancel") {
                this.close();
            } else if (action === "delete-entry") {
                const index = getIndex();

                this.#status.entries.splice(index, 1);
                this.render();
            } else if (action === "export") {
                const data = R.omit(this.#status, ["enabled"]);

                game.clipboard.copyPlainText(JSON.stringify(data));
                localize.info("health-status.export.confirm");
            } else if (action === "import") {
                this.#import();
            } else if (action === "save") {
                const encoded = zHealthStatusData.encode(this.#status);
                setGlobalSetting("healthStatusData", encoded);
                this.close();
            }
        });
    }

    async #import() {
        const result = await waitDialog<{ data: string }>({
            content: `<textarea name="data" style="min-height: 300px;"></textarea>`,
            i18n: "health-status.import",
        });

        if (!result) return;

        try {
            const status = JSON.parse(result.data);

            if (
                !R.isPlainObject(status) ||
                !R.isString(status.dead) ||
                !R.isString(status.full) ||
                !R.isArray(status.entries) ||
                !status.entries.every((entry): entry is HealthStatusDataEntry => {
                    return R.isPlainObject(entry) && R.isString(entry.label) && R.isNumber(entry.marker);
                }) ||
                !status.entries.some((entry) => entry.marker === 1)
            ) {
                throw new Error();
            }

            foundry.utils.mergeObject(this.#status, R.pick(status, ["dead", "full", "entries"]));
            filterHealthStatusSourceEntries(this.#status);

            this.render();
        } catch {
            localize.error("health-status.import.error");
        }
    }
}

type HealthStatuContext = fa.ApplicationRenderContext & {
    dead: string;
    enabled: boolean;
    entries: HealthStatusDataEntry[];
    full: string;
};

type HealthStatusDataEntry = {
    marker: number;
    add: number | undefined;
    index: number;
    label: string;
    max: number;
    min: number;
};

export { HealthStatusMenu };
