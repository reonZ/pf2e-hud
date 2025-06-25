import { BaseSidebarItem } from "hud";
import {
    AbilityItemPF2e,
    actorItems,
    ActorPF2e,
    EffectPF2e,
    FeatPF2e,
    findItemWithSourceId,
    getItemSourceFromUuid,
    hasTokenThatMatches,
    isSupressedFeat,
    ItemPF2e,
} from "module-helpers";

const REPLACERS = new Map([
    [
        "Compendium.pf2e.feats-srd.Item.nRjyyDulHnP5OewA", // gorilla pound

        {
            replace: "Compendium.pf2e.feats-srd.Item.DqD7htz8Sd1dh3BT", // gorilla stance
            effect: "Compendium.pf2e.feat-effects.Item.UZKIKLuwpQu47feK",
        },
    ],
]);

const EXTRAS = new Map([
    [
        "Compendium.pf2e.feats-srd.Item.xQuNswWB3eg1UM28", // cobra envenom
        { effect: "Compendium.pf2e.feat-effects.Item.2Qpt0CHuOMeL48rN" },
    ],
    [
        "Compendium.pf2e.feats-srd.Item.R7c4PyTNkZb0yvoT", // dread marshal
        {
            effect: "Compendium.pf2e.feat-effects.Item.qX62wJzDYtNxDbFv", // the stance aura
        },
    ],
    [
        "Compendium.pf2e.feats-srd.Item.bvOsJNeI0ewvQsFa", // inspiring marshal
        {
            effect: "Compendium.pf2e.feat-effects.Item.er5tvDNvpbcnlbHQ", // the stance aura
        },
    ],
]);

class ActionsSidebarStance extends BaseSidebarItem<FeatPF2e | AbilityItemPF2e, StanceData> {
    get img(): ImageFilePath {
        return this.effect.img;
    }

    get uuid(): string {
        return this.effect.uuid;
    }

    async toggle(force?: boolean) {
        const actor = this.item.actor;
        if (!force && !canUseStances(actor)) return;

        const effectUUID = this.uuid;
        const stances = (getStances(actor) ?? [])?.filter(
            (stance): stance is StanceWithExistingEffect => !!stance.active
        );
        const stance = stances.findSplice((stance) => stance.effect.uuid === effectUUID);

        if (stances.length) {
            await actor.deleteEmbeddedDocuments(
                "Item",
                stances.map(({ active }) => active.id)
            );
        }

        if (!stance) {
            const source = await getItemSourceFromUuid(effectUUID, "EffectPF2e");
            if (!source) return;

            foundry.utils.setProperty(source, "flags.core.sourceId", effectUUID);
            foundry.utils.setProperty(source, "_stats.compendiumSource", effectUUID);

            const [item] = await actor.createEmbeddedDocuments("Item", [source]);
            item?.toMessage();
        } else if (!stances.length) {
            await actor.deleteEmbeddedDocuments("Item", [stance.active.id]);
        }
    }
}

interface ActionsSidebarStance
    extends BaseSidebarItem<FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>, StanceData>,
        StanceData {
    get item(): FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>;
    get label(): string;
}

function isValidStance(stance: ItemPF2e): stance is FeatPF2e | AbilityItemPF2e {
    return (
        stance.isOfType("feat", "action") &&
        stance.system.traits.value.includes("stance") &&
        !!stance.system.selfEffect?.uuid
    );
}

function getStances(actor: ActorPF2e): StanceData[] | undefined {
    const stances: StanceData[] = [];
    const replaced = new Set<string>();

    for (const item of actorItems(actor, ["action", "feat"])) {
        if (isSupressedFeat(item)) continue;

        const sourceUUID = item.sourceId;
        if (!sourceUUID) continue;

        const replacer = REPLACERS.get(sourceUUID);
        const extra = EXTRAS.get(sourceUUID);
        if (!replacer && !extra && !isValidStance(item)) continue;

        const effectUUID = replacer?.effect ?? extra?.effect ?? item.system.selfEffect!.uuid;
        const effect = fromUuidSync<EffectPF2e>(effectUUID);
        if (!effect) continue;

        if (replacer?.replace) {
            replaced.add(replacer.replace);
        }

        const existingEffect = findItemWithSourceId(actor, effectUUID, "effect");
        const label = (replacer && fromUuidSync(replacer.replace)?.name) || item.name;

        const stanceData: StanceData = {
            active: existingEffect,
            effect,
            item,
            label,
            sourceUUID,
        };

        stances.push(stanceData);
    }

    const actions = stances.filter(({ sourceUUID }) => !replaced.has(sourceUUID));
    return actions.length ? actions : undefined;
}

function canUseStances(actor: ActorPF2e) {
    return hasTokenThatMatches(actor, (token) => token.inCombat);
}

function activateStancesListeners(
    event: MouseEvent,
    sidebarItem: ActionsSidebarStance,
    action: "toggle-stance" | (string & {})
) {
    if (action === "toggle-stance") {
        sidebarItem.toggle(event.ctrlKey);
    }
}

type StanceData = {
    active: EffectPF2e<ActorPF2e> | null;
    effect: EffectPF2e | CompendiumIndexData;
    item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>;
    label: string;
    sourceUUID: ItemUUID;
};

type StanceWithExistingEffect = Omit<StanceData, "active"> & { active: EffectPF2e<ActorPF2e> };

export { ActionsSidebarStance, activateStancesListeners, canUseStances, getStances };
