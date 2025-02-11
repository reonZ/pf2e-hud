import {
    ApplicationConfiguration,
    ApplicationRenderOptions,
    R,
    TemplateLocalize,
    addListenerAll,
    error,
    getSetting,
    htmlClosest,
    htmlQuery,
    info,
    localize,
    render,
    setSetting,
    templateLocalize,
    waitDialog,
} from "module-helpers";

class HealthStatusMenu extends foundry.applications.api.ApplicationV2 {
    #status: HealthStatus;

    constructor(options: DeepPartial<ApplicationConfiguration> = {}) {
        options.window ??= {};
        options.window.title = localize("utils.healthStatus.title");

        super(options);

        this.#status = fu.deepClone(getHealthStatus());
    }

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-health-status",
    };

    protected async _prepareContext(options?: ApplicationRenderOptions): Promise<HealthStatusData> {
        const status = this.#status;
        const entries = R.pipe(
            status.entries,
            R.map((entry, i): HealthStatusDataEntry => {
                const previous = status.entries[i - 1]?.marker ?? 0;
                const next = status.entries[i + 1]?.marker ?? 100;
                const add =
                    next - entry.marker > 1 ? Math.floor((entry.marker + next) / 2) : undefined;

                return {
                    index: i,
                    marker: entry.marker,
                    label: entry.label,
                    min: previous + 1,
                    max: next - 1,
                    add,
                };
            }),
            R.sortBy([R.prop("index"), "desc"])
        );

        return {
            full: status.full,
            dead: status.dead,
            entries,
            enabled: getSetting("healthStatusEnabled"),
            i18n: templateLocalize("utils.healthStatus"),
        };
    }

    protected _renderHTML(context: object, options: ApplicationRenderOptions): Promise<string> {
        return render("health-status/menu", context);
    }

    protected _replaceHTML(
        result: string,
        content: HTMLElement,
        options: ApplicationRenderOptions
    ): void {
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
        addListenerAll(html, "input", "keyup", (event, el) => {
            if (event.key === "Enter") el.blur();
        });

        addListenerAll(html, "input[type='number']", "focus", (event, el: HTMLInputElement) => {
            el.select();
        });

        addListenerAll(html, "input[type='text']", "change", (event, el: HTMLInputElement) => {
            fu.setProperty(this.#status, el.name, el.value);
        });

        addListenerAll(html, "input[type='checkbox']", "change", (event, el: HTMLInputElement) => {
            setSetting(el.name, el.checked);
        });

        addListenerAll(
            html,
            ".value input:not(:disabled)",
            "change",
            (event, el: HTMLInputElement) => {
                const min = Number(el.min);
                const max = Number(el.max);

                fu.setProperty(this.#status, el.name, Math.clamp(el.valueAsNumber, min, max));
                this.render();
            }
        );

        addListenerAll(html, "[data-action]", (event, el) => {
            const index = Number(htmlClosest(el, "[data-index]")?.dataset.index);

            switch (el.dataset.action as EventAction) {
                case "add-entry": {
                    const marker = Number(el.dataset.marker);

                    this.#status.entries.splice(index + 1, 0, { label: "???", marker });
                    return this.render();
                }

                case "delete-entry": {
                    this.#status.entries.splice(index, 1);
                    return this.render();
                }

                case "export": {
                    game.clipboard.copyPlainText(JSON.stringify(this.#status));
                    info("utils.healthStatus.export.confirm");
                    return;
                }

                case "import": {
                    return this.#import();
                }

                case "save": {
                    setSetting("healthStatusData", this.#status);
                    return this.close();
                }

                case "cancel": {
                    return this.close();
                }
            }
        });
    }

    async #import() {
        const result = await waitDialog({
            title: localize("utils.healthStatus.import.label"),
            content: "<textarea></textarea>",
            yes: {
                label: localize("utils.healthStatus.import.yes"),
                icon: "fa-solid fa-file-import",
                callback: async (event, btn, html) => {
                    return htmlQuery(html, "textarea")?.value;
                },
            },
            no: {
                label: localize("utils.healthStatus.import.no"),
            },
        });

        if (!result) return;

        try {
            const status = JSON.parse(result as any);

            if (
                !R.isPlainObject(status) ||
                !R.isString(status.dead) ||
                !R.isString(status.full) ||
                !R.isArray(status.entries) ||
                !status.entries.every(
                    (entry): entry is HealthStatusEntry =>
                        R.isPlainObject(entry) &&
                        R.isString(entry.label) &&
                        R.isNumber(entry.marker)
                ) ||
                !status.entries.find((entry) => entry.marker === 0)
            ) {
                throw new Error();
            }

            this.#status = status as HealthStatus;
            this.render();
        } catch {
            error("utils.healthStatus.import.error");
        }
    }
}

function getHealthStatus() {
    return getSetting<Maybe<HealthStatus>>("healthStatusData") ?? getDefaultHealthStatus();
}

function getDefaultHealthStatus(statuses?: string[]): HealthStatus {
    const all = R.pipe(
        statuses ?? localize("utils.healthStatus.default").split(","),
        R.map((status) => status.trim()),
        R.filter(R.isTruthy)
    );

    const nbEntries = all.length - 1;
    const segment = 100 / (nbEntries - 1);
    const entries = R.pipe(
        R.range(1, nbEntries),
        R.map((i): HealthStatusEntry => {
            return {
                label: all[i],
                marker: Math.max(Math.floor((i - 1) * segment), 1),
            };
        })
    );

    return {
        dead: all[0],
        full: all.at(-1)!,
        entries,
    };
}

type EventAction = "add-entry" | "delete-entry" | "export" | "import" | "save" | "cancel";

type HealthStatusEntry = {
    marker: number;
    label: string;
};

type HealthStatus<T extends HealthStatusEntry = HealthStatusEntry> = {
    dead: string;
    full: string;
    entries: T[];
};

type HealthStatusDataEntry = HealthStatusEntry & {
    index: number;
    min: number;
    max: number;
    add: number | undefined;
};

type HealthStatusData = HealthStatus<HealthStatusDataEntry> & {
    enabled: boolean;
    i18n: TemplateLocalize;
};

export { HealthStatusMenu, getDefaultHealthStatus, getHealthStatus };
export type { HealthStatus };
