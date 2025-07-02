import {
    addListener,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    CreaturePF2e,
    FlagData,
    getDataFlag,
    htmlQuery,
    localize,
    MODULE,
    render,
    warning,
} from "module-helpers";
import { AvatarModel } from ".";

class AvatarEditor extends foundry.applications.api.ApplicationV2 {
    #actor: CreaturePF2e;
    #data!: FlagData<AvatarModel>;
    #img?: HTMLImageElement;
    #inputElement: HTMLInputElement | null = null;
    #viewport: HTMLElement | null = null;

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        classes: ["standard-form"],
        id: "pf2e-hud-avatar-editor",
        window: {
            resizable: false,
            minimizable: true,
        },
    };

    constructor(actor: CreaturePF2e, options: DeepPartial<ApplicationConfiguration> = {}) {
        super(options);
        this.#actor = actor;
    }

    get title(): string {
        return localize("avatar-editor.title", this.actor);
    }

    get actor(): CreaturePF2e {
        return this.#actor;
    }

    get inputElement(): HTMLInputElement | null {
        return (this.#inputElement ??= htmlQuery<HTMLInputElement>(
            this.element,
            "input[name='src']"
        ));
    }

    get viewportImage(): HTMLElement | null {
        return (this.#viewport ??= htmlQuery(this.element, ".viewport .image"));
    }

    protected async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<AvatarEditorContext> {
        return {
            noBrowser: !game.user.can("FILES_BROWSE"),
        };
    }

    protected _renderHTML(
        context: AvatarEditorContext,
        options: ApplicationRenderOptions
    ): Promise<string> {
        return render("avatar-editor", context);
    }

    protected _replaceHTML(
        result: string,
        content: HTMLElement,
        options: ApplicationRenderOptions
    ) {
        content.innerHTML = result;

        this.#resetData();
        this.#activateListeners(content);
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement) {
        const actor = this.actor;
        const action = target.dataset.action as EventAction;

        if (action === "cancel") {
            this.close();
        } else if (action === "contain") {
            this.#data.updateSource({ position: undefined, scale: 1 });
            this.#updateImage();
        } else if (action === "open-browser") {
            this.#openBrowser();
        } else if (action === "reset") {
            this.#resetData();
        } else if (action === "save") {
            this.#data.setFlag();
            this.close();
        } else if (action === "use-actor-image") {
            this.#setImage(actor.img);
        } else if (action === "use-token-image") {
            this.#setImage(actor.prototypeToken.texture.src);
        }
    }

    #openBrowser() {
        new foundry.applications.apps.FilePicker.implementation({
            callback: (path: string) => {
                this.#setImage(path as ImageFilePath | VideoFilePath);
            },
            allowUpload: false,
            type: "image",
            current: this.#data.src || this.actor.img,
        }).render(true);
    }

    #setImage(src: Maybe<ImageFilePath | VideoFilePath>) {
        if (!src) {
            return warning("avatar-editor.src.none");
        }

        if (foundry.helpers.media.VideoHelper.hasVideoExtension(src)) {
            return warning("avatar-editor.src.video");
        }

        const inputElement = this.inputElement;

        if (inputElement) {
            inputElement.value = src;
        }

        this.#data.updateSource({ src, position: undefined, scale: 1 });
        this.#loadImage();
    }

    #updateColor() {
        const colorCheckbox = htmlQuery<HTMLInputElement>(
            this.element,
            `.buttons .color input[type="checkbox"]`
        );
        const colorPicker = htmlQuery<HTMLInputElement>(
            this.element,
            `.buttons .color input[type="color"]`
        );
        const viewport = this.viewportImage;

        if (!viewport || !colorPicker || !colorCheckbox) return;

        colorCheckbox.checked = this.#data.color.enabled;
        colorPicker.value = this.#data.color.value;

        if (this.#data.color.enabled) {
            viewport.style.setProperty("background-color", this.#data.color.value);
        } else {
            viewport.style.removeProperty("background-color");
        }
    }

    #resetData() {
        const actor = this.actor;

        const data = getDataFlag(actor, AvatarModel, "avatar", {
            fallback: { src: actor.img },
        });

        if (!data) {
            throw MODULE.Error("an error occured in AvatarEditor");
        }

        this.#data = data;

        this.#loadImage();
        this.#updateColor();
    }

    async #loadImage() {
        const inputElement = this.inputElement;
        const viewport = this.viewportImage;
        if (!inputElement || !viewport) return;

        this.#img = await loadAvatar(viewport, this.#data);

        inputElement.value = this.#img.src;

        this.#updateImage();
    }

    async #updateImage() {
        const img = this.#img;
        if (!img) return;

        calculatePosition(this.#data, img);

        if (this.#data.position == null) {
            this.#data.updateSource({ scale: 1 });
            this.#savePosition();
        }
    }

    #activateListeners(html: HTMLElement) {
        addListener(html, ".image", "wheel", (el, event) => {
            const delta = event.deltaY >= 0 ? -1 : 1;
            this.#data.updateSource({ scale: this.#data.scale + delta * 0.05 });
            this.#updateImage();
        });

        addListener(html, `.color input[type="color"]`, "change", (el: HTMLInputElement) => {
            this.#data.updateSource({ "color.value": el.value });
            this.#updateColor();
        });

        addListener(html, `.color input[type="checkbox"]`, "change", (el: HTMLInputElement) => {
            this.#data.updateSource({ "color.enabled": el.checked });
            this.#updateColor();
        });

        addListener(html, ".image", "pointerdown", (el, event) => {
            const img = this.#img;
            const viewport = this.viewportImage;
            if (!img || !viewport) return;

            const { left, top } = getComputedStyle(img);

            const originX = event.pageX;
            const originY = event.pageY;
            const originOffsetX = parseInt(left);
            const originOffsetY = parseInt(top);

            const position: Point = {
                x: originOffsetX,
                y: originOffsetY,
            };

            const pointerMove = (event: PointerEvent) => {
                position.x = originOffsetX + (event.pageX - originX);
                position.y = originOffsetY + (event.pageY - originY);

                img.style.left = `${position.x}px`;
                img.style.top = `${position.y}px`;
            };

            const pointerUp = (event: PointerEvent) => {
                window.removeEventListener("pointermove", pointerMove);
                this.#savePosition();
            };

            window.addEventListener("pointermove", pointerMove);
            window.addEventListener("pointerup", pointerUp, { once: true });
        });
    }

    #savePosition() {
        const img = this.#img;
        const scale = this.#data.scale;
        const viewH = this.viewportImage?.clientHeight;
        if (!viewH || !img) return;

        const { left, top } = getComputedStyle(img);

        this.#data.updateSource({
            position: {
                x: parseInt(left) / viewH / scale,
                y: parseInt(top) / viewH / scale,
            },
        });
    }
}

async function loadAvatar(parent: HTMLElement, data: AvatarModel): Promise<HTMLImageElement> {
    const src = data.src;

    const img: HTMLImageElement = await new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

    parent.replaceChildren(img);

    return img;
}

function calculatePosition(data: AvatarModel, img: HTMLImageElement) {
    if (data.position == null) {
        return calculateContainedPosition(img);
    }

    const viewport = img.parentElement as HTMLElement;

    const scale = data.scale;
    const { x, y } = data.position;
    const viewH = viewport.clientHeight;

    img.height = viewH * scale;
    img.style.left = `${viewH * scale * x}px`;
    img.style.top = `${viewH * scale * y}px`;
}

function calculateContainedPosition(img: HTMLImageElement) {
    const viewport = img.parentElement as HTMLElement;

    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;
    const viewR = viewW / viewH;
    const imgW = img.width;
    const imgH = img.height;

    const scale = imgW / viewR >= imgH ? ((viewW / imgW) * imgH) / viewH : 1;

    img.height = viewH * scale;

    const position: Point = {
        x: (viewW - img.width) / 2,
        y: (viewH - img.height) / 2,
    };

    img.style.left = `${position.x}px`;
    img.style.top = `${position.y}px`;
}

type EventAction =
    | "cancel"
    | "contain"
    | "open-browser"
    | "reset"
    | "save"
    | "use-actor-image"
    | "use-token-image";

type AvatarEditorContext = {
    noBrowser: boolean;
};

export { AvatarEditor, calculatePosition as calculateAvatarPosition, loadAvatar };
