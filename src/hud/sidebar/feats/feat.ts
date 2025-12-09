import { FeatShortcutData } from "hud";
import { ActorPF2e, FeatPF2e } from "module-helpers";
import { BaseSidebarItem } from "..";

class FeatsSidebarItem extends BaseSidebarItem<FeatPF2e<ActorPF2e>, SidebarFeat> {
    toShortcut(event?: Event): FeatShortcutData {
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
