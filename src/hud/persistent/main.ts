import {
    addListener,
    addListenerAll,
    confirmDialog,
    htmlQuery,
    isValidClickEvent,
    promptDialog,
    R,
    subLocalize,
} from "foundry-pf2e";
import { addSidebarsListeners } from "../base/advanced";
import { PersistentContext, PersistentRenderOptions, PF2eHudPersistent } from "../persistent";
import { getAdvancedStats, StatsAdvanced, ThreeStep } from "../shared/advanced";
import { addStatsAdvancedListeners } from "../shared/listeners";
import { getSidebars, SidebarMenu } from "../sidebar/base";
import {
    copyOwnerShortcuts,
    deleteShortcuts,
    fillShortcuts,
    getAutomationUUID,
    getShortcutSetIndex,
    setAutomationUUID,
    SHORTCUTS_LIST_LIMIT,
} from "./shortcuts";

const localize = subLocalize("persistent.main.shortcut");

async function prepareMainContext(
    this: PF2eHudPersistent,
    context: PersistentContext,
    options: PersistentRenderOptions
): Promise<MainContext | PersistentContext> {
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
        shortcutsSets: {
            value: 0,
            max: SHORTCUTS_LIST_LIMIT,
            min: 1,
        },
    };

    return data;
}

function activateMainListeners(this: PF2eHudPersistent, html: HTMLElement) {
    const actor = this.actor;
    const worldActor = this.worldActor;
    if (!actor || !worldActor) return;

    addStatsAdvancedListeners(this.actor, html);
    addSidebarsListeners(this, html);

    addListener(html, "[data-action='toggle-effects']", () => {
        this.setSetting("showEffects", !this.getSetting("showEffects"));
    });

    addListener(
        html,
        "[data-slider-action='change-shortcuts-list']",
        "mousedown",
        async (event, el) => {
            if (event.button === 1) {
                const selectedIndex = getShortcutSetIndex();

                if (selectedIndex === 0) {
                    localize.warn("automation.zero");
                    return;
                }

                const value = getAutomationUUID() ?? "";
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
                    await setAutomationUUID(result.uuid);
                }

                return;
            }

            if (!isValidClickEvent(event)) return;

            const direction = event.button === 0 ? 1 : -1;
            await this.changeShortcutsSet(direction);
        }
    );

    addListenerAll(html, ".stretch .shortcut-menus [data-action]", async (event, el) => {
        const action = el.dataset.action as ShortcutMenusAction;

        const confirmAction = (key: string) => {
            const name = actor.name;
            const title = localize(key, "title");

            return confirmDialog({
                title: `${name} - ${title}`,
                content: localize(key, "message", { name }),
            });
        };

        switch (action) {
            case "delete-shortcuts": {
                if (await confirmAction("delete")) {
                    await deleteShortcuts();
                }
                break;
            }

            case "fill-shortcuts": {
                if (await confirmAction("fill")) {
                    await fillShortcuts.call(this);
                }
                break;
            }

            case "copy-owner-shortcuts": {
                if (await confirmAction("owner")) {
                    await copyOwnerShortcuts();
                }
                break;
            }
        }
    });
}

type ShortcutMenusAction = "delete-shortcuts" | "fill-shortcuts" | "copy-owner-shortcuts";

type MainContext = PersistentContext &
    StatsAdvanced & {
        sidebars: SidebarMenu[];
        showEffects: boolean;
        alliance?: ThreeStep;
        shortcutsSets: ValueAndMax & { min: number };
    };

export { activateMainListeners, prepareMainContext };
export type { MainContext };
