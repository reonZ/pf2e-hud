import { ActorPF2e, htmlClosest, ItemPF2e, itemWithActor } from "foundry-helpers";

function getItemFromElement<T extends ItemPF2e>(actor: ActorPF2e, el: HTMLElement, sync: true): T | null;
function getItemFromElement<T extends ItemPF2e>(
    actor: ActorPF2e,
    el: HTMLElement,
    sync?: false,
): T | null | Promise<T | null>;
function getItemFromElement(actor: ActorPF2e, el: HTMLElement, sync?: boolean) {
    const element = htmlClosest(el, "[data-item-id]") ?? htmlClosest(el, "[data-item-uuid]");
    if (!element) return null;

    const { parentId, itemId, itemUuid, itemType, actionIndex, entryId } = element.dataset;

    const item = parentId
        ? actor.inventory.get(parentId, { strict: true }).subitems.get(itemId, { strict: true })
        : itemUuid
          ? fromUuid(itemUuid)
          : entryId
            ? (actor.spellcasting?.collections.get(entryId, { strict: true }).get(itemId, { strict: true }) ?? null)
            : itemType === "condition"
              ? actor.conditions.get(itemId, { strict: true })
              : actionIndex
                ? (actor.system.actions?.[Number(actionIndex)].item ?? null)
                : (actor.items.get(itemId ?? "") ?? null);

    if (sync) {
        return item instanceof Item ? item : null;
    } else {
        return item;
    }
}

async function sendItemToChat(actor: ActorPF2e, event: PointerEvent, el: HTMLElement) {
    const rawItem = await getItemFromElement(actor, el);
    const item = rawItem ? itemWithActor(actor, rawItem) : null;
    if (!item) return;

    if (item.isOfType("spell")) {
        const rankStr = htmlClosest(el, "[data-cast-rank]")?.dataset.castRank;
        const castRank = Number(rankStr ?? NaN);

        item.toMessage(event, { data: { castRank } });
    } else {
        item.toMessage(event);
    }
}

export { getItemFromElement, sendItemToChat };
