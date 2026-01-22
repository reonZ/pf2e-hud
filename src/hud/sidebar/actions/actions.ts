import { ActionShortcutData, FilterValue } from "hud";
import {
    AbilityItemPF2e,
    ActionType,
    ActorPF2e,
    EffectPF2e,
    FeatPF2e,
    findItemWithSourceId,
    getActionGlyph,
    getActionIcon,
    isSupressedFeat,
    LabeledValueAndMax,
    localize,
    MacroPF2e,
    R,
    TraitToggleViewData,
    useAction,
} from "module-helpers";
import { ActionsSidebarPF2eHUD } from ".";
import { BaseSidebarItem, getExtrasActions, getSkillActionGroups } from "..";

const FEAT_ICON = [
    "icons/sundries/books/book-red-exclamation.webp",
    "systems/sf2e/icons/default-icons/feats-sf2e.webp",
];

const ACTION_TYPES = {
    action: { sort: 0, label: "PF2E.ActionsActionsHeader" },
    reaction: { sort: 1, label: "PF2E.ActionsReactionsHeader" },
    free: { sort: 2, label: "PF2E.ActionsFreeActionsHeader" },
    passive: { sort: 3, label: "PF2E.NPC.PassivesLabel" },
    exploration: { sort: 3, label: "PF2E.TravelSpeed.ExplorationActivity" },
};

const SKILL_EXCLUDE_EXCLUDE = [
    "Compendium.pf2e.actionspf2e.Item.IE2nThCmoyhQA0Jn", // avoid-notice
    "Compendium.sf2e.actions.Item.IE2nThCmoyhQA0Jn", // avoid-notice
];

const _cachedExcludedActions: string[] = [];

class ActionsSidebarAction extends BaseSidebarItem<FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>, ActionData> {
    get actor(): ActorPF2e {
        return this.item.actor;
    }

    removeEffect() {
        this.usage?.effect?.delete();
    }

    toggleExporation() {
        return toggleExploration(this.actor, this.id);
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

    toShortcut(): ActionShortcutData {
        return {
            img: this.img,
            itemId: this.item.id,
            name: this.label,
            type: "action",
        };
    }
}

interface ActionsSidebarAction extends Readonly<ActionData> {}

function getExcludedActions(): string[] {
    if (_cachedExcludedActions.length === 0) {
        const skillActions = getSkillActionGroups().contents.flatMap((x) => x.contents);

        for (const { sourceId } of skillActions) {
            if (SKILL_EXCLUDE_EXCLUDE.includes(sourceId)) continue;
            _cachedExcludedActions.push(sourceId);
        }

        for (const { sourceId } of getExtrasActions()) {
            _cachedExcludedActions.push(sourceId);
        }
    }

    return _cachedExcludedActions;
}

const _cached: { useLabel?: string; removeEffect?: string } = {};
async function getSidebarActionsData(this: ActionsSidebarPF2eHUD): Promise<ActionSection[] | undefined> {
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
    const excludedActions = getExcludedActions();
    const sections: PartialRecord<SectionType, ActionSection> = {};
    const useLabel = (_cached.useLabel ??= game.i18n.localize("PF2E.Action.Use"));
    const removeEffect = (_cached.removeEffect ??= localize("sidebar.removeEffect"));
    const getActionMacro = game.toolbelt?.api.actionable.getActionMacro;
    const tactics = isCharacter && game.dailies?.active ? game.dailies?.api.getCommanderTactics(actor) : undefined;

    const abilities = abilityTypes.flatMap(
        (type): (FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>)[] => actor.itemTypes[type],
    );

    const abilitiesPromises = abilities.map(async (item) => {
        const traits = item.system.traits.value;
        if (traits.includes("downtime")) return;
        if (traits.includes("stance") && item.system.selfEffect?.uuid) return;

        if (
            isSupressedFeat(item) ||
            (item.slug === "elemental-blast" && hasKineticAura) ||
            (item.isOfType("feat") && !item.actionCost)
        )
            return;

        const isExploration = isCharacter && traits.includes("exploration");
        if (!inParty && isExploration) return;

        const sourceId = item.sourceId;
        if (sourceId && excludedActions.includes(sourceId)) return;

        const actionCost = item.actionCost;
        const type = actionCost?.type ?? (isCharacter ? (isExploration ? "exploration" : "free") : "passive");

        const section = (sections[type] ??= {
            actions: [],
            filterValue: new FilterValue(),
            label: ACTION_TYPES[type].label,
            type,
        });

        const itemId = item.id;
        const crafting = !isExploration && item.crafting;
        const selfEffect = !isExploration && !crafting ? item.system.selfEffect : null;
        const resource = crafting ? getActionResource(item) : undefined;
        const frequency = !isExploration && !resource ? getActionFrequency(item) : undefined;
        const macro = !isExploration && actionableEnabled && (await getActionMacro?.(item));
        const usable = !!(frequency || selfEffect || crafting || macro);
        const effect = selfEffect && findItemWithSourceId(actor, selfEffect.uuid, "effect");

        const usage: MaybeFalsy<ActionUsage> = usable && {
            disabled: item.crafting ? resource?.value === 0 : frequency?.value === 0,
            effect,
            label: effect
                ? removeEffect
                : `${useLabel} <span class="action-glyph">${getActionGlyph(actionCost)}</span>`,
        };

        const exploration = isExploration && {
            active: explorations.includes(itemId),
        };

        const untrainedTacticBtn =
            tactics?.length && game.dailies?.api.isTacticAbility(item) && !tactics.includes(itemId)
                ? game.dailies?.api.createRetrainBtn(actor, itemId, "tactic")
                : undefined;

        const data: ActionData = {
            disabled: !!untrainedTacticBtn,
            exploration,
            frequency,
            id: itemId,
            img: getActionImg(item, macro),
            item,
            resource,
            toggles: item.system.traits.toggles?.getSheetData() ?? [],
            untrainedTactic: untrainedTacticBtn?.outerHTML,
            usage: usage || null,
        };

        const sidebarAction = this.addSidebarItem(ActionsSidebarAction, "id", data);
        section.actions.push(sidebarAction);
    });

    await Promise.all(abilitiesPromises);

    return R.pipe(
        sections,
        R.values(),
        R.sortBy((section) => ACTION_TYPES[section.type].sort),
        R.forEach((section) => {
            section.actions = R.sortBy(section.actions, (action) => action.item.name);
        }),
    );
}

function getActionImg(item: FeatPF2e | AbilityItemPF2e, macro: MaybeFalsy<MacroPF2e> | null): ImageFilePath {
    const actionIcon = getActionIcon(item.actionCost);
    const defaultIcon = getDocumentClass("Item").getDefaultArtwork(item._source).img;

    if (item.isOfType("action") && ![actionIcon, defaultIcon].includes(item.img)) {
        return item.img;
    }

    const selfEffect = item.system.selfEffect ? fromUuidSync(item.system.selfEffect.uuid) : undefined;

    if (selfEffect?.img) {
        return selfEffect.img;
    }

    if (macro && macro.img) {
        return macro.img;
    }

    return [actionIcon, defaultIcon, ...FEAT_ICON].includes(item.img) ? actionIcon : item.img;
}

function getActionFrequency(
    item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>,
): { max: number; value: number; label: string } | undefined {
    const frequency = item.frequency;
    if (!frequency?.max) return;

    const perLabel = game.i18n.localize(CONFIG.PF2E.frequencies[frequency.per]);

    return {
        max: frequency.max,
        value: frequency.value,
        label: `${frequency.max} / ${perLabel}`,
    };
}

function getActionResource(
    item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>,
): { max: number; value: number; slug: string; label: string } | undefined {
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
    target: HTMLElement,
) {
    switch (action) {
        case "remove-effect": {
            return sidebarItem.removeEffect();
        }

        case "toggle-exploration": {
            return sidebarItem.toggleExporation();
        }

        case "toggle-trait": {
            const trait = target.dataset.trait as string;
            return sidebarItem.toggleTrait(trait);
        }

        case "use-action": {
            return sidebarItem.use(event);
        }
    }
}

function toggleExploration(actor: ActorPF2e, actionId: string) {
    if (!actor.isOfType("character")) return;

    const explorations = actor.system.exploration.filter((id) => actor.items.has(id));

    if (!explorations.findSplice((id) => id === actionId)) {
        explorations.push(actionId);
    }

    return actor.update({ "system.exploration": explorations });
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
    disabled: boolean;
    exploration: MaybeFalsy<{ active: boolean }>;
    frequency: Maybe<LabeledValueAndMax>;
    id: string;
    img: ImageFilePath;
    item: AbilityItemPF2e<ActorPF2e> | FeatPF2e<ActorPF2e>;
    resource: Maybe<LabeledValueAndMax & { slug: string }>;
    toggles: TraitToggleViewData[];
    untrainedTactic: string | undefined;
    usage: Maybe<ActionUsage>;
};

export {
    ActionsSidebarAction,
    getActionFrequency,
    getActionImg,
    getActionResource,
    getSidebarActionsData,
    onActionClickAction,
    toggleExploration,
};
export type { ActionSection };
