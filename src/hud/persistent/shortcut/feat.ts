import { CharacterPF2e, CreaturePF2e, FeatPF2e, z, zDocumentId } from "foundry-helpers";
import { PersistentShortcut, ShortcutData, zBaseShortcut } from ".";

const zFeatShortcut = zBaseShortcut("feat").extend({
    itemId: zDocumentId(true),
});

class FeatShortcut extends PersistentShortcut<typeof zFeatShortcut> {
    static get schema() {
        return zFeatShortcut;
    }

    static async getItem(actor: CreaturePF2e, data: FeatShortcutData): Promise<Maybe<FeatPF2e<CharacterPF2e>>> {
        return actor.items.get<FeatPF2e<CharacterPF2e>>(data.itemId);
    }

    get icon(): string {
        return "fa-solid fa-medal";
    }

    get subtitle(): string {
        return game.i18n.localize("TYPES.Item.feat");
    }

    use(): void {
        this.item?.toMessage();
    }
}

interface FeatShortcut extends ShortcutData<typeof zFeatShortcut> {
    type: "feat";
}

type FeatShortcutSource = z.input<typeof zFeatShortcut>;
type FeatShortcutData = z.output<typeof zFeatShortcut>;

export { FeatShortcut };
export type { FeatShortcutData, FeatShortcutSource };
