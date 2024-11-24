import { ApplicationRenderOptions, createHTMLElement } from "module-helpers";
import { PF2eHudPopup, PopupConfig } from "./base";

class PF2eHudTextPopup extends PF2eHudPopup<TextPopupConfig> {
    get title() {
        return `${this.actor.name} - ${this.config.title}`;
    }

    get content() {
        return this.config.content;
    }

    async _renderHTML(context: never, options: ApplicationRenderOptions): Promise<HTMLElement> {
        const content = await TextEditor.enrichHTML(this.content);
        return createHTMLElement("div", {
            innerHTML: content,
            classes: ["text-content"],
        });
    }
}

type TextPopupConfig = PopupConfig & {
    title: string;
    content: string;
};

export { PF2eHudTextPopup };
