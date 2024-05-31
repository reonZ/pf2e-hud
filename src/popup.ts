import { closest, isInstanceOf } from "pf2e-api";
import { getItemFromElement } from "./shared";

type PF2eHudPopupConfig = {
    content: HTMLElement;
    actor: ActorPF2e;
};

class PF2eHudPopup extends foundry.applications.api.ApplicationV2 {
    #config: PF2eHudPopupConfig;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud-popup-{id}",
        window: {
            positioned: true,
            resizable: false,
            minimizable: true,
            frame: true,
        },
    };

    constructor(config: PF2eHudPopupConfig, options?: Partial<ApplicationConfiguration>) {
        super(options);
        this.#config = config;
    }

    static async showItemSummary(actor: ActorPF2e, el: HTMLElement, title?: string) {
        const target = closest(el, ".item");
        if (!target) return;

        const { itemId, uuid, castRank } = target.dataset;
        const item = itemId ? getItemFromElement(actor, target) : await fromUuid(uuid);

        if (!isInstanceOf<ItemPF2e>(item, "ItemPF2e")) return;

        const data = await item.getChatData({ secrets: item.actor.isOwner }, target.dataset);
        if (!data) return;

        const summaryElement = document.createElement("div");
        summaryElement.classList.add("item-summary");
        summaryElement.dataset.tooltipClass = "pf2e";

        await actor.sheet.itemRenderer.renderItemSummary(summaryElement, item, data);
        // InlineRollLinks.listen(description, item);

        if (item.isOfType("consumable")) {
            const consumeLinks = summaryElement.querySelectorAll("[data-action='consume-item']");
            for (const btn of consumeLinks) {
                btn.addEventListener("click", () => item.consume());
            }
        }

        if (castRank) {
            summaryElement.dataset.castRank = castRank;
        }

        title ??= target.querySelector(".name")?.textContent ?? "";
        new PF2eHudPopup({ actor, content: summaryElement }, { window: { title } }).render(true);
    }

    get contentElement() {
        return this.#config.content;
    }

    async _renderHTML(context: any, options: ApplicationRenderOptions): Promise<HTMLElement> {
        return this.contentElement;
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement, options: ApplicationRenderOptions) {
        content.replaceChildren(result);
        this.#activateListeners(result);
    }

    close(options: ApplicationClosingOptions = {}): Promise<ApplicationV2> {
        options.animate = false;
        return super.close(options);
    }

    #activateListeners(html: HTMLElement) {
        const consumeElements = html.querySelectorAll("[data-action^='consume-']");
        for (const consumeElement of consumeElements) {
            consumeElement.addEventListener("click", () => this.close());
        }
    }
}

export { PF2eHudPopup };
