import { getActionCategory, getNpcStrikeImage, getStrikeActions } from "hud";
import {
    ActorPF2e,
    CharacterPF2e,
    CharacterStrike,
    ConsumablePF2e,
    createAreaFireMessage,
    CreaturePF2e,
    getExtraAuxiliaryAction,
    MeleePF2e,
    R,
    StrikeData,
    ValueAndMaybeMax,
    WeaponPF2e,
    ZeroToTwo,
} from "module-helpers";
import { AttackShortcut, AttackShortcutSchema, generateAttackShortcutFields } from ".";
import {
    ShortcutCost,
    ShortcutLabel,
    ShortcutRadialOption,
    ShortcutRadialSection,
    ShortcutSource,
} from "..";
import fields = foundry.data.fields;

class StrikeShortcut extends AttackShortcut<
    StrikeShortcutSchema,
    MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>,
    StrikeData | CharacterStrike
> {
    #ammo!: ConsumablePF2e<ActorPF2e> | WeaponPF2e<ActorPF2e> | null;
    #damageType?: string | null;
    #extraAuxiliaryAction?: { label: string; glyph: string } | null;
    #uses!: ValueAndMaybeMax | null;

    static defineSchema(): StrikeShortcutSchema {
        return {
            ...generateAttackShortcutFields("strike"),
            slug: new fields.StringField({
                required: true,
                nullable: false,
            }),
        };
    }
    async _initShortcut(): Promise<void> {
        await super._initShortcut();

        const ammo = (this.#ammo = this.item && "ammo" in this.item ? this.item.ammo : null);

        this.#uses =
            (ammo?.isOfType("consumable") && ammo.uses.max > 1 && ammo.uses) ||
            (ammo ? { value: ammo.quantity } : null);
    }

    async _getAttackData(): Promise<Maybe<StrikeData | CharacterStrike>> {
        return getStrikeActions(this.actor, { id: this.itemId, slug: this.slug })[0];
    }

    get extraAuxiliaryAction(): { label: string; glyph: string } | null {
        return (this.#extraAuxiliaryAction ??=
            game.modules.get("sf2e-anachronism")?.active && this.item?.isOfType("weapon")
                ? getExtraAuxiliaryAction(this.item) ?? null
                : null);
    }

    get isEquipped(): boolean {
        return !!this.item && (!("isEquipped" in this.item) || this.item.isEquipped);
    }

    get canUse(): boolean {
        return (
            super.canUse &&
            !!this.attackData?.canStrike &&
            this.isEquipped &&
            (!("quantity" in this.attackData.item) || this.attackData.item.quantity > 0)
        );
    }

    get item(): Maybe<MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>> {
        return this.attackData?.item as Maybe<MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>>;
    }

    get usedImage(): ImageFilePath {
        const item = this.item;

        if (!item) {
            return this.img;
        }

        return (
            (this.actor.isOfType("npc") && getNpcStrikeImage({ item, slug: this.slug })) ||
            this.item.img
        );
    }

    get cost(): ShortcutCost | null {
        return this.attackData ? { value: 1 } : null;
    }

    get label(): ShortcutLabel | null {
        if (!this.attackData) return null;

        const variant0Label = this.actor.isOfType("character")
            ? this.attackData.variants[0].label
            : this.attackData.variants[0].label.split(" ")[1];

        return this.attackData ? { value: variant0Label, class: "attack" } : null;
    }

    get ammo(): ConsumablePF2e<ActorPF2e> | WeaponPF2e<ActorPF2e> | null {
        return this.#ammo;
    }

    get uses(): ValueAndMaybeMax | null {
        return this.#uses;
    }

    get icon(): string {
        return this.item?.isRanged ? "fa-solid fa-bow-arrow" : "fa-solid fa-sword";
    }

    get damageType(): string | null {
        if (this.#damageType !== undefined) {
            return this.#damageType;
        }

        const attackData = this.attackData as Maybe<CharacterStrike>;
        if (!attackData || !this.actor.isOfType("character")) {
            return (this.#damageType = null);
        }

        const versatile = attackData?.versatileOptions.find((option) => option.selected);

        if (versatile) {
            return game.i18n.localize(versatile.label);
        }

        const auxiliary = attackData.auxiliaryActions.find((auxiliary) => auxiliary.options);

        if (auxiliary?.options) {
            const label = R.values(auxiliary.options).find((option) => option.selected)?.label;
            return (this.#damageType = label ?? null);
        }

        return (this.#damageType = null);
    }

    get subtitle(): string {
        const label = this.ammo?.name ?? this.damageType ?? super.subtitle;
        const range = this.item ? getActionCategory(this.actor, this.item)?.tooltip : null;

        return range ? `${label} (${range})` : label;
    }

    get unusableReason(): string | undefined {
        const parent = super.unusableReason;
        if (parent) return parent;

        return !this.attackData?.canStrike
            ? "available"
            : !this.isEquipped
            ? "equip"
            : this.item && "quantity" in this.item && this.item.quantity <= 0
            ? "quantity"
            : undefined;
    }

    use(event: MouseEvent): void {
        const attackData = this.attackData;
        if (!attackData) return;

        this.radialMenu(
            () => {
                const isCharacter = this.actor.isOfType("character");
                const strikeLabel = getStrikeLabel();

                return [
                    [0, attackData] as const,
                    ...(attackData.altUsages ?? []).map((data, i) => [i + 1, data] as const),
                ].map(([index, { item, variants }]): ShortcutRadialSection => {
                    const variant0Label = isCharacter
                        ? variants[0].label
                        : variants[0].label.split(" ")[1];

                    const options: ShortcutRadialOption[] = [
                        { value: `${index}-0`, label: `${strikeLabel} ${variant0Label}` },
                        { value: `${index}-1`, label: variants[1].label },
                        { value: `${index}-2`, label: variants[2].label },
                    ];

                    const extraAuxiliaryAction = this.extraAuxiliaryAction;
                    if (extraAuxiliaryAction) {
                        const glyph = Handlebars.helpers.actionGlyph(extraAuxiliaryAction.glyph);

                        options.push({
                            value: "extra-auxiliary",
                            label: `${extraAuxiliaryAction.label} ${glyph}`,
                        });
                    }

                    return {
                        title: item.isMelee
                            ? "PF2E.WeaponRangeMelee"
                            : item.isThrown
                            ? "PF2E.TraitThrown"
                            : "PF2E.NPCAttackRanged",
                        options,
                    };
                });
            },
            (event, value) => {
                if (value === "extra-auxiliary") {
                    return createAreaFireMessage(this.item as WeaponPF2e<CharacterPF2e>);
                }

                const [index, map] = value.split("-").map(Number) as [number, ZeroToTwo];
                const attack = index === 0 ? attackData : attackData.altUsages?.at(index - 1);

                attack?.variants[map]?.roll({ event });
            }
        );
    }

    altUse(event: MouseEvent): void {
        if (!this.item) return;

        game.pf2e.rollActionMacro({
            actorUUID: this.actor.uuid,
            type: "strike",
            itemId: this.item.id,
            slug: this.slug,
        });
    }
}

const _cached: { strikeLabel?: string } = {};

function getStrikeLabel() {
    return (_cached.strikeLabel ??= (() => {
        const label = game.i18n.localize("PF2E.WeaponStrikeLabel");
        const glyph = Handlebars.helpers.actionGlyph(1);

        return `${label} ${glyph} `;
    })());
}

interface StrikeShortcut extends ModelPropsFromSchema<StrikeShortcutSchema> {
    type: "strike";
}

type StrikeShortcutSchema = AttackShortcutSchema & {
    slug: fields.StringField<string, string, true, false, false>;
};

type StrikeShortcutData = ShortcutSource<StrikeShortcutSchema> & {
    type: "strike";
};

export { StrikeShortcut };
export type { StrikeShortcutData };
