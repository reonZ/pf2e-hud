import {
    addListener,
    CreaturePF2e,
    htmlQuery,
    ImageFilePath,
    localize,
    MODULE,
    render,
    setFlag,
    VideoFilePath,
} from "foundry-helpers";
import { AvatarData, getAvatarData, zAvatar } from ".";

class AvatarEditor extends foundry.applications.api.ApplicationV2 {
    #actor: CreaturePF2e;
    #data!: AvatarData;
    #img?: HTMLImageElement | HTMLVideoElement;
    #inputElement: HTMLInputElement | null = null;
    #viewport: HTMLElement | null = null;

    static DEFAULT_OPTIONS: DeepPartial<fa.ApplicationConfiguration> = {
        classes: ["standard-form"],
        id: "pf2e-hud-avatar-editor",
        window: {
            resizable: false,
            minimizable: true,
        },
    };

    constructor(actor: CreaturePF2e, options: DeepPartial<fa.ApplicationConfiguration> = {}) {
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
        return (this.#inputElement ??= htmlQuery<HTMLInputElement>(this.element, "input[name='src']"));
    }

    get viewportImage(): HTMLElement | null {
        return (this.#viewport ??= htmlQuery(this.element, ".viewport .image"));
    }

    protected async _prepareContext(_options: fa.ApplicationRenderOptions): Promise<AvatarEditorContext> {
        return {
            noBrowser: !game.user.can("FILES_BROWSE"),
        };
    }

    protected _renderHTML(context: AvatarEditorContext, _options: fa.ApplicationRenderOptions): Promise<string> {
        return render("avatar-editor", context);
    }

    protected _replaceHTML(result: string, content: HTMLElement, _options: fa.ApplicationRenderOptions) {
        content.innerHTML = result;

        this.#resetData();
        this.#activateListeners(content);
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement) {
        if (event.button !== 0) return;

        const actor = this.actor;
        const action = target.dataset.action as EventAction;

        if (action === "cancel") {
            this.close();
        } else if (action === "contain") {
            delete this.#data.position;
            this.#updateImage();
        } else if (action === "open-browser") {
            this.#openBrowser();
        } else if (action === "reset") {
            this.#resetData();
        } else if (action === "save") {
            const encoded = zAvatar.encode(this.#data);
            setFlag(this.actor, "avatar", encoded);
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
            type: "imagevideo",
            current: this.#data.src || this.actor.img,
        }).render({ force: true });
    }

    #setImage(src: Maybe<ImageFilePath | VideoFilePath>) {
        if (!src) {
            return localize.warning("avatar-editor.src.none");
        }

        const inputElement = this.inputElement;

        if (inputElement) {
            inputElement.value = src;
        }

        this.#data.src = src;
        delete this.#data.position;

        this.#loadImage();
    }

    #updateColor() {
        const colorCheckbox = htmlQuery<HTMLInputElement>(this.element, `.buttons .color input[type="checkbox"]`);
        const colorPicker = htmlQuery<HTMLInputElement>(this.element, `.buttons .color input[type="color"]`);
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
        const data = getAvatarData(this.actor);

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

        const scale = calculatePosition(this.#data, img);

        if (this.#data.position == null) {
            this.#data.scale = scale;
            this.#savePosition();
        }
    }

    #activateListeners(html: HTMLElement) {
        addListener(html, ".image", "wheel", (_el, event) => {
            const delta = event.deltaY >= 0 ? -1 : 1;
            this.#data.scale = this.#data.scale + delta * 0.05;
            this.#updateImage();
        });

        addListener(html, `.color input[type="color"]`, "change", (el: HTMLInputElement) => {
            this.#data.color.value = el.value;
            this.#updateColor();
        });

        addListener(html, `.color input[type="checkbox"]`, "change", (el: HTMLInputElement) => {
            this.#data.color.enabled = el.checked;
            this.#updateColor();
        });

        addListener(html, ".image", "pointerdown", (_el, event) => {
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

            const pointerUp = (_event: PointerEvent) => {
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

        this.#data.position = {
            x: parseInt(left) / viewH / scale,
            y: parseInt(top) / viewH / scale,
        };
    }
}

async function loadAvatar(parent: HTMLElement, data: AvatarData): Promise<HTMLImageElement | HTMLVideoElement> {
    const src = data.src;
    const img = foundry.helpers.media.VideoHelper.hasVideoExtension(src) ? await loadVideo(src) : await loadImage(src);

    if (img) {
        parent.replaceChildren(img);
    }

    return img;
}

function loadVideo(src: VideoFilePath): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            video.onloadedmetadata = null;
            resolve(video);
        };

        video.onerror = reject;
        video.src = src;
    });
}

function loadImage(src: ImageFilePath): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            resolve(img);
        };

        img.onerror = reject;
        img.src = src;
    });
}

function calculatePosition(data: AvatarData, img: HTMLImageElement | HTMLVideoElement): number {
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

    return scale;
}

function calculateContainedPosition(img: HTMLImageElement | HTMLVideoElement): number {
    const viewport = img.parentElement as HTMLElement;
    const isVideo = img instanceof HTMLVideoElement;

    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;
    const viewR = viewW / viewH;
    const imgW = isVideo ? img.videoWidth : img.width;
    const imgH = isVideo ? img.videoHeight : img.height;

    const scale = imgW / viewR >= imgH ? ((viewW / imgW) * imgH) / viewH : 1;

    img.height = viewH * scale;

    const { width, height } = getComputedStyle(img);

    const position: Point = {
        x: (viewW - parseInt(width)) / 2,
        y: (viewH - parseInt(height)) / 2,
    };

    img.style.left = `${position.x}px`;
    img.style.top = `${position.y}px`;

    return scale;
}

type EventAction = "cancel" | "contain" | "open-browser" | "reset" | "save" | "use-actor-image" | "use-token-image";

type AvatarEditorContext = fa.ApplicationRenderContext & {
    noBrowser: boolean;
};

export { AvatarEditor, calculatePosition as calculateAvatarPosition, loadAvatar };
