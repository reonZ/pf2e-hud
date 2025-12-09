import {
    ActorPF2e,
    ApplicationRenderOptions,
    FeatLike,
    FeatNotSlot,
    FeatPF2e,
    FeatSlot,
    HeritagePF2e,
    R,
} from "module-helpers";
import { FeatsSidebarItem, SidebarPF2eHUD } from "..";
import { FilterValue } from "hud";

class FeatsSidebarPF2eHUD extends SidebarPF2eHUD<FeatPF2e<ActorPF2e>, FeatsSidebarItem> {
    get name(): "feats" {
        return "feats";
    }

    async _prepareContext(options: ApplicationRenderOptions): Promise<FeatsSidebarContext> {
        const actor = this.actor;
        const sections = R.pipe(
            actor.isOfType("character") ? [...actor.feats, actor.feats.bonus] : [],
            R.map((group): FeatsSection => {
                const filterValue = new FilterValue();

                const slots = R.pipe(
                    group.feats,
                    R.map((slot): FeatsSectionSlot | undefined => {
                        const prepared = this.#prepareSectionSlot(slot);
                        if (!prepared) return;
                        const label = "label" in slot ? slot.label : null;

                        filterValue.add(prepared.feat);

                        return {
                            ...prepared,
                            label: label || (R.isNumber(slot.level) ? String(slot.level) : ""),
                        };
                    }),
                    R.filter(R.isTruthy)
                );

                return {
                    filterValue,
                    id: group.id,
                    label: group.label,
                    slots,
                };
            }),
            R.filter((section) => section.slots.length > 0)
        );

        return {
            sections,
        };
    }

    #prepareSectionSlot(
        slot: FeatSlot<FeatPF2e | FeatLike | HeritagePF2e> | FeatNotSlot<FeatPF2e>
    ): SectionSlot | undefined {
        if (!slot.feat) return;

        const children = R.pipe(
            slot.children,
            R.map((child) => this.#prepareSectionSlot(child)),
            R.filter(R.isTruthy)
        );

        const feat = this.addSidebarItem(FeatsSidebarItem, "id", { item: slot.feat });
        feat.filterValue.add(...children.map(({ feat }) => feat));

        return { children, feat };
    }
}

type FeatsSidebarContext = {
    sections: FeatsSection[];
};

type FeatsSection = {
    filterValue: FilterValue;
    id: string;
    label: string;
    slots: FeatsSectionSlot[];
};

type FeatsSectionSlot = SectionSlot & {
    label: string;
};

type SectionSlot = {
    feat: FeatsSidebarItem;
    children: SectionSlot[];
};

export { FeatsSidebarPF2eHUD };
