import { ItemPF2e, ValueAndMaybeMax } from "module-helpers";
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

interface IPersistentShortcut {
    get canUse(): boolean;
    get canAltUse(): boolean;
    get dataset(): ShortcutDataset | undefined;
    get disabled(): boolean;
    get greyed(): boolean;
    get item(): Maybe<ItemPF2e>;
    get usedImage(): ImageFilePath;
    readonly counter?: ValueAndMaybeMax | null;

    _tooltip?: HTMLElement;

    use(event: Event): void;
    altUse(event: Event): void;
    tooltipData(): ShortcutTooltipData;
}

type ShortcutTooltipData = {
    altUse: string;
    reason?: string;
    subtitle: string;
    title: string;
};

type BaseShortcutSchema = {
    img: fields.FilePathField<ImageFilePath, ImageFilePath, true, false, false>;
    name: fields.StringField;
    type: fields.StringField<string, string, true, false, true>;
};

type ShortcutDataset = { itemId: string } | { sourceId: DocumentUUID };

export { generateBaseShortcutFields };
export type { BaseShortcutSchema, IPersistentShortcut, ShortcutDataset, ShortcutTooltipData };
