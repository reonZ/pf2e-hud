import { ShortcutData } from "hud/persistent";
import { ActorPF2e, FeatPF2e } from "module-helpers";
import { BaseSidebarItem } from "..";

class FeatsSidebarItem extends BaseSidebarItem<FeatPF2e<ActorPF2e>, SidebarFeat> {
    constructor(data: SidebarFeat) {
        super(data);

        if (data.children.length) {
            this.filterValue.add(...this.children.map(({ feat }) => feat));
        }
    }

    toShortcut(event?: Event): FeatShortcutData {
        throw new Error("Method not implemented.");
    }
}

interface FeatsSidebarItem extends Readonly<SidebarFeat> {}

type FeatShortcutData = ShortcutData;

type SidebarFeat = {
    item: FeatPF2e<ActorPF2e>;
    children: { feat: FeatsSidebarItem }[];
};

export { FeatsSidebarItem };
