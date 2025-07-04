import { createHTMLElement, CreaturePF2e, ItemPF2e, localize, render } from "module-helpers";
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
        sourceId: new fields.DocumentUUIDField({
            required: true,
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

abstract class BasePersistentShortcut<
    TSchema extends BaseShortcutSchema,
    TItem extends ItemPF2e
> extends foundry.abstract.DataModel<null, TSchema> {
    #actor: CreaturePF2e;
    #item: TItem | null | undefined;
    #tooltip: HTMLElement | undefined;

    constructor(
        actor: CreaturePF2e,
        data?: DeepPartial<SourceFromSchema<TSchema>>,
        options?: DataModelConstructionOptions<null>
    ) {
        super(data, options);
        this.#actor = actor;
    }

    abstract get disabled(): boolean;

    get actor(): CreaturePF2e {
        return this.#actor;
    }

    get item(): TItem | null {
        if (this.#item !== undefined) {
            return this.#item;
        }

        return (this.#item = this._item());
    }

    get title(): string {
        return this.item?.name ?? this.name;
    }

    get usedImage(): ImageFilePath {
        return this.item?.img ?? this.img;
    }

    get counter(): { value: number } | undefined {
        return undefined;
    }

    abstract use(event: Event): void;
    abstract altUse(event: Event): void;
    abstract _item(): TItem | null;

    async tooltip(): Promise<HTMLElement> {
        if (this.#tooltip) {
            return this.#tooltip;
        }

        const data = foundry.utils.mergeObject(
            this._tooltipData(),
            {
                altUse: localize("shortcuts.tooltip", this.type),
                disabled: this.disabled,
                img: this.usedImage,
                subtitle: game.i18n.localize(`TYPES.Item.${this.item?.type ?? this.type}`),
                title: this.title,
            } satisfies Required<ShortcutTooltipData>,
            { insertKeys: true, inplace: false, overwrite: false }
        );

        data.altUse = `${localize("rightClick")} ${data.altUse}`;

        return (this.#tooltip ??= createHTMLElement("div", {
            classes: ["content"],
            content: await render("shortcuts/tooltip", data),
        }));
    }

    _tooltipData(): ShortcutTooltipData {
        return {};
    }
}

interface BasePersistentShortcut<TSchema extends BaseShortcutSchema, TItem extends ItemPF2e>
    extends ModelPropsFromSchema<BaseShortcutSchema> {}

type ShortcutTooltipData = {
    altUse?: string;
    disabled?: boolean;
    img?: ImageFilePath;
    subtitle?: string;
    title?: string;
};

type BaseShortcutSchema = {
    img: fields.FilePathField<ImageFilePath, ImageFilePath, true, false, false>;
    name: fields.StringField;
    sourceId: fields.DocumentUUIDField<DocumentUUID, true, false, false>;
    type: fields.StringField<string, string, true, false, true>;
};

type BaseShortcutData<T extends string = string> = SourceFromSchema<BaseShortcutSchema>;

export { BasePersistentShortcut, generateBaseShortcutFields };
export type { BaseShortcutData, BaseShortcutSchema, ShortcutTooltipData };
