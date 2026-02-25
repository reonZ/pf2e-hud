import {
    actorItems,
    ActorPF2e,
    CreaturePF2e,
    DocumentUUID,
    EffectPF2e,
    findItemWithSourceId,
    getFirstTokenThatMatches,
    getItemSourceFromUuid,
    isSupressedFeat,
    R,
} from "foundry-helpers";

const REPLACERS: Map<DocumentUUID, { replace: DocumentUUID; effect: DocumentUUID }> = new Map([
    [
        "Compendium.pf2e.feats-srd.Item.nRjyyDulHnP5OewA", // gorilla pound
        {
            replace: "Compendium.pf2e.feats-srd.Item.DqD7htz8Sd1dh3BT", // gorilla stance
            effect: "Compendium.pf2e.feat-effects.Item.UZKIKLuwpQu47feK",
        },
    ],
]);

const EXTRAS: Map<DocumentUUID, { effect: DocumentUUID }> = new Map([
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

async function toggleStance(actor: CreaturePF2e, sourceUUID: DocumentUUID, force?: boolean): Promise<void> {
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
        const effect = fromUuidSync<EffectPF2e>(effectUUID);
        if (!effect) continue;

        if (replacer?.replace) {
            replaced.add(replacer.replace);
        }

        const label = (replacer && fromUuidSync(replacer.replace)?.name) || item.name;

        const stanceData: StanceData = {
            effectUUID,
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

type StanceData = hud.StanceData;

export { addStance, canUseStances, getStances, toggleStance };
