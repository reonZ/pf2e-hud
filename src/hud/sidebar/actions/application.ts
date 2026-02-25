import {
    CharacterPF2e,
    CombatantPF2e,
    createToggleHook,
    getFlag,
    htmlClosest,
    ItemPF2e,
    setFlag,
    SYSTEM,
} from "foundry-helpers";
import { FilterValue, TextHudPopup } from "hud";
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
import { SidebarPF2eHUD, SidebarRenderOptions } from "..";

class ActionsSidebarPF2eHUD extends SidebarPF2eHUD<
    ItemPF2e,
    ActionsSidebarAction | ActionsSidebarBlast | ActionsSidebarBlastCost | ActionsSidebarStrike | ActionsStance
> {
    #combatantHooks = createToggleHook(["createCombatant", "deleteCombatant"], this.#onCombatant.bind(this));

    getSidebarItemKey({ itemId, index }: DOMStringMap): string | undefined {
        return itemId && index ? `${itemId}-${index}` : itemId;
    }

    get name(): "actions" {
        return "actions";
    }

    async _prepareContext(options: fa.ApplicationRenderOptions): Promise<ActionsSidebarContext> {
        const actor = this.actor;
        const isCharacter = actor.isOfType("character");

        return {
            sections: await getSidebarActionsData.call(this),
            blasts: isCharacter && (await getSidebarBlastsData.call(this)),
            heroActions: isCharacter && getHeroActionsData(actor),
            isCharacter,
            isNPC: !isCharacter,
            stances: isCharacter && getSidebarStancesData.call(this),
            strikes: await getSidebarStrikeData.call(this),
            variantLabel: (str: string) => {
                return str.replace(/.+\((.+)\)/, "$1");
            },
        };
    }

    protected async _onFirstRender(context: ActionsSidebarContext, options: SidebarRenderOptions) {
        super._onFirstRender(context, options);

        if (context.stances) {
            this.#combatantHooks.activate();
        }
    }

    protected _onClose(options: fa.ApplicationClosingOptions): void {
        super._onClose(options);

        this.#combatantHooks.disable();
    }

    protected _activateListeners(html: HTMLElement): void {
        activateActionsListeners.call(this, html);
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement) {
        if (event.button !== 0 || target.dataset.disabled === "true") return;

        const action = target.dataset.action as "dailies-retrain" | (string & {});

        if (action === "dailies-retrain") {
            return game.dailies?.api.retrainFromElement(this.actor, target);
        }

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

    #onClickAction(event: PointerEvent, action: EventAction | (string & {})) {
        const actor = this.actor;

        if (action === "toggle-hide-stowed") {
            actor.setFlag(SYSTEM.id, "hideStowed", !actor.getFlag(SYSTEM.id, "hideStowed"));
        } else if (action === "toggle-show-shields") {
            setFlag(actor, "showShields", !getFlag(actor, "showShields"));
        } else {
            this.#onHeroEventAction(event, action);
        }
    }

    async #onHeroEventAction(event: PointerEvent, action: EventHeroAction | (string & {})) {
        const actor = this.actor;
        const heroActions = game.toolbelt?.api.heroActions;
        if (!heroActions || !actor.isOfType("character")) return;

        if (action === "hero-actions-draw") {
            heroActions.drawHeroActions(actor);
        } else if (action === "hero-actions-trade") {
            heroActions.tradeHeroAction(actor);
        }

        const uuid = htmlClosest(event.target, "[data-uuid]")?.dataset.uuid;
        if (!uuid) return;

        if (action === "hero-action-description") {
            const details = await heroActions.getHeroActionDetails(uuid);

            if (details) {
                new TextHudPopup(this.actor, details.name, details.description).render(true);
            }
        } else if (action === "hero-action-discard") {
            heroActions.discardHeroActions(actor, [uuid]);
        } else if (action === "hero-action-use") {
            heroActions.useHeroAction(actor, uuid);
        } else if (action === "send-hero-action-to-chat") {
            heroActions.sendActionToChat(actor, uuid);
        }
    }

    #onCombatant(combatant: CombatantPF2e) {
        if (combatant.actor?.uuid === this.actor.uuid) {
            this.render();
        }
    }
}

function getHeroActionsData(actor: CharacterPF2e): HeroActionData | undefined {
    if (!game.toolbelt?.getToolSetting("heroActions", "enabled")) return;

    const data = game.toolbelt.api.heroActions.getHeroActionsTemplateData(actor);
    if (!data) return;

    const actions = data.actions.map(({ name, uuid }) => {
        return {
            filterValue: new FilterValue(name),
            name,
            uuid,
        };
    });

    return {
        ...data,
        actions,
        filterValue: new FilterValue(...actions),
        i18n: (key: string, { hash }: { hash: Record<string, string> }) => {
            return game.i18n.format(`pf2e-toolbelt.heroActions.sheet.${key}`, hash);
        },
    };
}

type EventHeroAction =
    | "hero-action-description"
    | "hero-action-discard"
    | "hero-action-use"
    | "hero-actions-draw"
    | "hero-actions-draw"
    | "hero-actions-trade";

type EventAction = EventHeroAction | "send-hero-action-to-chat" | "toggle-hide-stowed" | "toggle-show-shields";

type ActionsSidebarContext = fa.ApplicationRenderContext & {
    sections: ActionSection[] | undefined;
    blasts: MaybeFalsy<BlastsContext>;
    heroActions: MaybeFalsy<HeroActionData>;
    isCharacter: boolean;
    isNPC: boolean;
    stances: MaybeFalsy<StancesContext>;
    strikes: StrikesContext | undefined;
    variantLabel: (str: string) => string;
};

type HeroActionData = toolbelt.heroActions.HeroActionsTemplateData & {
    filterValue: FilterValue;
    i18n: (key: string, options: { hash: Record<string, string> }) => string;
};

export { ActionsSidebarPF2eHUD };
