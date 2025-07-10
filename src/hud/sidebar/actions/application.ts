import {
    ApplicationClosingOptions,
    ApplicationRenderOptions,
    CombatantPF2e,
    createHook,
    getFlag,
    ItemPF2e,
    setFlag,
} from "module-helpers";
import {
    ActionSection,
    ActionsSidebarAction,
    ActionsSidebarBlast,
    ActionsSidebarBlastCost,
    ActionsSidebarStrike,
    ActionsStance,
    activateActionsListeners,
    BlastsContext,
    getSidebarActionsData,
    getSidebarBlastsData,
    getSidebarStancesData,
    getSidebarStrikeData,
    onActionClickAction,
    onBlastsClickAction,
    onStancesClickAction,
    onStrikeClickAction,
    StancesContext,
    StrikesContext,
} from ".";
import { SidebarPF2eHUD } from "..";

class ActionsSidebarPF2eHUD extends SidebarPF2eHUD<
    ItemPF2e,
    | ActionsSidebarAction
    | ActionsSidebarBlast
    | ActionsSidebarBlastCost
    | ActionsSidebarStrike
    | ActionsStance
> {
    #combatantHooks = createHook(
        ["createCombatant", "deleteCombatant"],
        this.#onCombatant.bind(this)
    );

    getSidebarItemKey({ itemId, index }: DOMStringMap): string | undefined {
        return itemId && index ? `${itemId}-${index}` : itemId;
    }

    get name(): "actions" {
        return "actions";
    }

    async _prepareContext(options: ApplicationRenderOptions): Promise<ActionsSidebarContext> {
        const actor = this.actor;
        const isCharacter = actor.isOfType("character");

        return {
            sections: await getSidebarActionsData.call(this),
            blasts: isCharacter && (await getSidebarBlastsData.call(this)),
            isCharacter,
            stances: isCharacter && getSidebarStancesData.call(this),
            strikes: await getSidebarStrikeData.call(this),
            variantLabel: (str: string) => {
                return str.replace(/.+\((.+)\)/, "$1");
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

    protected _activateListeners(html: HTMLElement): void {
        activateActionsListeners.call(this, html);
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        if (event.button !== 0) return;

        const action = target.dataset.action as string;
        const sidebarItem = this.getSidebarItemFromElement(target);

        if (!sidebarItem) {
            return this.#onClickAction(event, action);
        }

        if (sidebarItem instanceof ActionsStance) {
            onStancesClickAction(event, sidebarItem, action);
        } else if (sidebarItem instanceof ActionsSidebarStrike) {
            onStrikeClickAction(event, sidebarItem, action, target);
        } else if (sidebarItem instanceof ActionsSidebarAction) {
            onActionClickAction(event, sidebarItem, action, target);
        } else {
            onBlastsClickAction(event, sidebarItem, action, target);
        }
    }

    #onClickAction(event: PointerEvent, action: Stringptionel<EventAction>) {
        const actor = this.actor;

        if (action === "toggle-hide-stowed") {
            actor.setFlag("pf2e", "hideStowed", !actor.flags.pf2e.hideStowed);
        } else if (action === "toggle-show-shields") {
            setFlag(actor, "showShields", !getFlag(actor, "showShields"));
        }
    }

    #onCombatant(combatant: CombatantPF2e) {
        if (combatant.actor?.uuid === this.actor.uuid) {
            this.render();
        }
    }
}

type EventAction = "toggle-hide-stowed" | "toggle-show-shields";

type ActionsSidebarContext = {
    sections: ActionSection[] | undefined;
    blasts: MaybeFalsy<BlastsContext>;
    isCharacter: boolean;
    stances: MaybeFalsy<StancesContext>;
    strikes: StrikesContext | undefined;
    variantLabel: (str: string) => string;
};

export { ActionsSidebarPF2eHUD };
