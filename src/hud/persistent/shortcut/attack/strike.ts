import { CreaturePF2e, MeleePF2e, WeaponPF2e } from "module-helpers";
import { AttackShortcut, AttackShortcutSchema, generateAttackShortcutFields } from ".";
import { ShortcutSource } from "../base";
import { getItemSlug } from "../_utils";

class StrikeShortcut extends AttackShortcut<
    StrikeShortcutSchema,
    MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>
> {
    static defineSchema(): StrikeShortcutSchema {
        return {
            ...generateAttackShortcutFields("strike"),
        };
    }

    get icon(): string {
        return "fa-solid fa-sword";
    }

    use(event: MouseEvent): void {
        throw new Error("Method not implemented.");
    }

    altUse(event: MouseEvent): void {
        if (!this.item) return;

        game.pf2e.rollActionMacro({
            actorUUID: this.actor.uuid,
            type: "strike",
            itemId: this.item.id,
            slug: getItemSlug(this.item), // TODO wrong slug, it should be strike.slug
        });
    }
}

interface StrikeShortcut extends ModelPropsFromSchema<StrikeShortcutSchema> {}

type StrikeShortcutSchema = AttackShortcutSchema & {};

type StrikeShortcutData = ShortcutSource<StrikeShortcutSchema> & {
    type: "strike";
};

export { StrikeShortcut };
export type { StrikeShortcutData };
