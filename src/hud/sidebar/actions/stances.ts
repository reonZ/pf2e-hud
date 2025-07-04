import { FilterValue, ShortcutData } from "hud";
import {
    AbilityItemPF2e,
    actorItems,
    ActorPF2e,
    EffectPF2e,
    FeatPF2e,
    findItemWithSourceId,
    getItemSourceFromUuid,
    hasItemWithSourceId,
    hasTokenThatMatches,
    isSupressedFeat,
    ItemPF2e,
    R,
} from "module-helpers";
import { ActionsSidebarPF2eHUD } from ".";
import { BaseSidebarItem } from "..";

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

class ActionsStance extends BaseSidebarItem<
    FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>,
    StanceData
> {
    get uuid(): string {
        return this.effectUUID;
    }

    get actor(): ActorPF2e {
        return this.item.actor;
    }

    get active(): boolean {
        return hasItemWithSourceId(this.actor, this.effectUUID, "effect");
    }

    async toggle(force?: boolean) {
        const actor = this.item.actor;
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
            return effectUUID === this.effectUUID;
        });

        if (effects.length) {
            await actor.deleteEmbeddedDocuments(
                "Item",
                effects.map(([_, id]) => id)
            );
        }

        if (!effect) {
            const source = await getItemSourceFromUuid(this.effectUUID, "EffectPF2e");
            if (!source) return;

            foundry.utils.setProperty(source, "flags.core.sourceId", this.effectUUID);
            foundry.utils.setProperty(source, "_stats.compendiumSource", this.effectUUID);

            const [item] = await actor.createEmbeddedDocuments("Item", [source]);
            item?.toMessage();
        } else if (!effects.length) {
            await actor.deleteEmbeddedDocuments("Item", [effect[1]]);
        }
    }

    toShortcut(): ShortcutData | undefined {
        return;
    }
}

interface ActionsStance extends Readonly<StanceData> {}

function getSidebarStancesData(this: ActionsSidebarPF2eHUD): StancesContext | undefined {
    const actor = this.actor;
    const stances = getStances(actor);
    if (!stances?.length) return;

    const actions = stances?.map((data) => {
        return this.addSidebarItem(ActionsStance, "id", data);
    });

    return {
        actions,
        canUseStances: canUseStances(actor),
        filterValue: new FilterValue(...actions),
    };
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
    effectUUID: string;
    img: ImageFilePath;
    item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e>;
    label: string;
    sourceUUID: ItemUUID;
};

export { ActionsStance, canUseStances, getSidebarStancesData, getStances, onStancesClickAction };
export type { StancesContext };
