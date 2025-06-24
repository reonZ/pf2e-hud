import { FilterValue } from "hud/shared";
import {
    ApplicationClosingOptions,
    ApplicationRenderOptions,
    CombatantPF2e,
    createHook,
    ItemPF2e,
} from "module-helpers";
import { ActionsSidebarStance, canUseStances, getStances, SidebarPF2eHUD } from "..";

class ActionsSidebarPF2eHUD extends SidebarPF2eHUD<ItemPF2e, ActionsSidebarStance> {
    #combatantHooks = createHook(
        ["createCombatant", "deleteCombatant"],
        this.#onCombatant.bind(this)
    );

    get name(): "actions" {
        return "actions";
    }

    async _prepareContext(options: ApplicationRenderOptions): Promise<ActionsSidebarContext> {
        const actor = this.actor;
        const isCharacter = actor.isOfType("character");
        const stances =
            isCharacter &&
            getStances(actor)?.map((data) => {
                const stance = new ActionsSidebarStance(data);
                this.sidebarItems.set(stance.id, stance);
                return stance;
            });

        return {
            stances: stances && {
                actions: stances,
                canUseStances: canUseStances(actor),
                filterValue: new FilterValue(...stances.map((x) => x.filterValue)),
            },
        };
    }

    protected _onFirstRender(context: ActionsSidebarContext, options: ApplicationRenderOptions) {
        super._onFirstRender(context, options);

        if (context.stances) {
            this.#combatantHooks.activate();
        }
    }

    protected _onClose(options: ApplicationClosingOptions): void {
        super._onClose(options);

        this.#combatantHooks.disable();
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        if (event.button !== 0) return;

        const action = target.dataset.action as EventAction;

        const sidebarItem = this.getSidebarItemFromElement(target);
        if (!sidebarItem) return;

        if (action === "toggle-stance" && sidebarItem instanceof ActionsSidebarStance) {
            sidebarItem.toggle(event.ctrlKey);
        }
    }

    #onCombatant(combatant: CombatantPF2e) {
        if (combatant.actor?.uuid === this.actor.uuid) {
            this.render();
        }
    }
}

type EventAction = "toggle-stance";

type ActionsSidebarContext = {
    stances: MaybeFalsy<StancesContext>;
};

type StancesContext = {
    canUseStances: boolean;
    filterValue: FilterValue;
    actions: ActionsSidebarStance[];
};

export { ActionsSidebarPF2eHUD };
