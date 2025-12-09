import { FilterValue } from "hud";
import {
    AbilityItemPF2e,
    ActorPF2e,
    ApplicationRenderOptions,
    FeatPF2e,
    findItemWithSourceId,
    getItemSourceFromUuid,
    hasAnyItemWithSourceId,
    hasItemWithSourceId,
    localize,
    R,
    signedInteger,
    StatisticRollParameters,
} from "module-helpers";
import { getGlobalSetting, setGlobalSetting } from "settings";
import {
    CHIRURGEON,
    ExtractedSkillActionData,
    ExtractedSkillActionGroupData,
    FOLLOW_THE_EXPERT,
    FOLLOW_THE_EXPERT_EFFECT,
    getSkillActionGroups,
    ISkill,
    LoreSkill,
    SkillProficiency,
    SkillsSidebarItem,
    UNTRAINED_IMPROVISATION,
} from ".";
import { SidebarPF2eHUD, StatisticType } from "..";

const _cached: {
    followTheLeader?: Omit<FollowTheLeader, "active">;
    proficient?: string;
} = {};

class SkillsSidebarPF2eHUD extends SidebarPF2eHUD<FeatPF2e | AbilityItemPF2e, SkillsSidebarItem> {
    get name(): "skills" {
        return "skills";
    }

    getSidebarItemKey({ itemId, itemUuid, statistic }: DOMStringMap): string | undefined {
        return itemUuid && statistic ? `${statistic}-${itemUuid}` : itemUuid ?? itemId;
    }

    protected async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<SkillsSidebarContext> {
        const actor = this.actor;
        const hideUntrained = getGlobalSetting("hideUntrained");
        const lores = actor.itemTypes.lore.map((item) => new LoreSkill(item));

        const isCharacter = actor.isOfType("character");
        const showUntrained = !hideUntrained;

        const untrainedImprovisation =
            isCharacter && hasAnyItemWithSourceId(actor, UNTRAINED_IMPROVISATION, "feat");

        const skillGroups = getSkillActionGroups().map((group) => {
            const statistic = actor.getStatistic(group.slug);
            const rank = statistic?.rank ?? 0;

            const isProficient =
                !isCharacter ||
                untrainedImprovisation ||
                statistic?.proficient ||
                (group.slug === "medicine" && hasItemWithSourceId(actor, CHIRURGEON, "feat"));

            const proficiency = isCharacter
                ? { rank, label: game.i18n.localize(`PF2E.ProficiencyLevel${rank}`) }
                : statistic?.proficient
                ? { rank, label: (_cached.proficient ??= localize("sidebar.skills.proficient")) }
                : undefined;

            const actions = group.map((action) => {
                if (!isProficient && !showUntrained && action.requireTrained) return;
                if (
                    action.mustHaveRollOption &&
                    (!isCharacter || !(action.mustHaveRollOption in actor.rollOptions.all))
                )
                    return;

                const prepared = action.toData() as PreparedSkillAction;
                prepared.isProficient = !action.requireTrained || isProficient;

                return this.addSidebarItem(
                    SkillsSidebarItem,
                    `${action.statistic}-${action.sourceId}`,
                    prepared
                );
            });

            return {
                ...group.toData(),
                actions: R.sortBy(actions.filter(R.isTruthy), R.prop("label")),
                isCharacter,
                proficiency,
                signedMod: signedInteger(statistic?.mod ?? 0),
            };
        });

        return {
            follow: getFollowTheExpertData(actor),
            hideUntrained,
            isCharacter: actor.isOfType("character"),
            lores: lores.length && {
                filterValue: new FilterValue(...lores),
                skills: lores,
            },
            skillGroups,
        };
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        const actor = this.actor;
        const action = target.dataset.action as EventAction;

        if (action === "roll-statistic-action") {
            const { variant } = target.dataset as Record<string, string>;
            this.getSidebarItemFromElement(target)?.roll(actor, event, { variant });
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

    const source = await getItemSourceFromUuid(FOLLOW_THE_EXPERT_EFFECT, "effect");
    if (!source) return;

    actor.createEmbeddedDocuments("Item", [source]);
}

function getFollowTheExpertData(actor: ActorPF2e): FollowTheLeader {
    if (!_cached.followTheLeader) {
        const item = fromUuidSync(FOLLOW_THE_EXPERT) ?? { name: "" };

        _cached.followTheLeader = {
            filterValue: new FilterValue(item.name),
            label: item.name,
            sourceId: FOLLOW_THE_EXPERT,
        };
    }

    return {
        ..._cached.followTheLeader,
        active: hasItemWithSourceId(actor, FOLLOW_THE_EXPERT_EFFECT, "effect"),
    };
}

type EventAction =
    | "follow-the-expert"
    | "roll-skill"
    | "roll-statistic-action"
    | "toggle-hide-untrained";

type SkillsSidebarContext = {
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

type PreparedSkillAction = ExtractedSkillActionData & {
    isProficient: boolean;
};

type PreparedSkillActionGroup = ExtractedSkillActionGroupData &
    ISkill<StatisticType> & {
        actions: SkillsSidebarItem[];
        isCharacter: boolean;
        proficiency: SkillProficiency | undefined;
        signedMod: string;
    };

export { SkillsSidebarPF2eHUD };
