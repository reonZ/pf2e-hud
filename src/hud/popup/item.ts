import {
    ActorPF2e,
    createHTMLElement,
    htmlClosest,
    htmlQuery,
    ItemPF2e,
    ItemUUID,
    itemWithActor,
    RawItemChatData,
    ZeroToTen,
} from "foundry-helpers";
import { getSpellRankLabel } from "foundry-helpers/dist";
import { sendItemToChat } from "hud";
import { BaseHudPopup } from ".";

class ItemHudPopup extends BaseHudPopup {
    #item: ItemPF2e;
    #dataset: DOMStringMap | undefined;

    constructor(actor: ActorPF2e, item: ItemPF2e, event: Event, options?: DeepPartial<fa.ApplicationConfiguration>) {
        super(actor, options);

        this.#item = item;
        this.#dataset = htmlClosest(event.target, ".item")?.dataset;
    }

    get item(): ItemPF2e {
        return game.user.isGM && this.#item.isOfType("physical") && !this.#item.isIdentified
            ? this.#item.clone({ "system.identification.status": "identified" })
            : this.#item;
    }

    get castRank(): ZeroToTen | undefined {
        const castRank = this.#dataset?.castRank;
        return castRank ? (Number(castRank) as ZeroToTen) : undefined;
    }

    get title(): string {
        const item = this.item;

        let title = `${this.actor.name} - ${item.name}`;

        const castRank = this.castRank;
        if (typeof castRank === "number") {
            const label = getSpellRankLabel(castRank);
            title += ` (${label})`;
        }

        return title;
    }

    async _renderFrame(options: fa.ApplicationRenderOptions) {
        const frame = await super._renderFrame(options);

        const chatBtn = `<button type="button" class="header-control" data-action="send-to-chat"
        data-tooltip="PF2E.NPC.SendToChat" aria-label="PF2E.NPC.SendToChat">
        <i class="fa-solid fa-message"></i></button>`;

        this.window.close.insertAdjacentHTML("beforebegin", chatBtn);
        return frame;
    }

    protected async _prepareContext(_options: fa.ApplicationRenderOptions): Promise<ItemHudContext> {
        const actor = this.actor;
        const dataset = this.#dataset;
        const item = itemWithActor(actor, this.item);

        return {
            actor,
            data: await item.getChatData({ secrets: actor.isOwner }, dataset),
            dataset,
            item,
            itemUuid: item.uuid,
        };
    }

    protected async _renderHTML(context: ItemHudContext, _options: fa.ApplicationRenderOptions): Promise<HTMLElement> {
        const summaryElement = createHTMLElement("div", {
            classes: ["item-summary", "item"],
            dataset: {
                ...context.dataset,
                tooltipClass: "pf2e",
            },
        });

        await context.actor.sheet.itemRenderer.renderItemSummary(summaryElement, context.item, context.data);

        const damageLinks = summaryElement.querySelectorAll<HTMLElement>("a[data-damage-roll]");
        for (const link of damageLinks) {
            link.dataset.itemUuid = context.itemUuid;
        }

        return summaryElement;
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        if (event.button !== 0) return;

        type ActionEvent = "consume-item" | "send-to-chat";

        const action = target.dataset.action as ActionEvent;

        if (action === "consume-item") {
            const item = this.item;

            if (item.actor && item.isOfType("consumable")) {
                item.consume();
                this.close();
            }
        } else if (action === "send-to-chat") {
            const el = htmlQuery(this.element, ".item");

            if (el) {
                sendItemToChat(this.actor, event, el);
            }
        }
    }
}

type ItemHudContext = fa.ApplicationRenderContext & {
    actor: ActorPF2e;
    data: RawItemChatData;
    dataset: DOMStringMap | undefined;
    item: ItemPF2e<ActorPF2e>;
    itemUuid: ItemUUID;
};

export { ItemHudPopup };
