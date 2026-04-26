import {
    AbilityItemPF2e,
    actorItems,
    ActorPF2e,
    CreaturePF2e,
    DocumentUUID,
    EffectPF2e,
    FeatPF2e,
    findItemWithSourceId,
    getFirstTokenThatMatches,
    getItemSourceFromUuid,
    isSupressedFeat,
    ItemUUID,
    R,
    SYSTEM,
} from "foundry-helpers";
import { createDuplicateMap } from "foundry-helpers/src";

const REPLACERS: Map<ItemUUID, { replace: () => ItemUUID; effect: ItemUUID }> = createDuplicateMap([
    [
        // gorilla pound
        ["Compendium.pf2e.feats-srd.Item.nRjyyDulHnP5OewA", "Compendium.pf2e-anachronism.feats.Item.nRjyyDulHnP5OewA"],
        {
            replace: SYSTEM.itemUuid(
                "Compendium.pf2e.feats-srd.Item.DqD7htz8Sd1dh3BT",
                "Compendium.pf2e-anachronism.feats.Item.DqD7htz8Sd1dh3BT",
            ), // gorilla stance
            effect: "Compendium.pf2e.feat-effects.Item.UZKIKLuwpQu47feK", // gorilla stance (pound),
        },
    ],
]);

const EXTRAS: Map<ItemUUID, { effect: ItemUUID }> = createDuplicateMap([
    [
        // dread marshal
        ["Compendium.pf2e.feats-srd.Item.R7c4PyTNkZb0yvoT", "Compendium.pf2e-anachronism.feats.Item.R7c4PyTNkZb0yvoT"],
        { effect: "Compendium.pf2e.feat-effects.Item.qX62wJzDYtNxDbFv" }, // the stance aura
    ],
    [
        // inspiring marshal
        ["Compendium.pf2e.feats-srd.Item.bvOsJNeI0ewvQsFa", "Compendium.pf2e-anachronism.feats.Item.bvOsJNeI0ewvQsFa"],
        {
            effect: "Compendium.pf2e.feat-effects.Item.er5tvDNvpbcnlbHQ", // the stance aura
        },
    ],
]);

async function toggleStance({ actor, effectUUID: sourceUUID }: ToggleStanceData, force?: boolean): Promise<void> {
    if (!force && !canUseStances(actor)) return;

    const effects = R.pipe(
        getStances(actor) ?? [],
        R.map(({ effectUUID }): [effectUUID: string, effectId: string] | undefined => {
            const effect = findItemWithSourceId(actor, effectUUID, "effect");
            return effect ? [effectUUID, effect.id] : undefined;
        }),
        R.filter(R.isTruthy),
    );

    const effect = effects.findSplice(([effectUUID]) => {
        return effectUUID === sourceUUID;
    });

    if (effects.length) {
        await actor.deleteEmbeddedDocuments(
            "Item",
            effects.map(([_, id]) => id),
        );
    }

    if (!effect) {
        await addStance(actor, sourceUUID);
    } else if (!effects.length) {
        await actor.deleteEmbeddedDocuments("Item", [effect[1]]);
    }
}

async function addStance(actor: CreaturePF2e, sourceUUID: DocumentUUID, createMessage?: boolean) {
    const source = await getItemSourceFromUuid(sourceUUID, "effect");
    if (!source) return;

    foundry.utils.setProperty(source, "flags.core.sourceId", sourceUUID);
    foundry.utils.setProperty(source, "_stats.compendiumSource", sourceUUID);

    const [item] = await actor.createEmbeddedDocuments("Item", [source]);

    if (item && createMessage) {
        item.toMessage();
    }
}

function canUseStances(actor: ActorPF2e): boolean {
    return !!getFirstTokenThatMatches(actor, (token) => token.inCombat);
}

function getStances(actor: CreaturePF2e): StanceData[] | undefined {
    const stances: StanceData[] = [];
    const replaced = new Set<string>();

    for (const item of actorItems(actor, ["action", "feat"])) {
        if (isSupressedFeat(item)) continue;

        const sourceUUID = item.sourceId;
        if (!sourceUUID) continue;

        const replacer = REPLACERS.get(sourceUUID);
        const extra = EXTRAS.get(sourceUUID);

        if (!replacer && !extra && (!item.system.traits.value.includes("stance") || !item.system.selfEffect?.uuid))
            continue;

        const effectUUID = replacer?.effect ?? extra?.effect ?? item.system.selfEffect!.uuid;
        const effect = fromUuidSync<EffectPF2e>(effectUUID, { strict: false });
        if (!effect) continue;

        const replace = replacer?.replace();

        if (replace) {
            replaced.add(replace);
        }

        const label = (replace && fromUuidSync(replace, { strict: false })?.name) || item.name;

        const stanceData: StanceData = {
            effectUUID: effectUUID as ItemUUID,
            img: effect.img,
            item,
            label,
            sourceUUID,
        };

        stances.push(stanceData);
    }

    const actions = stances.filter(({ sourceUUID }) => !replaced.has(sourceUUID));
    return actions.length ? actions : undefined;
}

type ToggleStanceData = {
    actor: CreaturePF2e;
    effectUUID: ItemUUID;
    item: AbilityItemPF2e<CreaturePF2e> | FeatPF2e<CreaturePF2e>;
};

type StanceData = hud.StanceData;

export { addStance, canUseStances, getStances, toggleStance };
export type { ToggleStanceData };
