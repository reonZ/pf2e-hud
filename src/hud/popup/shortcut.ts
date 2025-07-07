import { PersistentShortcut } from "hud";
import {
    ActorPF2e,
    addListener,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    htmlQuery,
    ItemPF2e,
    localize,
    localizePath,
    waitDialog,
} from "module-helpers";
import { ItemHudPopup } from ".";

class ShortcutPopup extends ItemHudPopup {
    #save: () => void;
    #shortcut: PersistentShortcut;

    constructor(
        actor: ActorPF2e,
        shortcut: PersistentShortcut,
        save: () => void,
        event: Event,
        options?: DeepPartial<ApplicationConfiguration>
    ) {
        super(actor, shortcut.item as ItemPF2e, event, options);
        this.#save = save;
        this.#shortcut = shortcut;
    }

    get shortcut(): PersistentShortcut {
        return this.#shortcut;
    }

    async _renderFrame(options: ApplicationRenderOptions) {
        const frame = await super._renderFrame(options);
        const tooltip = localizePath("popup.shortcut.config");

        const configBtn = `<button type="button" class="header-control" data-action="edit-shortcut" 
        data-tooltip="${tooltip}">
        <i class="fa-solid fa-gear"></i></button>`;

        const sibling = htmlQuery(frame, `[data-action="send-to-chat"]`) ?? this.window.close;
        sibling.insertAdjacentHTML("beforebegin", configBtn);

        return frame;
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        if (event.button === 0 && target.dataset.action === "edit-shortcut") {
            this.#editShortcut();
            this.close();
            return;
        }

        super._onClickAction(event, target);
    }

    async #editShortcut() {
        const result = await waitDialog<{ image: string; name: string }>({
            content: "shortcuts/config",
            data: {
                image: {
                    placeholder: this.shortcut.usedImage,
                    value: this.shortcut.custom.img,
                },
                name: {
                    placeholder: this.shortcut.title,
                    value: this.shortcut.custom.name,
                },
                noBrowser: !game.user.can("FILES_BROWSE"),
            },
            disabled: true,
            i18n: "edit-shortcut",
            onRender: (event, dialog) => {
                addListener(dialog.element, `[data-action="open-browser"]`, (el) => {
                    const input = htmlQuery<HTMLInputElement>(dialog.element, `[name="image"]`);
                    if (!input) return;

                    new foundry.applications.apps.FilePicker.implementation({
                        callback: (path) => {
                            input.value = path;
                        },
                        allowUpload: false,
                        type: "image",
                        current: input?.value || this.shortcut.usedImage,
                    }).render(true);
                });
            },
            title: localize("popup.shortcut.config"),
        });

        if (!result || (!result.image && !result.name)) return;

        this.shortcut.updateSource({
            custom: {
                img: result.image || undefined,
                name: result.name || undefined,
            },
        });

        this.#save();
    }
}

export { ShortcutPopup };
