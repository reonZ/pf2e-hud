import {
    addListener,
    addListenerAll,
    confirmDialog,
    htmlQuery,
    isValidClickEvent,
    promptDialog,
    R,
    subLocalize,
    ValueAndMax,
} from "module-helpers";
import { addSidebarsListeners } from "../base/advanced";
import { PersistentContext, PersistentRenderOptions } from "../persistent";
import { getAdvancedStats, StatsAdvanced, ThreeStep } from "../shared/advanced";
import { addStatsAdvancedListeners } from "../shared/listeners";
import { getSidebars, SidebarMenu } from "../sidebar/base";
import { PersistentPart } from "./part";

const localize = subLocalize("persistent.main.shortcut");

class PersistentMain extends PersistentPart<MainContext | PersistentContext> {
    get shortcuts() {
        return this.hud.shortcuts;
    }

    async prepareContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<PersistentContext | MainContext> {
        const actor = this.actor;
        const worldActor = this.worldActor;

        if (!actor || !worldActor) {
            return context;
        }

        const data: MainContext = {
            ...context,
            ...getAdvancedStats(actor, this),
            sidebars: getSidebars(actor, this.sidebar?.key),
            showEffects: options.showEffects,
            shortcutsLocked: this.getSetting("lockShortcuts"),
            shortcutsSets: {
                value: 0,
                max: this.shortcuts.SHORTCUTS_LIST_LIMIT,
                min: 1,
            },
        };

        return data;
    }

    activateListeners(html: HTMLElement): void {
        const actor = this.actor;
        const worldActor = this.worldActor;
        if (!actor || !worldActor) return;

        addStatsAdvancedListeners(actor, html);
        addSidebarsListeners(this.hud, html);

        addListener(html, "[data-action='toggle-effects']", () => {
            this.setSetting("showEffects", !this.getSetting("showEffects"));
        });

        addListener(
            html,
            "[data-slider-action='change-shortcuts-list']",
            "mousedown",
            async (event, el) => {
                if (event.button === 1) {
                    const selectedIndex = this.shortcuts.shortcutSetIndex;

                    if (selectedIndex === 0) {
                        localize.warn("automation.zero");
                        return;
                    }

                    const value = this.shortcuts.automationUUID;
                    const legend = localize("automation.legend");
                    const hint = localize("automation.hint");

                    const content = `<fieldset>
                        <legend>${legend}</legend>
                        <input type="text" name="uuid" value="${value}">
                        <button type="button" class="reset">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                        <p class="hint">${hint}</p>
                    </fieldset>`;

                    const onRender = (_event: Event, html: HTMLDialogElement) => {
                        const input = htmlQuery(html, "input");
                        if (!input) return;

                        addListener(html, ".reset", () => {
                            input.value = "";
                        });

                        addListener(html, "fieldset", "drop", (event) => {
                            const { type, uuid } = TextEditor.getDragEventData(event);
                            if ((type === "Macro" || type === "Item") && R.isString(uuid)) {
                                input.value = uuid;
                            }
                        });
                    };

                    const result = await promptDialog<{ uuid: string }>(
                        {
                            title: localize("automation.title", { set: selectedIndex + 1 }),
                            content,
                            classes: ["pf2e-hud-persistent-automation"],
                            render: onRender,
                        },
                        { width: 420 }
                    );

                    if (result) {
                        await this.shortcuts.setAutomationUUID(result.uuid);
                    }

                    return;
                }

                if (!isValidClickEvent(event)) return;

                const direction = event.button === 0 ? 1 : -1;
                await this.hud.changeShortcutsSet(direction);
            }
        );

        addListenerAll(html, ".stretch .shortcut-menus [data-action]", async (event, el) => {
            const confirmAction = (key: string) => {
                const name = actor.name;
                const title = localize(key, "title");

                return confirmDialog({
                    title: `${name} - ${title}`,
                    content: localize(key, "message", { name }),
                });
            };

            switch (el.dataset.action as ShortcutMenusAction) {
                case "delete-shortcuts": {
                    if (await confirmAction("delete")) {
                        await this.shortcuts.deleteShortcuts();
                    }
                    break;
                }

                case "fill-shortcuts": {
                    if (await confirmAction("fill")) {
                        await this.shortcuts.fillShortcuts();
                    }
                    break;
                }

                case "copy-owner-shortcuts": {
                    if (await confirmAction("owner")) {
                        await this.shortcuts.copyOwnerShortcuts();
                    }
                    break;
                }

                case "toggle-shortcuts-lock": {
                    this.setSetting("lockShortcuts", !this.getSetting("lockShortcuts"));
                    break;
                }
            }
        });
    }
}

type ShortcutMenusAction =
    | "delete-shortcuts"
    | "fill-shortcuts"
    | "copy-owner-shortcuts"
    | "toggle-shortcuts-lock";

type MainContext = PersistentContext &
    StatsAdvanced & {
        sidebars: SidebarMenu[];
        showEffects: boolean;
        alliance?: ThreeStep;
        shortcutsSets: ValueAndMax & { min: number };
        shortcutsLocked: boolean;
    };

export { PersistentMain };
