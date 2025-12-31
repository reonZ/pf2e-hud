import { BaseActorPF2eHUD, IAdvancedPF2eHUD } from "hud/base";
import { SidebarPF2eHUD } from "hud/sidebar";
import { ActorPF2e, addListenerAll, localize, R } from "module-helpers";

const SIDEBARS = [
    {
        type: "actions",
        icon: "fa-solid fa-sword",
        disabled: (actor) => {
            return (
                !actor.isOfType("character") &&
                !actor.system.actions?.length &&
                !actor.itemTypes.action.length
            );
        },
    },
    {
        type: "items",
        icon: "fa-solid fa-backpack",
        disabled: (actor) => {
            return actor.inventory.size < 1;
        },
    },
    {
        type: "spells",
        icon: "fa-solid fa-wand-magic-sparkles",
        disabled: (actor) => {
            return !hasSpells(actor);
        },
    },
    {
        type: "skills",
        icon: "fa-solid fa-hand",
        disabled: (actor) => {
            return !actor.isOfType("creature");
        },
    },
    {
        type: "feats",
        icon: "fa-solid fa-medal",
        disabled: (actor) => {
            return !actor.isOfType("character") || !actor.itemTypes.feat.length;
        },
    },
    {
        type: "extras",
        icon: "fa-solid fa-cubes",
        disabled: (actor) => {
            return !actor.isOfType("creature");
        },
    },
] as const satisfies SidebarDetails[];

const SIDEBAR_ICONS = R.pullObject(SIDEBARS, R.prop("type"), R.prop("icon"));

function getSidebars(actor: ActorPF2e, active: SidebarName | null): SidebarMenu[] {
    return SIDEBARS.map((details: SidebarDetails & { type: SidebarName }): SidebarMenu => {
        return {
            active: details.type === active,
            disabled: details.disabled(actor),
            icon: details.icon,
            type: details.type,
            tooltip: (details.tooltip ??= localize("sidebars", details.type)),
        };
    });
}

function hasSpells(actor: ActorPF2e): boolean {
    if (!actor.isOfType("character") && !actor.isOfType("npc")) return false;

    return actor.spellcasting.contents.some((entry) => {
        return (
            (entry.spells?.size && entry.spells?.size > 0) ||
            (entry.isEphemeral && entry.id.endsWith("-casting"))
        );
    });
}

function addSidebarsListeners(parent: IAdvancedPF2eHUD & BaseActorPF2eHUD, html: HTMLElement) {
    addListenerAll(html, `[data-sidebar]`, (el) => {
        const sidebar = el.dataset.sidebar as SidebarName;
        SidebarPF2eHUD.toggleSidebar(sidebar, parent);
    });
}

type SidebarDetails = {
    type: string;
    icon: string;
    disabled: (actor: ActorPF2e) => boolean;
    tooltip?: string;
};

type SidebarMenu = {
    active: boolean;
    disabled: boolean;
    icon: string;
    tooltip: string;
    type: SidebarName;
};

type SidebarName = (typeof SIDEBARS)[number]["type"];

export { addSidebarsListeners, getSidebars, SIDEBAR_ICONS };
export type { SidebarMenu, SidebarName };
