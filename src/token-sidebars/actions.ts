import { getActivePF2eModule, localize } from "pf2e-api";
import { SidebarContext, SidebarRenderOptions } from "../sidebar";
import { PF2eHudTokenSidebar } from "./base";

function getActionCategory(actor: ActorPF2e, item: WeaponPF2e | MeleePF2e) {
    if (item.isMelee) {
        const reach = actor.getReach({ action: "attack", weapon: item });

        return {
            category: "melee",
            tooltip: localize("sidebars.actions.reach", { reach }),
        };
    }

    const range = item.range!;
    const isThrown = item.isThrown;
    const key = isThrown ? "thrown" : range.increment ? "rangedWithIncrement" : "ranged";

    return {
        category: isThrown ? "thrown" : "ranged",
        tooltip: localize("sidebars.actions", key, range),
    };
}

class PF2eHudActionsSidebar extends PF2eHudTokenSidebar {
    get sidebarKey(): "actions" {
        return "actions";
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<ActionsSidebarContext> {
        const actor = this.actor;
        const isCharacter = actor.isOfType("character");
        const parentData = await super._prepareContext(options);
        const rollData = actor.getRollData();

        const stances = isCharacter
            ? getActivePF2eModule("pf2e-toolbelt")?.api.stances.getStances(actor) ?? []
            : [];

        const strikes = await Promise.all(
            (actor.system.actions ?? []).map(async (strike, index) => {
                return {
                    ...strike,
                    index,
                    damageFormula: String(await strike.damage?.({ getFormula: true })),
                    criticalFormula: String(await strike.critical?.({ getFormula: true })),
                    description: await TextEditor.enrichHTML(strike.description, {
                        async: true,
                        secrets: true,
                        rollData,
                    }),
                    visible: !isCharacter || (strike as CharacterStrike).visible,
                    category: getActionCategory(actor, strike.item),
                };
            })
        );

        const data: ActionsSidebarContext = {
            ...parentData,
            isCharacter,
            strikes,
            variantLabel: (label: string) => label.replace(/.+\((.+)\)/, "$1"),
            showUnreadyStrikes: !!actor.getFlag("pf2e", "showUnreadyStrikes"),
        };

        return data;
    }

    _activateListener(html: HTMLElement) {
        super._activateListener(html);
    }
}

type ActionsSidebarContext = SidebarContext & {
    isCharacter: boolean;
    showUnreadyStrikes: boolean;
    variantLabel: (label: string) => string;
    strikes: (StrikeData & {
        index: number;
        damageFormula: string;
        criticalFormula: string;
        description: string;
        category: {
            category: string;
            tooltip: string;
        };
    })[];
};

export { PF2eHudActionsSidebar };
