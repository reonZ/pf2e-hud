import { addListener, addListenerAll, confirmDialog, localize } from "foundry-pf2e";
import { addSidebarsListeners } from "../base/advanced";
import { PersistentContext, PersistentRenderOptions, PF2eHudPersistent } from "../persistent";
import { getAdvancedStats, StatsAdvanced, ThreeStep } from "../shared/advanced";
import { addStatsAdvancedListeners } from "../shared/listeners";
import { getSidebars, SidebarMenu } from "../sidebar/base";
import { copyOwnerShortcuts, deleteShortcuts, fillShortcuts } from "./shortcuts";

async function prepareMainContext(
    this: PF2eHudPersistent,
    context: PersistentContext,
    options: PersistentRenderOptions
): Promise<MainContext | PersistentContext> {
    const actor = this.actor;

    if (!actor) {
        return context;
    }

    const data: MainContext = {
        ...context,
        ...getAdvancedStats(actor, this),
        sidebars: getSidebars(actor, this.sidebar?.key),
        showEffects: options.showEffects,
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

    addListenerAll(html, ".stretch .shotcut-menus [data-action]", async (event, el) => {
        const action = el.dataset.action as ShortcutMenusAction;

        const confirmAction = (key: string) => {
            const name = actor.name;
            const title = localize("persistent.main.shortcut", key, "title");

            return confirmDialog({
                title: `${name} - ${title}`,
                content: localize("persistent.main.shortcut", key, "message", { name }),
            });
        };

        switch (action) {
            case "delete-shortcuts": {
                if (await confirmAction("delete")) {
                    await deleteShortcuts(worldActor);
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
                    await copyOwnerShortcuts(worldActor);
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
    };

export { activateMainListeners, prepareMainContext };
export type { MainContext };
