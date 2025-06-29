import { FilterValue, rollInitiative } from "hud/shared";
import {
    AbilityItemPF2e,
    ActorInitiative,
    addListenerAll,
    ApplicationRenderOptions,
    confirmDialog,
    getDragEventData,
    getFlag,
    htmlClosest,
    htmlQuery,
    MacroPF2e,
    R,
    setFlag,
    SpecialResourceRuleElement,
} from "module-helpers";
import { ExtrasSidebarItem, getExtrasActions, getStatistics, SidebarPF2eHUD } from "..";

class ExtrasSidebarPF2eHUD extends SidebarPF2eHUD<AbilityItemPF2e, ExtrasSidebarItem> {
    get name(): "extras" {
        return "extras";
    }

    get worldActor() {
        return this.actor.token?.baseActor ?? this.actor;
    }

    get macros() {
        return getFlag<string[]>(this.worldActor, "macros", game.user.id)?.slice() ?? [];
    }

    getSidebarItemFromElement<T extends ExtrasSidebarItem>(el: HTMLElement): T | null {
        const wrapper = htmlClosest(el, ".statistic-wrapper");
        const { itemId, itemUuid } = htmlQuery(wrapper, ".item")?.dataset ?? {};
        return (this.sidebarItems.get(itemUuid ?? itemId ?? "") ?? null) as T | null;
    }

    protected async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<ExtrasSidebarContext> {
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

        const macros: ExtrasSidebarContext["macros"] = R.pipe(
            this.macros,
            R.map((uuid) => {
                const macro = fromUuidSync<CompendiumIndexData>(uuid);
                if (!macro) return null;
                return { img: macro.img, name: macro.name, uuid };
            }),
            R.filter(R.isTruthy)
        );

        return {
            actions,
            dailies,
            filterValue,
            initiative: actor.initiative,
            isCharacter,
            macros,
            resources: R.values(actor.synthetics.resources),
            statistics: getStatistics(),
        };
    }

    protected async _onClickAction(event: PointerEvent, target: HTMLElement) {
        if (event.button !== 0) return;

        const actor = this.actor;
        const action = target.dataset.action as EventAction;

        const getMacroUuid = () => {
            return htmlClosest(target, ".macro")?.dataset.uuid ?? "";
        };

        const getMacro = () => {
            const uuid = getMacroUuid();
            return fromUuid<MacroPF2e>(uuid);
        };

        if (action === "delete-macro") {
            this.#deleteMacro(getMacroUuid());
        } else if (action === "edit-macro") {
            const macro = await getMacro();
            macro?.sheet.render(true);
        } else if (action === "prepare-dailies") {
            game.dailies?.api.openDailiesInterface(actor);
        } else if (action === "rest-for-the-night") {
            game.pf2e.actions.restForTheNight({ actors: [actor] });
        } else if (action === "roll-initiative") {
            const parent = htmlClosest(target, ".initiative");
            const statistic = htmlQuery(parent, "select")?.value;
            rollInitiative(event, actor, statistic);
        } else if (action === "roll-statistic-action") {
            const { variant } = target.dataset as Record<string, string>;
            this.getSidebarItemFromElement(target)?.roll(actor, event, { variant });
        } else if (action === "use-macro") {
            const macro = await getMacro();
            macro?.execute({ actor });
        }
    }

    _activateListeners(html: HTMLElement) {
        const actor = this.actor;

        html.addEventListener("drop", async (event) => {
            const { type, uuid } = getDragEventData(event);
            if (type !== "Macro" || typeof uuid !== "string" || !fromUuidSync(uuid)) return;

            const macros = this.macros;
            if (macros.includes(uuid)) return;

            macros.push(uuid);
            await setFlag(this.worldActor, "macros", game.user.id, macros);
        });

        if (!actor.isOfType("character")) return;

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

    async #deleteMacro(uuid: string) {
        const confirm = await confirmDialog("sidebar.extras.delete");
        if (!confirm) return;

        const macros = this.macros;
        if (!macros?.length) return;

        const index = macros.indexOf(uuid);
        if (index === -1) return;

        macros.splice(index, 1);
        await setFlag(this.worldActor, "macros", game.user.id, macros);
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
    initiative: ActorInitiative | null;
    isCharacter: boolean;
    macros: { img: string; name: string; uuid: string }[];
    resources: SpecialResourceRuleElement[];
    statistics: SelectOptions;
};

export { ExtrasSidebarPF2eHUD };
