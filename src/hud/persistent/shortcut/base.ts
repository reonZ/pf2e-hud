import {
    addListenerAll,
    createHTMLElement,
    CreaturePF2e,
    ItemPF2e,
    localize,
    render,
    ValueAndMaybeMax,
} from "module-helpers";
import fields = foundry.data.fields;

function generateBaseShortcutFields<T extends string>(type: T): BaseShortcutSchema {
    return {
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
    #element: HTMLElement | null = null;
    #item: Maybe<TItem>;
    #radial?: HTMLElement;
    #slot: number;
    #tooltip?: HTMLElement;

    static getItem(
        actor: CreaturePF2e,
        data: SourceFromSchema<BaseShortcutSchema>
    ): Maybe<ItemPF2e> {
        return null;
    }

    constructor(
        actor: CreaturePF2e,
        data: DeepPartial<SourceFromSchema<TSchema>>,
        slot: number,
        options?: DataModelConstructionOptions<null>
    ) {
        super(data, options);

        this.#actor = actor;
        this.#slot = slot;
        this.#item = (this.constructor as typeof PersistentShortcut).getItem(
            actor,
            data as SourceFromSchema<TSchema>
        ) as Maybe<TItem>;
    }

    get actor(): CreaturePF2e {
        return this.#actor;
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

    get canUse(): boolean {
        return !!this.item;
    }

    get canAltUse(): boolean {
        return !!this.item;
    }

    get usedImage(): ImageFilePath {
        return this.item?.img ?? this.img;
    }

    get checkbox(): { checked: boolean } | null {
        return null;
    }

    get counter(): ValueAndMaybeMax | null {
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

    get element(): HTMLElement | null {
        return (this.#element ??= document.getElementById(`pf2e-hud-shortcut-${this.slot}`));
    }

    abstract use(event: Event): void;

    altUse(event: Event): void {
        this.item?.sheet.render(true);
    }

    async tooltip(): Promise<HTMLElement> {
        if (this.#tooltip) {
            return this.#tooltip;
        }

        const reason = this.unusableReason;
        const data: ShortcutTooltipData = {
            altUse: this.canAltUse ? `${localize("rightClick")} ${this.altUseLabel}` : null,
            hasItem: !!this.item,
            img: this.usedImage,
            reason: reason ? localize("shortcuts.tooltip.reason", reason) : null,
            subtitle: this.subtitle,
            title: this.title,
        };

        return (this.#tooltip = createHTMLElement("div", {
            classes: ["content"],
            content: await render("shortcuts/tooltip", data),
        }));
    }

    async radialMenu<T extends string>(
        title: string,
        options: { value: T; label: string; selected: boolean }[],
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
            content: await render("shortcuts/radial", { title, options }),
        });

        element.appendChild(radial);

        const removeRadial = () => {
            radial.remove();
        };

        addListenerAll(radial, ".radial-option", (el, event) => {
            event.preventDefault();
            event.stopPropagation();

            removeRadial();
            onSelect(el.dataset.value as T);
        });

        radial.addEventListener("mouseleave", removeRadial);

        this.#radial = radial;
    }
}

interface PersistentShortcut<TSchema extends BaseShortcutSchema, TItem extends ItemPF2e>
    extends ModelPropsFromSchema<BaseShortcutSchema> {}

type ShortcutTooltipData = {
    altUse: string | null;
    hasItem: boolean;
    img: ImageFilePath;
    reason: string | null;
    subtitle: string;
    title: string;
};

type BaseShortcutSchema = {
    img: fields.FilePathField<ImageFilePath, ImageFilePath, true, false, false>;
    name: fields.StringField;
    type: fields.StringField<string, string, true, false, true>;
};

type ShortcutDataset = { itemId: string } | { sourceId: DocumentUUID };

export { generateBaseShortcutFields, PersistentShortcut };
export type { BaseShortcutSchema, ShortcutDataset };
