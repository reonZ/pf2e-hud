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
    #counter?: ValueAndMaybeMax | null;
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

    get greyed(): boolean {
        return false;
    }

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

    get counter(): ValueAndMaybeMax | null {
        if (this.#counter !== undefined) {
            return this.#counter;
        }

        return (this.#counter = this._counter());
    }

    get canUse(): boolean {
        return !this.disabled;
    }

    get canAltUse(): boolean {
        return !this.disabled;
    }

    abstract use(event: Event): void;
    abstract altUse(event: Event): void;
    abstract _item(): TItem | null;

    async tooltip(): Promise<HTMLElement> {
        if (this.#tooltip) {
            return this.#tooltip;
        }

        const data = this._tooltipData();
        data.altUse = `${localize("rightClick")} ${data.altUse}`;
        data.reason = data.reason ? localize("shortcuts.tooltip.reason", data.reason) : undefined;

        return (this.#tooltip ??= createHTMLElement("div", {
            classes: ["content"],
            content: await render("shortcuts/tooltip", data),
        }));
    }

    _counter(): ValueAndMaybeMax | null {
        return null;
    }

    _tooltipData(): ShortcutTooltipData {
        return {
            altUse: localize("shortcuts.tooltip", this.type),
            disabled: this.disabled,
            img: this.usedImage,
            reason: !this.item ? "match" : undefined,
            subtitle: game.i18n.localize(`TYPES.Item.${this.item?.type ?? this.type}`),
            title: this.title,
        };
    }
}

interface BasePersistentShortcut<TSchema extends BaseShortcutSchema, TItem extends ItemPF2e>
    extends ModelPropsFromSchema<BaseShortcutSchema> {}

type ShortcutTooltipData = {
    altUse?: string;
    disabled?: boolean;
    img?: ImageFilePath;
    reason?: string;
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
