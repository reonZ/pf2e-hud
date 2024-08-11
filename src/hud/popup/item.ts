import {
    addListener,
    createHTMLElement,
    getRankLabel,
    getSetting,
    htmlClosest,
    isOwnedItem,
    unownedItemtoMessage,
} from "foundry-pf2e";
import { PF2eHudPopup, PopupConfig } from "./base";

class PF2eHudItemPopup extends PF2eHudPopup<ItemPopupConfig> {
    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        actions: {
            sendToChat: this.#sendToChat,
        },
    };

    static #sendToChat(this: PF2eHudItemPopup, event: PointerEvent, target: HTMLElement) {
        this.item.actor
            ? this.item.toMessage(event)
            : unownedItemtoMessage(this.actor, this.item, event);
        if (getSetting("closePopupOnSendToChat")) this.close();
    }

    get title() {
        let title = `${this.actor.name} - ${this.item.name}`;

        const castRank = this.castRank;
        if (typeof castRank === "number") {
            title += ` (${getRankLabel(castRank)})`;
        }

        return title;
    }

    get item() {
        return this.config.item;
    }

    get dataset() {
        return htmlClosest(this.event.target, ".item[data-item-id]")?.dataset;
    }

    get castRank() {
        const castRank = this.dataset?.castRank;
        return castRank ? (Number(castRank) as ZeroToTen) : undefined;
    }

    async _renderFrame(options: ApplicationRenderOptions) {
        const frame = await super._renderFrame(options);

        const label = "PF2E.NPC.SendToChat";
        const configBtn = `<button type="button" class="header-control fa-solid fa-message" 
        data-action="sendToChat" data-tooltip="${label}" aria-label="${label}"></button>`;

        this.window.close.insertAdjacentHTML("beforebegin", configBtn);

        return frame;
    }

    async _renderHTML(context: never, options: ApplicationRenderOptions): Promise<HTMLElement> {
        const item = this.item;
        const actor = this.actor;
        const dataset = this.dataset;
        const data = await item.getChatData({ secrets: actor.isOwner }, dataset);

        const summaryElement = createHTMLElement("div", {
            classes: ["item-summary"],
            dataset: {
                ...dataset,
                tooltipClass: "pf2e",
            },
        });

        await actor.sheet.itemRenderer.renderItemSummary(summaryElement, item, data);

        return summaryElement;
    }

    _activateListeners(html: HTMLElement): void {
        const item = this.item;

        if (isOwnedItem(item) && item.isOfType("consumable")) {
            addListener(html, "[data-action='consume-item'", () => {
                item.consume();
                this.close();
            });
        }

        const damageLinks = html.querySelectorAll<HTMLElement>("a[data-damage-roll]");
        for (const link of damageLinks) {
            link.dataset.itemUuid = item.uuid;
        }
    }
}

type ItemPopupConfig = PopupConfig & {
    item: ItemPF2e;
};

export { PF2eHudItemPopup };
