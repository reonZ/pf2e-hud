import {
    ConsumablePF2e,
    CreaturePF2e,
    EquipmentPF2e,
    IdField,
    usePhysicalItem,
} from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    getItemSlug,
    IPersistentShortcut,
    ShortcutDataset,
    ShortcutTooltipData,
} from ".";
import fields = foundry.data.fields;

function generateItemShortcutFields(type: string): ItemShortcutSchema {
    return {
        ...generateBaseShortcutFields(type),
        itemId: new IdField({
            required: true,
            nullable: false,
        }),
        slug: new fields.StringField({
            required: true,
            nullable: false,
        }),
    };
}

abstract class ItemShortcut<
        TSchema extends BaseShortcutSchema,
        TItem extends EquipmentPF2e<CreaturePF2e> | ConsumablePF2e<CreaturePF2e>
    >
    extends foundry.abstract.DataModel<null, TSchema>
    implements IPersistentShortcut
{
    #item: Maybe<TItem>;

    constructor(
        actor: CreaturePF2e,
        data?: DeepPartial<SourceFromSchema<TSchema>>,
        options?: DataModelConstructionOptions<null>
    ) {
        super(data, options);

        this.#item =
            (actor.items.get(this.itemId) as TItem) ??
            actor.itemTypes[this.type].find((item) => getItemSlug(item) === this.slug);
    }

    get canUse(): boolean {
        return !this.disabled;
    }

    get canAltUse(): boolean {
        return !this.disabled;
    }

    get dropped(): boolean {
        return this.item?.system.equipped.carryType === "dropped";
    }

    get dataset(): ShortcutDataset | undefined {
        if (!this.item) return;
        return { itemId: this.item.id };
    }

    get disabled(): boolean {
        return !this.item || this.dropped;
    }

    get greyed(): boolean {
        return false;
    }

    get item(): Maybe<TItem> {
        return this.#item;
    }

    get usedImage(): ImageFilePath {
        return this.img;
    }

    use(event: Event): void {
        const item = this.item;

        if (item?.isOfType("consumable", "equipment")) {
            usePhysicalItem(event, item);
        }
    }

    altUse(event: Event): void {
        this.item?.sheet.render(true);
    }

    tooltipData(): ShortcutTooltipData {
        return {
            altUse: game.i18n.localize("PF2E.EditItemTitle"),
            subtitle: game.i18n.localize(`TYPES.Item.${this.type}`),
            title: this.item?.name ?? this.name,
            reason: !this.item
                ? "match"
                : this.dropped
                ? "dropped"
                : (this.item?.quantity ?? 0) < 1
                ? "quantity"
                : undefined,
        };
    }
}

interface ItemShortcut<
    TSchema extends BaseShortcutSchema,
    TItem extends EquipmentPF2e<CreaturePF2e> | ConsumablePF2e<CreaturePF2e>
> extends ModelPropsFromSchema<ItemShortcutSchema> {
    type: "consumable" | "equipment";
}

type ItemShortcutSchema = BaseShortcutSchema & {
    itemId: IdField<true, false, false>;
    slug: fields.StringField<string, string, true, false, false>;
};

export { generateItemShortcutFields, ItemShortcut };
export type { ItemShortcutSchema };
