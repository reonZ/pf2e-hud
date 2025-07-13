import { getUiScale } from "hud";
import {
    createHTMLElement,
    CreaturePF2e,
    ItemPF2e,
    localize,
    render,
    ValueAndMaybeMax,
} from "module-helpers";
import { ShortcutCache, ShortcutSlotId } from "..";
import fields = foundry.data.fields;

function generateBaseShortcutFields<T extends string>(type: T): BaseShortcutSchema {
    return {
        custom: new fields.SchemaField({
            img: new fields.FilePathField({
                categories: ["IMAGE"],
                required: false,
                nullable: true,
            }),
            name: new fields.StringField({
                required: false,
                nullable: true,
            }),
        }),
        img: new fields.FilePathField({
            categories: ["IMAGE"],
            required: true,
            nullable: false,
        }),
        name: new fields.StringField({
            required: false,
            nullable: false,
        }),
        type: new fields.StringField({
            required: true,
            nullable: false,
            blank: false,
            initial: type,
            choices: [type],
        }),
    };
}

abstract class PersistentShortcut<
    TSchema extends BaseShortcutSchema = BaseShortcutSchema,
    TItem extends ItemPF2e = ItemPF2e
> extends foundry.abstract.DataModel<null, TSchema> {
    #actor: CreaturePF2e;
    #cached: ShortcutCache;
    #element: HTMLElement | null = null;
    #item: Maybe<TItem>;
    #radial?: HTMLElement;
    #slot: number;
    #tooltip?: HTMLElement;

    static async getItem(
        actor: CreaturePF2e,
        data: ShortcutSource<BaseShortcutSchema>,
        cached: ShortcutCache
    ): Promise<Maybe<ItemPF2e>> {
        return null;
    }

    constructor(
        actor: CreaturePF2e,
        data: DeepPartial<SourceFromSchema<TSchema>>,
        item: Maybe<ItemPF2e>,
        slot: number,
        cached: ShortcutCache,
        options?: DataModelConstructionOptions<null>
    ) {
        super(data, options);

        this.#actor = actor;
        this.#cached = cached;
        this.#slot = slot;
        this.#item = item as Maybe<TItem>;
    }

    abstract get icon(): string;

    get actor(): CreaturePF2e {
        return this.#actor;
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

    get canAltUse(): boolean {
        return false;
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
        onSelect: (value: T) => void
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
                onSelect(target.dataset.value as T);
            }
        });

        radial.addEventListener("contextmenu", (event) => {
            event.stopPropagation();
        });

        radial.addEventListener("auxclick", (event) => {
            event.stopPropagation();
        });

        radial.addEventListener("mouseleave", removeRadial);
    }
}

interface PersistentShortcut<TSchema extends BaseShortcutSchema, TItem extends ItemPF2e>
    extends ModelPropsFromSchema<BaseShortcutSchema> {}

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

type ShortcutCustomSchema = {
    img: fields.FilePathField<ImageFilePath, ImageFilePath, false, true, false>;
    name: fields.StringField<string, string, false, true, false>;
};

type BaseShortcutSchema = {
    custom: fields.SchemaField<ShortcutCustomSchema>;
    img: fields.FilePathField<ImageFilePath, ImageFilePath, true, false, false>;
    name: fields.StringField;
    type: fields.StringField<string, string, true, false, true>;
};

type ShortcutDataset = { itemId: string } | { itemUuid: DocumentUUID };

type ShortcutSource<T extends BaseShortcutSchema> = Omit<SourceFromSchema<T>, "custom">;

export { generateBaseShortcutFields, PersistentShortcut };
export type {
    BaseShortcutSchema,
    ShortcutCost,
    ShortcutDataset,
    ShortcutLabel,
    ShortcutRadialSection,
    ShortcutSource,
};
