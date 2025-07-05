import {
    BaseSidebarItem,
    ShortcutData,
    SidebarName,
    SidebarPF2eHUD,
    ToggleShortcutData,
} from "hud";
import { ActorPF2e, ItemPF2e, R, RollOptionToggle } from "module-helpers";

const ROLLOPTIONS_PLACEMENT = {
    actions: "actions",
    spells: "spellcasting",
    items: "inventory",
    skills: "proficiencies",
    extras: undefined,
} as const satisfies Record<SidebarName, string | undefined>;

class ToggleSidebarItem extends BaseSidebarItem<ItemPF2e<ActorPF2e>, SidebarToggle> {
    get img(): ImageFilePath {
        return this.item.img;
    }

    toShortcut(): ToggleShortcutData {
        return {
            img: this.img,
            itemId: this.itemId,
            name: this.item.name,
            type: "toggle",
        };
    }
}

interface ToggleSidebarItem extends Readonly<SidebarToggle> {}

function getRollOptionsData(this: SidebarPF2eHUD): ToggleSidebarItem[] {
    const selectedPlacement = ROLLOPTIONS_PLACEMENT[this.name];
    if (!selectedPlacement) return [];

    return R.pipe(
        R.values(this.actor.synthetics.toggles).flatMap((domain) => Object.values(domain)),
        R.map((toggle): ToggleSidebarItem | false | undefined => {
            if (toggle.placement !== selectedPlacement) return;
            if (toggle.domain === "elemental-blast" && toggle.option === "action-cost") return;

            const item = this.actor.items.get(toggle.itemId);
            return item && this.addSidebarItem(ToggleSidebarItem, "itemId", { ...toggle, item });
        }),
        R.filter(R.isTruthy)
    );
}

type SidebarToggle = RollOptionToggle & {
    item: ItemPF2e<ActorPF2e>;
};

export { getRollOptionsData };
