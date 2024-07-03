import {
    R,
    addListener,
    confirmDialog,
    eventToRollParams,
    getActiveModule,
    getFlag,
    htmlClosest,
    htmlQueryInClosest,
    localize,
    rollInitiative,
    setFlag,
} from "foundry-pf2e";
import { PF2eHudSidebar, SidebarContext, SidebarName, SidebarRenderOptions } from "./base";
import {
    PreparedSkillAction,
    RawSkillAction,
    SHARED_SKILLS,
    getStatisticDataFromElement,
    getStatistics,
    prepareStatisticAction,
    rollStatistic,
} from "./skills";

const ACTIONS: (RawSkillAction & { statistic?: SkillSlug | "perception" })[] = [
    {
        actionId: "aid",
        uuid: "Compendium.pf2e.actionspf2e.Item.HCl3pzVefiv9ZKQW",
        cost: "reaction",
    },
    {
        actionId: "point-out",
        uuid: "Compendium.pf2e.actionspf2e.Item.sn2hIy1iIJX9Vpgj",
        cost: 1,
        condition: () => !!getActiveModule("pf2e-perception"),
    },
    {
        ...SHARED_SKILLS["recall-knowledge"],
        actionId: "recall-knowledge",
    },
    {
        actionId: "escape",
        uuid: "Compendium.pf2e.actionspf2e.Item.SkZAQRkLLkmBQNB9",
        cost: 1,
        map: true,
    },
];

let actionsCache: PreparedSkillAction[] | null = null;
function getActions(actor: ActorPF2e) {
    actionsCache ??= ACTIONS.map((x) => ({
        ...prepareStatisticAction(x.statistic, x),
        proficient: true,
    }));

    const isCharacter = actor.isOfType("character");

    return actionsCache.filter((action) => {
        if (!isCharacter) {
            return typeof action.condition !== "function";
        }
        return typeof action.condition === "function" ? action.condition(actor) : true;
    });
}

class PF2eHudSidebarExtras extends PF2eHudSidebar {
    get key(): SidebarName {
        return "extras";
    }

    get worldActor() {
        return this.actor.token?.baseActor ?? this.actor;
    }

    // _getDragData(
    //     target: HTMLElement,
    //     baseDragData: Record<string, JSONValue>,
    //     item: Maybe<ItemPF2e<ActorPF2e>>
    // ) {
    //     return { fromInventory: true };
    // }

    get macros() {
        return getFlag<string[]>(this.worldActor, `macros.${game.user.id}`)?.slice() ?? [];
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<ExtrasContext> {
        const actor = this.actor;
        const parentData = await super._prepareContext(options);

        const dailies = (() => {
            const module = getActiveModule("pf2e-dailies");
            if (!module) return;

            const canPrep = module.api.canPrepareDailies(actor);

            return {
                canPrep,
                tooltip: canPrep ? "" : module.api.getDailiesSummary(actor),
            };
        })();

        const macros = R.pipe(
            this.macros,
            R.map((uuid) => {
                const macro = fromUuidSync<CompendiumIndexData>(uuid);
                if (!macro) return null;
                return { img: macro.img, name: macro.name, uuid };
            }),
            R.filter(R.isTruthy)
        );

        const data: ExtrasContext = {
            ...parentData,
            macros,
            dailies,
            actions: getActions(actor),
            initiative: actor.initiative,
            statistics: getStatistics(actor),
            isCharacter: actor.isOfType("character"),
        };

        return data;
    }

    async _onClickAction(event: PointerEvent, target: HTMLElement) {
        if (event.button === 2) return;

        const actor = this.actor;
        const action = target.dataset.action as ExtrasActionEvent;

        const getMacroUuid = () => {
            return htmlClosest(target, ".macro")?.dataset.uuid ?? "";
        };

        const getMacro = () => {
            const uuid = getMacroUuid();
            return fromUuid<MacroPF2e>(uuid);
        };

        switch (action) {
            case "roll-initiative": {
                const select = htmlQueryInClosest(target, ".initiative", "select");
                const statistic = actor.getStatistic(select?.value ?? "");
                if (statistic) {
                    rollInitiative(actor, statistic, eventToRollParams(event, { type: "check" }));
                }
                break;
            }

            case "prepare-dailies": {
                getActiveModule("pf2e-dailies")?.api.openDailiesInterface(actor as CharacterPF2e);
                break;
            }

            case "rest-for-the-night": {
                game.pf2e.actions.restForTheNight({ actors: [actor] });
                break;
            }

            case "roll-statistic-action": {
                const data = getStatisticDataFromElement(target);

                if (data.actionId === "recall-knowledge") {
                    return;
                }

                if (data.actionId === "aid") {
                    data.dc = 15;
                }

                rollStatistic(actor, event, data, {
                    requireVariants: data.actionId === "aid",
                    onRoll: () => {
                        this.parentHUD.closeIf("roll-skill");
                    },
                });

                break;
            }

            case "delete-macro": {
                const confirm = await confirmDialog({
                    title: localize("sidebars.extras.delete.title"),
                    content: localize("sidebars.extras.delete.confirm"),
                });
                if (!confirm) return;

                const flag = `macros.${game.user.id}`;
                const macros = this.macros;
                if (!macros?.length) return;

                const uuid = getMacroUuid();
                const index = macros.indexOf(uuid);
                if (index === -1) return;

                macros.splice(index, 1);
                setFlag(actor, flag, macros);

                break;
            }

            case "edit-macro": {
                const macro = await getMacro();
                macro?.sheet.render(true);
                break;
            }

            case "use-macro": {
                const macro = await getMacro();
                macro?.execute({ actor });
                break;
            }
        }
    }

    _activateListeners(html: HTMLElement) {
        html.addEventListener("drop", (event) => {
            const { type, uuid } = TextEditor.getDragEventData(event);
            if (type !== "Macro" || typeof uuid !== "string" || !fromUuidSync(uuid)) return;

            const actor = this.worldActor;
            const flag = `macros.${game.user.id}`;
            const macros = getFlag<string[]>(actor, flag)?.slice() ?? [];
            if (macros.includes(uuid)) return;

            macros.push(uuid);
            setFlag(actor, flag, macros);
        });
    }
}

type ExtrasActionEvent =
    | "roll-initiative"
    | "rest-for-the-night"
    | "prepare-dailies"
    | "roll-statistic-action"
    | "use-macro"
    | "edit-macro"
    | "delete-macro";

type ExtrasContext = SidebarContext & {
    isCharacter: boolean;
    initiative: ActorInitiative | null;
    macros: { img: string; name: string; uuid: string }[];
    dailies: Maybe<{ canPrep: boolean; tooltip: string }>;
    actions: PreparedSkillAction[];
    statistics: {
        value: string;
        label: string;
    }[];
};

export { PF2eHudSidebarExtras };
