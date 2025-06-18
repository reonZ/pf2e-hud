import { BaseActorPF2eHUD, IAdvancedPF2eHUD } from "hud/base";
import { SidebarPF2eHUD } from "hud/sidebar";
import { ActorPF2e, addListenerAll, CharacterPF2e, NPCPF2e } from "module-helpers";

const SIDEBARS = [
    {
        type: "actions",
        icon: "fa-solid fa-sword",
        disabled: (actor, { isCharacter }) => {
            return isCharacter
                ? false
                : !actor.system.actions?.length && !actor.itemTypes.action.length;
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
        disabled: (actor, options) => {
            return !hasSpells(actor, options);
        },
    },
    {
        type: "skills",
        icon: "fa-solid fa-hand",
        disabled: (_, { isCreature }) => {
            return !isCreature;
        },
    },
    {
        type: "extras",
        icon: "fa-solid fa-cubes",
        disabled: (_, { isCreature }) => {
            return !isCreature;
        },
    },
] as const satisfies SidebarDetails[];

function getSidebars(
    actor: ActorPF2e,
    active: SidebarName | null,
    options?: SidebarOptions
): SidebarMenu[] {
    options ??= {
        isCharacter: actor.isOfType("character"),
        isNPC: actor.isOfType("npc"),
        isCreature: actor.isOfType("creature"),
    };

    return SIDEBARS.map((details: SidebarDetails & { type: SidebarName }): SidebarMenu => {
        return {
            type: details.type,
            icon: details.icon,
            disabled: details.disabled(actor, options),
            active: details.type === active,
        };
    });
}

function hasSpells(actor: ActorPF2e, { isCharacter, isNPC }: SidebarOptions): boolean {
    return (
        (isCharacter || isNPC) &&
        (actor as CharacterPF2e | NPCPF2e).spellcasting.contents.some((entry) => {
            return (
                (entry.spells?.size && entry.spells?.size > 0) ||
                (entry.isEphemeral && entry.id.endsWith("-casting"))
            );
        })
    );
}

function addSidebarsListeners(parent: IAdvancedPF2eHUD & BaseActorPF2eHUD, html: HTMLElement) {
    addListenerAll(html, `[data-sidebar]`, (el) => {
        const sidebar = el.dataset.sidebar as SidebarName;
        SidebarPF2eHUD.toggleSidebar(sidebar, parent);
    });
}

type SidebarOptions = {
    isCharacter: boolean;
    isNPC: boolean;
    isCreature: boolean;
};

type SidebarDetails = {
    type: string;
    icon: string;
    disabled: (actor: ActorPF2e, options: SidebarOptions) => boolean;
};

type SidebarMenu = {
    type: SidebarName;
    icon: string;
    disabled: boolean;
    active: boolean;
};

type SidebarName = (typeof SIDEBARS)[number]["type"];

export { addSidebarsListeners, getSidebars };
export type { SidebarMenu, SidebarName };
