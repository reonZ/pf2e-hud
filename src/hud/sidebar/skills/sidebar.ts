import { FilterValue } from "hud";
import {
    ActorPF2e,
    ApplicationRenderOptions,
    findItemWithSourceId,
    getItemSourceFromUuid,
    hasItemWithSourceId,
    StatisticRollParameters,
} from "module-helpers";
import { getGlobalSetting, setGlobalSetting } from "settings";
import {
    FOLLOW_THE_EXPERT,
    FOLLOW_THE_EXPERT_EFFECT,
    getSkillAction,
    getSkillActionGroups,
    LoreSkill,
    PreparedSkillActionGroup,
} from ".";
import { SidebarPF2eHUD } from "..";

class SkillsSidebarPF2eHUD extends SidebarPF2eHUD {
    get name(): "skills" {
        return "skills";
    }

    protected async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<SkillSidebarContext> {
        const actor = this.actor;
        const hideUntrained = getGlobalSetting("hideUntrained");
        const skillGroups = getSkillActionGroups().prepare(actor, !hideUntrained);
        const lores = actor.itemTypes.lore.map((item) => new LoreSkill(item));

        return {
            follow: getFollowTheExpertData(actor),
            hideUntrained,
            isCharacter: actor.isOfType("character"),
            lores: lores.length && {
                filterValue: new FilterValue(...lores.map((lore) => lore.filterValue)),
                skills: lores,
            },
            skillGroups,
        };
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        const actor = this.actor;
        const action = target.dataset.action as EventAction;

        if (action === "roll-statistic-action") {
            const { key, statistic, variant } = target.dataset as Record<string, string>;
            getSkillAction(statistic, key)?.roll(actor, event, { variant });
        }

        if (event.button !== 0) return;

        if (action === "follow-the-expert") {
            toggleFollowTheExpert(actor);
        } else if (action === "roll-skill") {
            const slug = target.dataset.slug as string;
            actor.getStatistic(slug)?.roll({ event } as StatisticRollParameters);
        } else if (action === "toggle-hide-untrained") {
            setGlobalSetting("hideUntrained", (target as HTMLInputElement).checked);
        }
    }
}

async function toggleFollowTheExpert(actor: ActorPF2e) {
    const exist = findItemWithSourceId(actor, FOLLOW_THE_EXPERT_EFFECT, "effect");

    if (exist) {
        return exist.delete();
    }

    const source = await getItemSourceFromUuid(FOLLOW_THE_EXPERT_EFFECT, "EffectPF2e");
    if (!source) return;

    actor.createEmbeddedDocuments("Item", [source]);
}

let _follow: Omit<FollowTheLeader, "active"> | undefined;
function getFollowTheExpertData(actor: ActorPF2e): FollowTheLeader {
    if (!_follow) {
        const item = fromUuidSync(FOLLOW_THE_EXPERT) ?? { name: "" };

        _follow = {
            filterValue: new FilterValue(item.name),
            label: item.name,
            sourceId: FOLLOW_THE_EXPERT,
        };
    }

    return {
        ..._follow,
        active: hasItemWithSourceId(actor, FOLLOW_THE_EXPERT_EFFECT, "effect"),
    };
}

type EventAction =
    | "follow-the-expert"
    | "roll-skill"
    | "roll-statistic-action"
    | "toggle-hide-untrained";

type SkillSidebarContext = {
    follow: FollowTheLeader;
    hideUntrained: boolean;
    isCharacter: boolean;
    lores: { filterValue: FilterValue; skills: LoreSkill[] } | 0;
    skillGroups: PreparedSkillActionGroup[];
};

type FollowTheLeader = {
    active: boolean;
    label: string;
    filterValue: FilterValue;
    sourceId: CompendiumUUID;
};

export { SkillsSidebarPF2eHUD };
