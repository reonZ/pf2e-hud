import { FilterValue, rollInitiative } from "hud/shared";
import {
    AbilityItemPF2e,
    ActorPF2e,
    addListenerAll,
    ApplicationRenderOptions,
    getDragEventData,
    getFlag,
    htmlQueryIn,
    ItemPF2e,
    MacroPF2e,
    R,
    setFlag,
    SkillSlug,
    SpecialResourceRuleElement,
} from "module-helpers";
import { ExtrasSidebarItem, getExtrasActions, MacroSidebarItem } from ".";
import { getStatistics, SidebarPF2eHUD } from "..";

class ExtrasSidebarPF2eHUD extends SidebarPF2eHUD<AbilityItemPF2e | ItemPF2e, ExtrasSidebarItem | MacroSidebarItem> {
    get name(): "extras" {
        return "extras";
    }

    get worldActor(): ActorPF2e {
        return (this.actor.token?.baseActor ?? this.actor) as ActorPF2e;
    }

    get fadeoutOnDrag(): boolean {
        return false;
    }

    get macrosFlag(): string[] {
        return getFlag<string[]>(this.worldActor, "macros", game.user.id) ?? [];
    }

    protected async _prepareContext(options: ApplicationRenderOptions): Promise<ExtrasSidebarContext> {
        const actor = this.actor;
        const isCharacter = actor.isOfType("character");

        const actions = getExtrasActions().map((action) => {
            const data = action.toData();
            return this.addSidebarItem(ExtrasSidebarItem, "uuid", data);
        });

        const dailies = isCharacter &&
            game.dailies?.active && {
                canPrep: game.dailies.api.canPrepareDailies(actor),
                tooltip: game.dailies.api.getDailiesSummary(actor),
            };

        const filterValue: ExtrasSidebarContext["filterValue"] = (str, { hash }) => {
            const localized = hash.localize !== false ? game.i18n.localize(str) : str;
            return new FilterValue(localized);
        };

        const macros = R.filter(
            await Promise.all(
                this.macrosFlag.map(async (uuid) => {
                    const macro = await fromUuid<MacroPF2e>(uuid);
                    if (!macro) return;
                    return this.addSidebarItem(MacroSidebarItem, "uuid", { macro, actor });
                }),
            ),
            R.isTruthy,
        );

        return {
            actions,
            dailies,
            filterValue,
            initiative: actor.system.initiative?.statistic,
            isCharacter,
            macros,
            resources: R.values(actor.synthetics.resources),
            statistics: getStatistics(actor),
        };
    }

    protected async _onClickAction(event: PointerEvent, target: HTMLElement) {
        const actor = this.actor;
        const action = target.dataset.action as EventAction;

        if (action === "roll-statistic-action") {
            const { variant } = target.dataset as Record<string, string>;
            if (!variant && event.button !== 0) return;

            return this.getSidebarItemFromElement<ExtrasSidebarItem>(target)?.roll(actor, event, {
                variant,
            });
        }

        if (event.button !== 0) return;

        if (action === "delete-macro") {
            const macro = this.getSidebarItemFromElement<MacroSidebarItem>(target);
            macro?.delete();
        } else if (action === "edit-macro") {
            const macro = this.getSidebarItemFromElement<MacroSidebarItem>(target);
            macro?.edit();
        } else if (action === "prepare-dailies") {
            game.dailies?.api.openDailiesInterface(actor);
        } else if (action === "rest-for-the-night") {
            game.pf2e.actions.restForTheNight({ actors: [actor] });
        } else if (action === "roll-initiative") {
            const statistic = htmlQueryIn(target, ".initiative", "select")?.value;
            rollInitiative(event, actor, statistic);
        } else if (action === "use-macro") {
            const macro = this.getSidebarItemFromElement<MacroSidebarItem>(target);
            macro?.execute();
        }
    }

    _activateListeners(html: HTMLElement) {
        const actor = this.actor;

        html.addEventListener("drop", async (event) => {
            const { type, uuid } = getDragEventData(event);
            if (type !== "Macro" || typeof uuid !== "string" || !fromUuidSync(uuid)) return;

            const macros = this.macrosFlag.slice();
            if (macros.includes(uuid)) return;
            macros.push(uuid);
            await setFlag(this.worldActor, "macros", game.user.id, macros);
        });

        if (!actor.isOfType("character", "npc")) return;

        addListenerAll(html, "[data-resource]", "change", (el: HTMLInputElement) => {
            const resourceSlug = el.dataset.resource ?? "";
            const resource = this.actor.getResource(resourceSlug);
            if (!resource) return;

            const value = Math.clamp(el.valueAsNumber, 0, resource.max);

            if (value !== resource.value) {
                actor.updateResource(resourceSlug, value);
            }
        });
    }
}

type EventAction =
    | "delete-macro"
    | "edit-macro"
    | "prepare-dailies"
    | "rest-for-the-night"
    | "roll-initiative"
    | "roll-statistic-action"
    | "use-macro";

type ExtrasSidebarContext = {
    actions: ExtrasSidebarItem[];
    dailies: MaybeFalsy<{ canPrep: boolean; tooltip: string }>;
    filterValue: (str: string, options: { hash: { localize?: boolean } }) => FilterValue;
    initiative: SkillSlug | "perception" | undefined;
    isCharacter: boolean;
    macros: MacroSidebarItem[];
    resources: SpecialResourceRuleElement[];
    statistics: SelectOptions;
};

export { ExtrasSidebarPF2eHUD };
