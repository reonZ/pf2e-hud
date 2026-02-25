import {
    AbilityItemPF2e,
    applySelfEffect,
    CharacterPF2e,
    findItemWithSourceId,
    ImageFilePath,
    R,
    z,
    ZeroToTwo,
} from "foundry-helpers";
import { ElementalBlastsData, getElementalBlastsData } from "hud";
import { AttackShortcut, zAttackShortcut } from ".";
import { ShortcutCost, ShortcutData, ShortcutLabel, ShortcutRadialSection } from "..";

const CHANNEL_ELEMENTS_UUID = "Compendium.pf2e.actionspf2e.Item.g8QrV39TmZfkbXgE";

function zBlastShortcut() {
    return zAttackShortcut("blast").extend({
        elementTrait: z.enum(R.keys(CONFIG.PF2E.effectTraits)),
    });
}

class BlastShortcut extends AttackShortcut<BlastShortcutSchema, AbilityItemPF2e<CharacterPF2e>, ElementalBlastsData> {
    static #schema?: BlastShortcutSchema;

    static get schema() {
        return (this.#schema ??= zBlastShortcut());
    }

    async _getAttackData(): Promise<Maybe<ElementalBlastsData>> {
        return getElementalBlastsData(this.actor, this.elementTrait);
    }

    get usedImage(): ImageFilePath {
        return this.attackData?.img ?? this.img;
    }

    get canUse(): boolean {
        return !!this.item && !!this.attackData;
    }

    get canAltUse(): boolean {
        return super.canAltUse && !!this.attackData?.ready;
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

        if (attackData.ready) {
            const label = game.i18n.localize(CONFIG.PF2E.damageTypes[attackData.damageType]);
            const range = attackData.range.label;

            return `${label} (${range})`;
        } else {
            return game.i18n.localize("PF2E.SpecificRule.Kineticist.Impulse.ElementalBlast.Channel");
        }
    }

    async use(event: MouseEvent) {
        const attackData = this.attackData;
        if (!attackData) return;

        if (!attackData.ready) {
            const action = findItemWithSourceId(this.actor, CHANNEL_ELEMENTS_UUID, "action");

            if (action) {
                await applySelfEffect(action);
                action.toMessage(event);
            }

            return;
        }

        this.radialMenu(
            () => {
                const shortLabel = getBlastShortLabel();
                const glyph = getGlyph(attackData.actionCost);

                return R.entries(attackData.maps).map(([type, { map0, map1, map2 }]): ShortcutRadialSection => {
                    return {
                        title: type === "melee" ? "PF2E.WeaponRangeMelee" : "PF2E.NPCAttackRanged",
                        options: [
                            { value: `${type}-0`, label: `${shortLabel} ${glyph} ${map0}` },
                            { value: `${type}-1`, label: map1 },
                            { value: `${type}-2`, label: map2 },
                        ],
                    };
                });
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
            },
        );
    }

    altUse(event: MouseEvent): void {
        super.altUse(event);

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
        "PF2E.SpecificRule.Kineticist.Impulse.ElementalBlast.ShortLabel",
    ));
}

function getGlyph(cost: 1 | 2): string {
    return (_cached.glyph[cost] ??= Handlebars.helpers.actionGlyph(cost));
}

interface BlastShortcut extends ShortcutData<BlastShortcutSchema> {
    get actor(): CharacterPF2e;
    type: "blast";
}

type BlastShortcutSchema = ReturnType<typeof zBlastShortcut>;
type BlastShortcutSource = z.input<BlastShortcutSchema>;
type BlastShortcutData = z.output<BlastShortcutSchema>;

export { BlastShortcut };
export type { BlastShortcutData, BlastShortcutSource };
