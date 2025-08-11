import {
    ActorPF2e,
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    createHTMLElement,
} from "module-helpers";
import { BaseHudPopup } from ".";

class TextHudPopup extends BaseHudPopup {
    #content: string;

    constructor(
        actor: ActorPF2e,
        title: string,
        content: string,
        options: DeepPartial<ApplicationConfiguration> = {}
    ) {
        (options.window ??= {}).title = title;
        super(actor, options);
        this.#content = content;
    }

    async _renderHTML(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<HTMLElement> {
        return createHTMLElement("div", {
            classes: ["item-summary"],
            content: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
                this.#content
            ),
        });
    }
}

export { TextHudPopup };
