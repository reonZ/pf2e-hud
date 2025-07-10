import {
    createHTMLElement,
    CreaturePF2e,
    ItemPF2e,
    localize,
    R,
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

    get rank(): { value: string } | null {
        return null;
    }

    get icon(): string | null {
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

        const canAltUse = this.canAltUse;
        const reason = this.unusableReason;

        const data: ShortcutTooltipData = {
            altUse: canAltUse ? this.altUseLabel : null,
            img: this.custom.img || this.usedImage,
            inactive: this.inactive,
            reason: reason ? localize("shortcuts.tooltip.reason", reason) : null,
            subtitle: this.subtitle,
            title: this.custom.name || this.title,
            uses: this.uses,
        };

        return (this.#tooltip = createHTMLElement("div", {
            classes: ["content"],
            content: await render("shortcuts/tooltip", data),
        }));
    }

    async radialMenu<T extends string>(
        title: string,
        sections: () => (ShortcutRadialSection | ShortcutRadialOption[])[],
        onSelect: (value: T) => void
    ) {
        const element = this.element;
        if (!element) return;

        if (this.#radial) {
            element.appendChild(this.#radial);
            return;
        }

        const radial = createHTMLElement("div", {
            classes: ["radial-panel"],
            content: await render("shortcuts/radial", {
                title: this.custom.name || this.title,
                sections: sections().map((section): ShortcutRadialSection => {
                    return R.isArray(section) ? { title: undefined, options: section } : section;
                }),
            }),
        });

        radial.style.setProperty("--columns", String(sections.length));

        element.appendChild(radial);

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

        this.#radial = radial;
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

type ShortcutTooltipData = {
    altUse: string | null;
    img: ImageFilePath;
    inactive: boolean;
    reason: string | null;
    subtitle: string;
    title: string;
    uses: ValueAndMaybeMax | null;
};

type ShortcutCost = {
    value: string | number;
    combo: boolean;
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
export type { BaseShortcutSchema, ShortcutCost, ShortcutDataset, ShortcutSource };
