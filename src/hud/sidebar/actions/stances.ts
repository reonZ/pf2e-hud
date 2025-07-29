import { FilterValue, StanceShortcutData } from "hud";
import {
    AbilityItemPF2e,
    actorItems,
    ActorPF2e,
    CharacterPF2e,
    CreaturePF2e,
    EffectPF2e,
    FeatPF2e,
    findItemWithSourceId,
    getItemSourceFromUuid,
    hasItemWithSourceId,
    hasTokenThatMatches,
    isSupressedFeat,
    R,
} from "module-helpers";
import { ActionsSidebarPF2eHUD } from ".";
import { BaseSidebarItem } from "..";

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

class ActionsStance extends BaseSidebarItem<
    FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>,
    StanceData
> {
    get uuid(): string {
        return this.effectUUID;
    }

    get actor(): CreaturePF2e {
        return this.item.actor;
    }

    get active(): boolean {
        return hasItemWithSourceId(this.actor, this.effectUUID, "effect");
    }

    async toggle(force?: boolean): Promise<void> {
        toggleStance(this.actor, this.effectUUID, force);
    }

    toShortcut(): StanceShortcutData {
        return {
            effectUUID: this.effectUUID,
            img: this.img,
            itemId: this.id,
            name: this.label,
            type: "stance",
        };
    }
}

interface ActionsStance extends Readonly<StanceData> {}

async function addStance(actor: CreaturePF2e, sourceUUID: DocumentUUID, createMessage?: boolean) {
    const source = await getItemSourceFromUuid(sourceUUID, "EffectPF2e");
    if (!source) return;

    foundry.utils.setProperty(source, "flags.core.sourceId", sourceUUID);
    foundry.utils.setProperty(source, "_stats.compendiumSource", sourceUUID);

    const [item] = await actor.createEmbeddedDocuments("Item", [source]);

    if (item && createMessage) {
        item.toMessage();
    }
}

async function toggleStance(
    actor: CreaturePF2e,
    sourceUUID: DocumentUUID,
    force?: boolean
): Promise<void> {
    if (!force && !canUseStances(actor)) return;

    const effects = R.pipe(
        getStances(actor) ?? [],
        R.map(({ effectUUID }): [effectUUID: string, effectId: string] | undefined => {
            const effect = findItemWithSourceId(actor, effectUUID, "effect");
            return effect ? [effectUUID, effect.id] : undefined;
        }),
        R.filter(R.isTruthy)
    );

    const effect = effects.findSplice(([effectUUID]) => {
        return effectUUID === sourceUUID;
    });

    if (effects.length) {
        await actor.deleteEmbeddedDocuments(
            "Item",
            effects.map(([_, id]) => id)
        );
    }

    if (!effect) {
        await addStance(actor, sourceUUID);
    } else if (!effects.length) {
        await actor.deleteEmbeddedDocuments("Item", [effect[1]]);
    }
}

function getSidebarStancesData(this: ActionsSidebarPF2eHUD): StancesContext | undefined {
    const actor = this.actor as CharacterPF2e;
    const stances = getStances(actor);
    if (!stances?.length) return;

    const actions = stances.map((data) => {
        return this.addSidebarItem(ActionsStance, "id", data);
    });

    return {
        actions,
        canUseStances: canUseStances(actor),
        filterValue: new FilterValue(...actions),
    };
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

        if (
            !replacer &&
            !extra &&
            (!item.system.traits.value.includes("stance") || !item.system.selfEffect?.uuid)
        )
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

function canUseStances(actor: ActorPF2e) {
    return hasTokenThatMatches(actor, (token) => token.inCombat);
}

function onStancesClickAction(
    event: MouseEvent,
    sidebarItem: ActionsStance,
    action: Stringptionel<"toggle-stance">
) {
    if (action === "toggle-stance") {
        sidebarItem.toggle(event.ctrlKey);
    }
}

type StancesContext = {
    canUseStances: boolean;
    filterValue: FilterValue;
    actions: ActionsStance[];
};

type StanceData = {
    effectUUID: DocumentUUID;
    img: ImageFilePath;
    item: FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>;
    label: string;
    sourceUUID: ItemUUID;
};

export {
    ActionsStance,
    addStance,
    canUseStances,
    getSidebarStancesData,
    getStances,
    onStancesClickAction,
    toggleStance,
};
export type { StancesContext };
