import {
    addListener,
    addListenerAll,
    confirmDialog,
    getFlag,
    getOwner,
    localize,
    setFlag,
    unsetFlag,
    warn,
} from "foundry-pf2e";
import { addSidebarsListeners } from "../base/advanced";
import { PersistentContext, PersistentRenderOptions, PF2eHudPersistent } from "../persistent";
import { getAdvancedStats, StatsAdvanced, ThreeStep } from "../shared/advanced";
import { addStatsAdvancedListeners } from "../shared/listeners";
import { getSidebars, SidebarMenu } from "../sidebar/base";
import { fillShortcuts, UserShortcutsData } from "./shortcuts";

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
                const confirm = await confirmAction("delete");
                if (!confirm) return;

                return unsetFlag(worldActor, "persistent.shortcuts", game.user.id);
            }

            case "fill-shortcuts": {
                const confirm = await confirmAction("fill");
                if (!confirm) return;

                return fillShortcuts.call(this);
            }

            case "copy-owner-shortcuts": {
                const owner = getOwner(actor, false)?.id;
                const userShortcuts = owner
                    ? getFlag<UserShortcutsData>(worldActor, "persistent.shortcuts", owner)
                    : undefined;

                if (!userShortcuts || foundry.utils.isEmpty(userShortcuts)) {
                    return warn("persistent.main.shortcut.owner.none");
                }

                const confirm = await confirmAction("owner");
                if (!confirm) return;

                await unsetFlag(worldActor, "persistent.shortcuts", game.user.id);
                return setFlag(
                    worldActor,
                    "persistent.shortcuts",
                    game.user.id,
                    foundry.utils.deepClone(userShortcuts)
                );
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
