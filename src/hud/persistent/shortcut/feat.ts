import { CharacterPF2e, CreaturePF2e, FeatPF2e, IdField } from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    PersistentShortcut,
    ShortcutSource,
} from ".";

class FeatShortcut extends PersistentShortcut<FeatShortcutSchema> {
    static defineSchema(): FeatShortcutSchema {
        return {
            ...generateBaseShortcutFields("feat"),
            itemId: new IdField({
                required: true,
                nullable: false,
            }),
        };
    }

    static async getItem(
        actor: CreaturePF2e,
        data: FeatShortcutData
    ): Promise<Maybe<FeatPF2e<CharacterPF2e>>> {
        return actor.items.get<FeatPF2e<CharacterPF2e>>(data.itemId);
    }

    get icon(): string {
        return "fa-solid fa-medal";
    }

    get subtitle(): string {
        return game.i18n.localize("TYPES.Item.feat");
    }

    use(event: MouseEvent): void {
        this.item?.toMessage();
    }
}

interface FeatShortcut extends ModelPropsFromSchema<FeatShortcutSchema> {}

type FeatShortcutSchema = BaseShortcutSchema & {
    itemId: IdField<true>;
};

type FeatShortcutData = ShortcutSource<FeatShortcutSchema> & {
    type: "feat";
};

export { FeatShortcut };
export type { FeatShortcutData };
