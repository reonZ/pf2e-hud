import { ElementalBlastsData, getElementalBlastsData } from "hud";
import { AbilityItemPF2e, CharacterPF2e, EffectTrait, R, ZeroToTwo } from "module-helpers";
import { AttackShortcut, AttackShortcutSchema, generateAttackShortcutFields } from ".";
import { ShortcutCost, ShortcutLabel, ShortcutRadialSection, ShortcutSource } from "..";
import fields = foundry.data.fields;

class BlastShortcut extends AttackShortcut<
    BlastShortcutSchema,
    AbilityItemPF2e<CharacterPF2e>,
    ElementalBlastsData
> {
    static defineSchema(): BlastShortcutSchema {
        return {
            ...generateAttackShortcutFields("blast"),
            elementTrait: new fields.StringField({
                required: true,
                nullable: false,
                choices: () => CONFIG.PF2E.effectTraits,
            }),
        };
    }

    async _getAttackData(): Promise<Maybe<ElementalBlastsData>> {
        return this.cached("elementalBlastData", () => {
            return getElementalBlastsData(this.actor, this.elementTrait);
        });
    }

    get usedImage(): ImageFilePath {
        return this.attackData?.img ?? this.img;
    }

    get icon(): string {
        return "fa-solid fa-meteor fa-rotate-180";
    }

    get cost(): ShortcutCost | null {
        return this.attackData ? { value: this.attackData.actionCost } : null;
    }

    get label(): ShortcutLabel | null {
        return this.attackData ? { value: this.attackData.maps.melee.map0, class: "attack" } : null;
    }

    get subtitle(): string {
        const attackData = this.attackData;
        if (!attackData) {
            return super.subtitle;
        }

        const label = game.i18n.localize(CONFIG.PF2E.damageTypes[attackData.damageType]);
        const range = attackData.range.label;
        return `${label} (${range})`;
    }

    use(event: MouseEvent): void {
        const attackData = this.attackData;
        if (!attackData) return;

        this.radialMenu(
            () => {
                const shortLabel = getBlastShortLabel();
                const glyph = getGlyph(attackData.actionCost);

                return R.entries(attackData.maps).map(
                    ([type, { map0, map1, map2 }]): ShortcutRadialSection => {
                        return {
                            title:
                                type === "melee" ? "PF2E.WeaponRangeMelee" : "PF2E.NPCAttackRanged",
                            options: [
                                { value: `${type}-0`, label: `${shortLabel} ${glyph} ${map0}` },
                                { value: `${type}-1`, label: map1 },
                                { value: `${type}-2`, label: map2 },
                            ],
                        };
                    }
                );
            },
            (event, value) => {
                const [type, map] = value.split("-") as ["melee" | "ranged", `${ZeroToTwo}`];

                attackData.action.attack({
                    damageType: attackData.damageType,
                    element: attackData.element,
                    event,
                    mapIncreases: Number(map),
                    melee: type === "melee",
                });
            }
        );
    }

    altUse(): void {
        game.pf2e.rollActionMacro({
            actorUUID: this.actor.uuid,
            type: this.type,
            elementTrait: this.elementTrait,
        });
    }
}

const _cached: { shortLabel?: string; glyph: PartialRecord<1 | 2, string> } = {
    glyph: {},
};

function getBlastShortLabel() {
    return (_cached.shortLabel ??= game.i18n.localize(
        "PF2E.SpecificRule.Kineticist.Impulse.ElementalBlast.ShortLabel"
    ));
}

function getGlyph(cost: 1 | 2): string {
    return (_cached.glyph[cost] ??= Handlebars.helpers.actionGlyph(cost));
}

interface BlastShortcut extends ModelPropsFromSchema<BlastShortcutSchema> {
    get actor(): CharacterPF2e;
    type: "blast";
}

type BlastShortcutSchema = AttackShortcutSchema & {
    elementTrait: fields.StringField<EffectTrait, EffectTrait, true, false, false>;
};

type BlastShortcutData = ShortcutSource<BlastShortcutSchema> & {
    type: "blast";
};

export { BlastShortcut };
export type { BlastShortcutData };
