import { sendItemToChat } from "hud";
import {
    ActorPF2e,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    createHTMLElement,
    getSpellRankLabel,
    htmlClosest,
    htmlQuery,
    ItemPF2e,
    RawItemChatData,
    ZeroToTen,
} from "module-helpers";
import { BaseHudPopup } from ".";

class ItemHudPopup extends BaseHudPopup {
    #item: ItemPF2e;
    #dataset: DOMStringMap | undefined;

    constructor(
        actor: ActorPF2e,
        item: ItemPF2e,
        event: Event,
        options?: DeepPartial<ApplicationConfiguration>
    ) {
        super(actor, options);

        this.#item = item as ItemPF2e;
        this.#dataset = htmlClosest(event.target, ".item[data-item-id]")?.dataset;
    }

    get item(): ItemPF2e {
        return this.#item;
    }

    get castRank(): ZeroToTen | undefined {
        const castRank = this.#dataset?.castRank;
        return castRank ? (Number(castRank) as ZeroToTen) : undefined;
    }

    get title(): string {
        let title = `${this.actor.name} - ${this.item.name}`;

        const castRank = this.castRank;
        if (typeof castRank === "number") {
            const label = getSpellRankLabel(castRank);
            title += ` (${label})`;
        }

        return title;
    }

    async _renderFrame(options: ApplicationRenderOptions) {
        const frame = await super._renderFrame(options);
        const configBtn = `<button type="button" class="header-control" data-action="send-to-chat" 
        data-tooltip="PF2E.NPC.SendToChat" aria-label="PF2E.NPC.SendToChat">
        <i class="fa-solid fa-message"></i></button>`;

        this.window.close.insertAdjacentHTML("beforebegin", configBtn);
        return frame;
    }

    protected async _prepareContext(options: ApplicationRenderOptions): Promise<ItemHudContext> {
        const actor = this.actor;
        const item = this.item as ItemPF2e<ActorPF2e>;
        const dataset = this.#dataset;

        return {
            actor,
            data: await this.item.getChatData({ secrets: actor.isOwner }, dataset),
            dataset,
            item,
            itemUuid: item.uuid,
        };
    }

    protected async _renderHTML(
        context: ItemHudContext,
        options: ApplicationRenderOptions
    ): Promise<unknown> {
        const summaryElement = createHTMLElement("div", {
            classes: ["item-summary", "item"],
            dataset: {
                ...context.dataset,
                tooltipClass: "pf2e",
            },
        });

        await context.actor.sheet.itemRenderer.renderItemSummary(
            summaryElement,
            context.item,
            context.data
        );

        const damageLinks = summaryElement.querySelectorAll<HTMLElement>("a[data-damage-roll]");
        for (const link of damageLinks) {
            link.dataset.itemUuid = context.itemUuid;
        }

        return summaryElement;
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
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

type ItemHudContext = {
    actor: ActorPF2e;
    data: RawItemChatData;
    dataset: DOMStringMap | undefined;
    item: ItemPF2e<ActorPF2e>;
    itemUuid: ItemUUID;
};

export { ItemHudPopup };
