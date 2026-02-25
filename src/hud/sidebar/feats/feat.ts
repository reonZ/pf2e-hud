import { FeatShortcutData } from "hud";
import { BaseSidebarItem } from "..";
import { ActorPF2e, FeatPF2e } from "foundry-helpers";

class FeatsSidebarItem extends BaseSidebarItem<FeatPF2e<ActorPF2e>, SidebarFeat> {
    toShortcut(): FeatShortcutData {
        return {
            img: this.img,
            itemId: this.id,
            name: this.label,
            type: "feat",
        };
    }
}

interface FeatsSidebarItem extends Readonly<SidebarFeat> {}

type SidebarFeat = {
    item: FeatPF2e<ActorPF2e>;
};

export { FeatsSidebarItem };
