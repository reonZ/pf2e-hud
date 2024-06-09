import { addListener, createHTMLElement, getRankLabel, htmlClosest } from "module-api";
import { PF2eHudPopup, PopupConfig } from "./base";

class PF2eHudItemPopup extends PF2eHudPopup<ItemPopupConfig> {
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
        return htmlClosest(this.event.target, ".item[data-item-id]")!.dataset;
    }

    get castRank() {
        const castRank = this.dataset.castRank;
        return castRank ? (Number(castRank) as ZeroToTen) : undefined;
    }

    async _prepareContext(options: ApplicationRenderOptions): Promise<ItemPopupContext> {
        const data: ItemPopupContext = {};

        return data;
    }

    async _renderHTML(
        context: ItemPopupContext,
        options: ApplicationRenderOptions
    ): Promise<HTMLElement> {
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

        if (item.isOfType("consumable")) {
            addListener(html, "[data-action='consume-item'", () => {
                item.consume();
                this.close();
            });
        }
    }
}

type ItemPopupContext = {};

type ItemPopupConfig = PopupConfig & {
    item: ItemPF2e<ActorPF2e>;
};

export { PF2eHudItemPopup };
