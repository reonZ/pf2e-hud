import {
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
    #item: Maybe<TItem>;
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
        options?: DataModelConstructionOptions<null>
    ) {
        super(data, options);

        this.#actor = actor;
        this.#item = (this.constructor as typeof PersistentShortcut).getItem(
            actor,
            data as SourceFromSchema<TSchema>
        ) as Maybe<TItem>;
    }

    get actor(): CreaturePF2e {
        return this.#actor;
    }

    get item(): Maybe<TItem> {
        return this.#item;
    }

    get dataset(): ShortcutDataset | null {
        return null;
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
        return !this.item ? "" : undefined;
    }

    get subtitle(): string {
        return game.i18n.localize(`TYPES.Item.${this.item?.type ?? this.type}`);
    }

    get title(): string {
        return this.item?.name ?? this.name;
    }

    get altUseLabel(): string {
        return game.i18n.localize("PF2E.EditItemTitle");
    }

    abstract use(event: Event): void;
    abstract altUse(event: Event): void;

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
