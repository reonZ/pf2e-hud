import { getUiScale } from "hud";

import {
    createHTMLElement,
    CreaturePF2e,
    DataModelConstructionContext,
    DocumentUUID,
    ImageFilePath,
    ItemPF2e,
    localize,
    MODULE,
    render,
    ValueAndMaybeMax,
    z,
    zFilePath,
} from "foundry-helpers";
import { ShortcutCache, ShortcutSlotId } from "..";

const zShortcutCustom = z.object({
    img: zFilePath(["IMAGE"]).nullish().catch(undefined),
    name: z.string().nonempty().nullish(),
});

function zBaseShortcut<T extends string>(type: T) {
    return z.object({
        custom: zShortcutCustom.prefault({}),
        img: zFilePath<ImageFilePath>(["IMAGE"]),
        name: z.string().nonempty(),
        type: z.literal(type).default(type),
    });
}

abstract class PersistentShortcut<
    TSchema extends BaseShortcut = ReturnType<typeof zBaseShortcut>,
    TItem extends ItemPF2e = ItemPF2e,
> {
    #actor: CreaturePF2e;
    #cached: ShortcutCache;
    #data: z.output<TSchema>;
    #element: HTMLElement | null = null;
    #item: Maybe<TItem>;
    #radial?: HTMLElement;
    #slot: number;
    #tooltip?: HTMLElement;

    static get schema(): ReturnType<typeof zBaseShortcut> {
        throw MODULE.Error("shortcut schema must be declared");
    }

    static async getItem(
        actor: CreaturePF2e,
        data: BaseShortcutSource,
        cached: ShortcutCache,
    ): Promise<Maybe<ItemPF2e>> {
        return null;
    }

    constructor(
        actor: CreaturePF2e,
        data: z.output<TSchema>,
        item: Maybe<ItemPF2e>,
        slot: number,
        cached: ShortcutCache,
        options?: DataModelConstructionContext<null>,
    ) {
        this.#actor = actor;
        this.#cached = cached;
        this.#data = data;
        this.#slot = slot;
        this.#item = item as Maybe<TItem>;

        for (const property in this.#data) {
            Object.defineProperty(this, property, {
                get() {
                    return this.#data[property];
                },
            });
        }
    }

    abstract get icon(): string;

    get isEmpty(): boolean {
        return false;
    }

    get actor(): CreaturePF2e {
        return this.#actor;
    }

    get worldActor(): CreaturePF2e {
        return (this.actor.token?.baseActor ?? this.actor) as CreaturePF2e;
    }

    get cached(): ShortcutCache {
        return this.#cached;
    }

    get slot(): number {
        return this.#slot;
    }

    get item(): Maybe<TItem> {
        return this.#item;
    }

    get dataset(): ShortcutDataset | null {
        return this.item ? { itemId: this.item.id } : null;
    }

    get inactive(): boolean {
        return !this.item;
    }

    get canUse(): boolean {
        return !!this.item;
    }

    get canOpenPopup(): boolean {
        return !!this.item;
    }

    get canAltUse(): boolean {
        return false;
    }

    get greyedOut(): boolean {
        return !this.canUse;
    }

    get usedImage(): ImageFilePath {
        return this.item?.img ?? this.img;
    }

    get label(): ShortcutLabel | null {
        return null;
    }

    get cost(): ShortcutCost | null {
        return null;
    }

    get checkbox(): { checked: boolean } | null {
        return null;
    }

    get uses(): ValueAndMaybeMax | null {
        return null;
    }

    get overlay(): string | null {
        return null;
    }

    get unusableReason(): string | undefined {
        return !this.item ? "match" : undefined;
    }

    get subtitle(): string {
        return this.item
            ? game.i18n.localize(`TYPES.Item.${this.item.type}`)
            : localize("shortcuts.tooltip.subtitle", this.type);
    }

    get title(): string {
        return this.item?.name ?? this.name;
    }

    get altUseLabel(): string {
        return game.i18n.localize("PF2E.EditItemTitle");
    }

    get elementId(): ShortcutSlotId {
        return `pf2e-hud-shortcut-${this.slot}`;
    }

    get element(): HTMLElement | null {
        return (this.#element ??= document.getElementById(this.elementId));
    }

    abstract use(event: MouseEvent): void;

    async _initShortcut(): Promise<void> {}

    altUse(event: MouseEvent): void {
        this.item?.sheet.render(true);
    }

    async tooltip(): Promise<HTMLElement> {
        if (this.#tooltip) {
            return this.#tooltip;
        }

        return (this.#tooltip = createHTMLElement("div", {
            classes: ["content"],
            content: await render("shortcuts/tooltip", this),
        }));
    }

    async radialMenu<T extends string>(
        sectionsFn: () => ShortcutRadialSection[],
        onSelect: (event: PointerEvent, value: T) => void,
    ) {
        const element = this.element;
        if (!element) return;

        const displayRadial = (radialElement: HTMLElement) => {
            document.body.appendChild(radialElement);

            const uiScale = getUiScale();
            const bounds = radialElement.getBoundingClientRect();
            const sBounds = element.getBoundingClientRect();
            const offsetHeight = (bounds.height / uiScale - bounds.height) / 2;

            const left = sBounds.left + sBounds.width / 2 - bounds.width / uiScale / 2;
            const top = sBounds.bottom - offsetHeight - bounds.height;

            radialElement.style.left = `${left}px`;
            radialElement.style.top = `${top}px`;

            return radialElement;
        };

        if (this.#radial) {
            displayRadial(this.#radial);
            return;
        }

        const sections = sectionsFn();
        const radial = createHTMLElement("div", {
            classes: ["pf2e-hud-element"],
            content: await render("shortcuts/radial", { sections }),
            id: "pf2e-hud-radial-panel",
        });

        radial.style.setProperty("--columns", String(sections.length));

        this.#radial = displayRadial(radial);

        const removeRadial = () => {
            radial.remove();
        };

        radial.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const target = event.target;

            removeRadial();

            if (
                target instanceof HTMLElement &&
                target.classList.contains("option") &&
                !target.classList.contains("selected")
            ) {
                onSelect(event, target.dataset.value as T);
            }
        });

        radial.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
        });

        radial.addEventListener("auxclick", (event) => {
            event.preventDefault();
            event.stopPropagation();
        });

        radial.addEventListener("mouseleave", removeRadial);
    }

    updateCustom({ img, name }: Required<ShortcutCustomSource>) {
        this.#data.custom = {
            img: img || undefined,
            name: name || undefined,
        };
    }

    encode(): z.input<TSchema> {
        return (this.constructor as typeof PersistentShortcut).schema.encode(this.#data) as z.input<TSchema>;
    }
}

interface PersistentShortcut extends Readonly<BaseShortcutData> {}

type ShortcutCustomSource = z.input<typeof zShortcutCustom>;

type BaseShortcut = ReturnType<typeof zBaseShortcut>;
type BaseShortcutSource = z.input<BaseShortcut>;
type BaseShortcutData = z.output<BaseShortcut>;

type ShortcutSource<T extends BaseShortcut = BaseShortcut> = z.input<T>;
type ShortcutData<T extends BaseShortcut = BaseShortcut> = Readonly<Omit<z.output<T>, "custom" | "type">>;

type ShortcutRadialSection = {
    title: string | undefined;
    options: ShortcutRadialOption[];
};

type ShortcutRadialOption = {
    value: string;
    label: string;
    selected?: boolean;
};

type ShortcutCost = {
    value: string | number;
    combo?: boolean;
};

type ShortcutLabel = {
    value: string;
    class: string;
};

type ShortcutDataset = { itemId: string } | { itemUuid: DocumentUUID };

export { PersistentShortcut, zBaseShortcut };
export type {
    ShortcutSource,
    ShortcutData,
    ShortcutCost,
    ShortcutDataset,
    ShortcutLabel,
    ShortcutRadialOption,
    ShortcutRadialSection,
};
