import { FilterValue } from "hud";
import {
    AbilityItemPF2e,
    ActionType,
    ActorPF2e,
    EffectPF2e,
    FeatPF2e,
    findItemWithSourceId,
    getActionGlyph,
    getActionIcon,
    includesAny,
    isSupressedFeat,
    localize,
    MacroPF2e,
    R,
    TraitToggleViewData,
    useAction,
    ValueAndMax,
} from "module-helpers";
import { ActionsSidebarPF2eHUD } from ".";
import { BaseSidebarItem, getSkillActionGroups } from "..";

const ACTION_TYPES = {
    action: { sort: 0, label: "PF2E.ActionsActionsHeader" },
    reaction: { sort: 1, label: "PF2E.ActionsReactionsHeader" },
    free: { sort: 2, label: "PF2E.ActionsFreeActionsHeader" },
    passive: { sort: 3, label: "PF2E.NPC.PassivesLabel" },
    exploration: { sort: 3, label: "PF2E.TravelSpeed.ExplorationActivity" },
};

const SKILL_EXCLUDE_EXCLUDE = [
    "Compendium.pf2e.actionspf2e.Item.IE2nThCmoyhQA0Jn", // avoid-notice
];

const _cachedExcludedSkills: string[] = [];

class ActionsSidebarAction extends BaseSidebarItem<
    FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>,
    ActionData
> {
    get actor(): ActorPF2e {
        return this.item.actor;
    }

    removeEffect() {
        this.usage?.effect?.delete();
    }

    toggleExporation() {
        const actor = this.actor;
        if (!actor.isOfType("character")) return;

        const actionId = this.id;
        const explorations = actor.system.exploration.filter((id) => actor.items.has(id));

        if (!explorations.findSplice((id) => id === actionId)) {
            explorations.push(actionId);
        }

        return actor.update({ "system.exploration": explorations });
    }

    toggleTrait(trait: string) {
        if (trait !== "mindshift") return;

        const item = this.item;
        const toggle = item.system.traits.toggles[trait];
        if (!toggle) return;

        return item.system.traits.toggles.update({ trait, selected: !toggle.selected });
    }

    use(event: Event) {
        const item = this.item;
        return item?.isOfType("feat", "action") && useAction(event, item);
    }
}

interface ActionsSidebarAction extends Readonly<ActionData> {}

function getExcludedSkills(): string[] {
    if (_cachedExcludedSkills.length === 0) {
        const skillActions = getSkillActionGroups().contents.flatMap((x) => x.contents);

        for (const { sourceId } of skillActions) {
            if (SKILL_EXCLUDE_EXCLUDE.includes(sourceId)) continue;
            _cachedExcludedSkills.push(sourceId);
        }
    }

    return _cachedExcludedSkills;
}

const _cached: { useLabel?: string; removeEffect?: string } = {};
async function getSidebarActionsData(
    this: ActionsSidebarPF2eHUD
): Promise<ActionSection[] | undefined> {
    const actor = this.actor;
    const isCharacter = actor.isOfType("character");

    const abilityTypes: ("action" | "feat")[] = ["action"];
    if (isCharacter) {
        abilityTypes.push("feat");
    }

    const actionableEnabled = !!game.toolbelt?.getToolSetting("actionable", "action");
    const hasKineticAura = !!actor.rollOptions.all["self:effect:kinetic-aura"];
    const explorations = isCharacter ? actor.system.exploration : [];
    const inParty = isCharacter ? actor.parties.size > 0 : false;
    const excludedActions = getExcludedSkills();
    const sections: PartialRecord<SectionType, ActionSection> = {};
    const useLabel = (_cached.useLabel ??= game.i18n.localize("PF2E.Action.Use"));
    const removeEffect = (_cached.removeEffect ??= localize("sidebar.removeEffect"));
    const getActionMacro = game.toolbelt?.api.actionable.getActionMacro;

    const abilities = abilityTypes.flatMap(
        (type): (FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>)[] => actor.itemTypes[type]
    );

    const abilitiesPromises = abilities.map(async (ability) => {
        const traits = ability.system.traits.value;
        if (includesAny(traits, "downtime", "stance")) return;

        if (
            isSupressedFeat(ability) ||
            (ability.slug === "elemental-blast" && hasKineticAura) ||
            (ability.isOfType("feat") && !ability.actionCost)
        )
            return;

        const isExploration = isCharacter && traits.includes("exploration");
        if (!inParty && isExploration) return;

        const sourceId = ability.sourceId;
        if (sourceId && excludedActions.includes(sourceId)) return;

        const actionCost = ability.actionCost;
        const type =
            actionCost?.type ??
            (isCharacter ? (isExploration ? "exploration" : "free") : "passive");

        sections[type] ??= {
            actions: [],
            filterValue: new FilterValue(),
            label: ACTION_TYPES[type].label,
            type,
        };

        const abilityId = ability.id;
        const crafting = !isExploration && ability.crafting;
        const selfEffect = !isExploration && !crafting ? ability.system.selfEffect : null;
        const resource = crafting ? getActionResource(ability) : undefined;
        const frequency = !isExploration && !resource ? getActionFrequency(ability) : undefined;
        const macro = !isExploration && actionableEnabled && (await getActionMacro?.(ability));
        const usable = !!(frequency || selfEffect || crafting || macro);
        const effect = selfEffect && findItemWithSourceId(actor, selfEffect.uuid, "effect");

        const usage: MaybeFalsy<ActionUsage> = usable && {
            disabled: ability.crafting ? resource?.value === 0 : frequency?.value === 0,
            effect,
            label: effect
                ? removeEffect
                : `${useLabel} <span class="action-glyph">${getActionGlyph(actionCost)}</span>`,
        };

        const exploration = isExploration && {
            active: explorations.includes(abilityId),
        };

        const data: ActionData = {
            exploration,
            frequency,
            id: abilityId,
            img: getActionImg(ability, macro),
            item: ability,
            resource,
            toggles: ability.system.traits.toggles?.getSheetData() ?? [],
            usage: usage || null,
        };

        const sidebarAction = this.addSidebarItem(ActionsSidebarAction, "id", data);
        sections[type].actions.push(sidebarAction);
    });

    await Promise.all(abilitiesPromises);

    return R.pipe(
        sections,
        R.values(),
        R.sortBy((section) => ACTION_TYPES[section.type].sort),
        R.forEach((section) => {
            section.actions = R.sortBy(section.actions, (action) => action.item.name);
        })
    );
}

const FEAT_ICON = "icons/sundries/books/book-red-exclamation.webp";
function getActionImg(
    item: FeatPF2e | AbilityItemPF2e,
    macro: MaybeFalsy<MacroPF2e> | null
): ImageFilePath {
    const actionIcon = getActionIcon(item.actionCost);
    const defaultIcon = getDocumentClass("Item").getDefaultArtwork(item._source).img;

    if (item.isOfType("action") && ![actionIcon, defaultIcon].includes(item.img)) {
        return item.img;
    }

    const selfEffect = item.system.selfEffect
        ? fromUuidSync(item.system.selfEffect.uuid)
        : undefined;

    if (selfEffect?.img) {
        return selfEffect.img;
    }

    if (macro && macro.img) {
        return macro.img;
    }

    return [actionIcon, defaultIcon, FEAT_ICON].includes(item.img) ? actionIcon : item.img;
}

function getActionFrequency(item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>) {
    const frequency = item.frequency;
    if (!frequency?.max) return;

    const perLabel = game.i18n.localize(CONFIG.PF2E.frequencies[frequency.per]);

    return {
        max: frequency.max,
        value: frequency.value,
        label: `${frequency.max} / ${perLabel}`,
    };
}

function getActionResource(item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>) {
    if (item.crafting?.resource) {
        const resource = item.actor.getResource(item.crafting.resource);
        if (!resource?.max) return;

        return {
            max: resource.max,
            value: resource.value,
            slug: resource.slug,
            label: resource.label,
        };
    }
}

function onActionClickAction(
    event: MouseEvent,
    sidebarItem: ActionsSidebarAction,
    action: Stringptionel<ActionEventAction>,
    target: HTMLElement
) {
    if (action === "remove-effect") {
        sidebarItem.removeEffect();
    } else if (action === "toggle-exploration") {
        sidebarItem.toggleExporation();
    } else if (action === "toggle-trait") {
        const trait = target.dataset.trait as string;
        sidebarItem.toggleTrait(trait);
    } else if (action === "use-action") {
        sidebarItem.use(event);
    }
}

type ActionEventAction = "remove-effect" | "toggle-exploration" | "toggle-trait" | "use-action";

type ActionUsage = {
    disabled: boolean;
    effect: EffectPF2e | null;
    label: string;
};

type SectionType = ActionType | "exploration";

type ActionSection = {
    type: ActionType | "exploration";
    actions: ActionsSidebarAction[];
    filterValue: FilterValue;
    label: string;
};

type ActionData = {
    exploration: MaybeFalsy<{ active: boolean }>;
    frequency: Maybe<ValueAndMax & { label: string }>;
    id: string;
    img: ImageFilePath;
    item: AbilityItemPF2e<ActorPF2e> | FeatPF2e<ActorPF2e>;
    resource: Maybe<ValueAndMax & { label: string; slug: string }>;
    toggles: TraitToggleViewData[];
    usage: Maybe<ActionUsage>;
};

export { ActionsSidebarAction, getSidebarActionsData, onActionClickAction };
export type { ActionSection };
