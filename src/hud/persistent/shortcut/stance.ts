import { canUseStances, toggleStance } from "hud";

import {
    AbilityItemPF2e,
    CompendiumIndexData,
    CreaturePF2e,
    EffectPF2e,
    FeatPF2e,
    findItemWithSourceId,
    ImageFilePath,
    ItemUUID,
    localize,
    z,
    zDocumentId,
    zDocumentUUID,
} from "foundry-helpers";
import { PersistentShortcut, ShortcutData, zBaseShortcut } from ".";

const zStanceShortcut = zBaseShortcut("stance").extend({
    effectUUID: zDocumentUUID<ItemUUID>("Item"),
    itemId: zDocumentId(true),
});

class StanceShortcut extends PersistentShortcut<
    typeof zStanceShortcut,
    FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>
> {
    #active: boolean = false;
    #sourceEffect: Maybe<EffectPF2e | CompendiumIndexData>;
    #canUseStances: boolean = false;

    static get schema() {
        return zStanceShortcut;
    }

    static async getItem(
        actor: CreaturePF2e,
        data: StanceShortcutData,
    ): Promise<Maybe<FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>>> {
        return actor.items.get<FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>>(data.itemId);
    }

    async _initShortcut(): Promise<void> {
        if (!this.item) return;

        this.#active = this.cached("hasItemWithSourceId", this.effectUUID, () => {
            return !!findItemWithSourceId(this.actor, this.effectUUID, "effect");
        });
        this.#canUseStances = this.cached("canUseStances", () => {
            return canUseStances(this.actor);
        });
        this.#sourceEffect = fromUuidSync<EffectPF2e>(this.effectUUID);
    }

    get canUseStances(): boolean {
        return this.#canUseStances;
    }

    get greyedOut(): boolean {
        return super.greyedOut || !this.canUseStances;
    }

    get active(): boolean {
        return this.#active;
    }

    get sourceEffect(): Maybe<EffectPF2e | CompendiumIndexData> {
        return this.#sourceEffect;
    }

    get usedImage(): ImageFilePath {
        return this.sourceEffect?.img ?? this.img;
    }

    get checkbox(): { checked: boolean } | null {
        return this.item ? { checked: this.active } : null;
    }

    get icon(): string {
        return "fa-solid fa-person";
    }

    get subtitle(): string {
        const label = game.i18n.localize("PF2E.TraitStance");
        if (!this.item) {
            return label;
        }

        const active = localize("shortcuts.tooltip", this.active ? "active" : "inactive");
        return `${label} (${active})`;
    }

    get unusableReason(): string | undefined {
        return super.unusableReason ?? (!this.canUseStances ? "combat" : undefined);
    }

    use(event: MouseEvent): void {
        toggleStance(this.actor, this.effectUUID, event.ctrlKey);
    }
}

interface StanceShortcut extends ShortcutData<typeof zStanceShortcut> {
    type: "stance";
}

type StanceShortcutSource = z.input<typeof zStanceShortcut>;
type StanceShortcutData = z.output<typeof zStanceShortcut>;

export { StanceShortcut };
export type { StanceShortcutData, StanceShortcutSource };
