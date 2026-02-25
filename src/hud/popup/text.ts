import { ActorPF2e, createHTMLElement } from "foundry-helpers";
import { BaseHudPopup } from ".";

class TextHudPopup extends BaseHudPopup {
    #content: string;

    constructor(
        actor: ActorPF2e,
        title: string,
        content: string,
        options: DeepPartial<fa.ApplicationConfiguration> = {},
    ) {
        (options.window ??= {}).title = title;
        super(actor, options);
        this.#content = content;
    }

    async _renderHTML(
        _context: fa.ApplicationRenderContext,
        _options: fa.ApplicationRenderOptions,
    ): Promise<HTMLElement> {
        return createHTMLElement("div", {
            classes: ["item-summary"],
            content: await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.#content),
        });
    }
}

export { TextHudPopup };
