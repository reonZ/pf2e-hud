import { ActorPF2e, FeatPF2e } from "foundry-helpers";
import { FeatShortcutSource } from "hud";
import { BaseSidebarItem } from "..";

class FeatsSidebarItem extends BaseSidebarItem<FeatPF2e<ActorPF2e>, SidebarFeat> {
    toShortcut(): FeatShortcutSource {
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
