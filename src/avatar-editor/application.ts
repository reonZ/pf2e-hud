import {
    addListener,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    CharacterPF2e,
    getDataFlag,
    htmlQuery,
    localize,
    NPCPF2e,
    render,
    setFlag,
    warning,
} from "module-helpers";
import { AvatarModel } from ".";

class AvatarEditor extends foundry.applications.api.ApplicationV2 {
    #actor: CharacterPF2e | NPCPF2e;
    #data!: AvatarModel;
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

    constructor(
        actor: CharacterPF2e | NPCPF2e,
        options: DeepPartial<ApplicationConfiguration> = {}
    ) {
        super(options);

        this.#actor = actor;
    }

    get title(): string {
        return localize("avatar-editor.title", this.actor);
    }

    get actor(): CharacterPF2e | NPCPF2e {
        return this.#actor;
    }

    get scale(): number {
        return this.#data.scale;
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
            this.#updateImage({ contain: true });
        } else if (action === "open-browser") {
            this.#openBrowser();
        } else if (action === "reset") {
            this.#resetData();
        } else if (action === "save") {
            this.#saveData();
        } else if (action === "use-actor-image") {
            this.#setImage(actor.img);
        } else if (action === "use-token-image") {
            this.#setImage(actor.prototypeToken.texture.src);
        }
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

    #saveData() {
        const viewport = this.viewportImage;
        if (!viewport) return;

        this.#data.updateSource({
            position: {
                x: this.#data.position.x / viewport.clientWidth,
                y: this.#data.position.y / viewport.clientHeight,
            },
        });

        setFlag(this.actor, "customAvatar", this.#data);
        this.close();
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

    #resetData() {
        const actor = this.actor;
        const data = getDataFlag(actor, AvatarModel, "customAvatar")?.clone();

        this.#data = data ?? new AvatarModel({ src: actor.img });
        this.#loadImage({ contain: !data, init: true });
        this.#updateColor();
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

        this.#data.updateSource({ src });
        this.#loadImage({ contain: true });
    }

    async #loadImage(options?: ImageOptions) {
        const inputElement = this.inputElement;
        const viewport = this.viewportImage;
        if (!inputElement || !viewport) return;

        const src = this.#data.src;
        const img: HTMLImageElement = await new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });

        inputElement.value = src;
        viewport.style.backgroundImage = `url("${src}")`;

        this.#img = img;
        this.#updateImage(options);
    }

    async #updateImage({ contain, init }: ImageOptions = {}) {
        const img = this.#img;
        const viewport = this.viewportImage;
        if (!img || !viewport) return;

        const scale = contain ? 1 : this.#data.scale;
        const width = img.width;
        const height = img.height;

        const scales: Point = { x: scale, y: scale };
        const viewW = viewport.clientWidth;
        const viewH = viewport.clientHeight;
        const ratio = viewW / viewH;

        if (width / ratio >= height) {
            scales.y *= (img.height / img.width) * ratio;
        } else {
            scales.x *= img.width / img.height / ratio;
        }

        const position: Point = contain
            ? {
                  x: (viewW - viewW * scales.x) / 2,
                  y: (viewH - viewH * scales.y) / 2,
              }
            : {
                  x: this.#data.position.x * (init ? viewW : 1),
                  y: this.#data.position.y * (init ? viewH : 1),
              };

        viewport.style.backgroundSize = `${scales.x * 100}% ${scales.y * 100}%`;
        viewport.style.backgroundPosition = `${position.x}px ${position.y}px`;

        this.#data.updateSource({ position, scale, scales });
    }

    #activateListeners(html: HTMLElement) {
        addListener(html, ".image", "wheel", (el, event) => {
            const delta = event.deltaY >= 0 ? -1 : 1;
            this.#data.updateSource({ scale: this.scale + delta * 0.05 });
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
            const originX = event.pageX;
            const originY = event.pageY;
            const originOffsetX = this.#data.position.x;
            const originOffsetY = this.#data.position.y;

            const position: Point = {
                x: originOffsetX,
                y: originOffsetY,
            };

            const pointerMove = (event: PointerEvent) => {
                position.x = originOffsetX + (event.pageX - originX);
                position.y = originOffsetY + (event.pageY - originY);

                el.style.backgroundPosition = `${position.x}px ${position.y}px`;
            };

            const pointerUp = (event: PointerEvent) => {
                window.removeEventListener("pointermove", pointerMove);
                this.#data.updateSource({ position });
            };

            window.addEventListener("pointermove", pointerMove);
            window.addEventListener("pointerup", pointerUp, { once: true });
        });
    }
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

type ImageOptions = { contain?: boolean; init?: boolean };

export { AvatarEditor };
