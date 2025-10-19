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
    WeaponAuxiliaryAction,
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

const DRAW_AUXILIARY_ANNOTATION = ["draw", "pick-up", "retrieve"];

class StrikeShortcut extends AttackShortcut<
    StrikeShortcutSchema,
    MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>,
    StrikeData | CharacterStrike
> {
    #ammo!: ConsumablePF2e<ActorPF2e> | WeaponPF2e<ActorPF2e> | null;
    #damageType?: string | null;
    #drawAuxiliaries!: WeaponAuxiliaryAction[];
    #extraAuxiliaryAction?: { label: string; glyph: string } | null;
    #isEquipped!: boolean;
    #actorIsNPC!: boolean;
    #item: Maybe<StrikeItem>;
    #uses!: ValueAndMaybeMax | null;

    static defineSchema(): StrikeShortcutSchema {
        return {
            ...generateAttackShortcutFields("strike"),
            attachment: new fields.BooleanField({
                required: false,
                nullable: false,
                initial: false,
            }),
            slug: new fields.StringField({
                required: true,
                nullable: false,
            }),
        };
    }

    async _initShortcut(): Promise<void> {
        await super._initShortcut();

        this.#actorIsNPC = this.actor.isOfType("npc");
        this.#item = this.#getItem();

        const ammo = (this.#ammo = this.item && "ammo" in this.item ? this.item.ammo : null);

        this.#uses =
            (ammo?.isOfType("consumable") && ammo.uses.max > 1 && ammo.uses) ||
            (ammo ? { value: ammo.quantity } : null);

        this.#isEquipped = !!this.item && (!("isEquipped" in this.item) || this.item.isEquipped);

        this.#drawAuxiliaries =
            this.attackData && "auxiliaryActions" in this.attackData && !this.#isEquipped
                ? this.attackData.auxiliaryActions.filter(({ annotation }) => {
                      return annotation && DRAW_AUXILIARY_ANNOTATION.includes(annotation);
                  })
                : [];
    }

    async _getAttackData(): Promise<Maybe<StrikeData | CharacterStrike>> {
        return getStrikeActions(this.actor, { id: this.itemId, slug: this.slug })[0];
    }

    get actorIsNPC(): boolean {
        return this.#actorIsNPC;
    }

    get extraAuxiliaryAction(): { label: string; glyph: string } | null {
        return (this.#extraAuxiliaryAction ??=
            game.modules.get("sf2e-anachronism")?.active && this.item?.isOfType("weapon")
                ? getExtraAuxiliaryAction(this.item) ?? null
                : null);
    }

    get isEquipped(): boolean {
        return this.#isEquipped;
    }

    get canUse(): boolean {
        if (this.actorIsNPC) {
            return !!this.item;
        }

        return (
            !!this.item &&
            !!this.attackData?.canStrike &&
            this.attackData.ready &&
            (!("quantity" in this.item) || this.item.quantity > 0)
        );
    }

    get canOpenPopup(): boolean {
        return !!this.item && !this.isNpcSubAttack;
    }

    get item(): Maybe<MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>> {
        return this.#item;
    }

    get usedImage(): ImageFilePath {
        const item = this.item;

        if (!item) {
            return this.img;
        }

        return (this.actorIsNPC && getNpcStrikeImage({ item, slug: this.slug })) || this.item.img;
    }

    get cost(): ShortcutCost | null {
        if (!this.attackData) return null;

        return {
            value: this.isEquipped
                ? this.isNpcSubAttack
                    ? this.attackData.glyph
                    : 1
                : this.#drawAuxiliaries.at(0)?.actions ?? 1,
        };
    }

    get label(): ShortcutLabel | null {
        if (!this.attackData) return null;

        const variant0Label = this.actor.isOfType("character")
            ? this.attackData.variants[0].label
            : this.attackData.canStrike
            ? this.attackData.variants[0].label.split(" ")[1]
            : null;

        return variant0Label ? { value: variant0Label, class: "attack" } : null;
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
        if (!attackData || this.actorIsNPC) {
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
        if (this.mustBeDrawn) {
            return this.#drawAuxiliaries.map((aux) => aux.label).join(" / ");
        }

        if (this.isNpcSubAttack) {
            return this.attackData!.variants[0].label;
        }

        const label = this.ammo?.name ?? this.damageType ?? super.subtitle;
        const range = this.item ? getActionCategory(this.actor, this.item)?.tooltip : null;

        return range ? `${label} (${range})` : label;
    }

    get unusableReason(): string | undefined {
        if (this.actorIsNPC) {
            return !this.item ? "match" : undefined;
        }

        return !this.item
            ? "match"
            : !this.attackData?.canStrike
            ? "available"
            : !this.attackData?.ready
            ? "hands"
            : this.item && "quantity" in this.item && this.item.quantity <= 0
            ? "quantity"
            : undefined;
    }

    get mustBeDrawn(): boolean {
        return this.#drawAuxiliaries.length > 0 && !this.isEquipped;
    }

    get isNpcSubAttack(): boolean {
        return this.actorIsNPC && !!this.attackData && !this.attackData.canStrike;
    }

    use(event: MouseEvent) {
        const attackData = this.attackData;
        if (!attackData) return;

        if (this.isNpcSubAttack) {
            attackData.variants[0].roll({ event });
            return;
        }

        if (this.mustBeDrawn) {
            if (this.#drawAuxiliaries.length === 1) {
                this.#drawAuxiliaries[0].execute();
                return;
            }

            this.radialMenu(
                () => {
                    return [
                        {
                            title: "PF2E.ActionTypeAction",
                            options: this.#drawAuxiliaries.map((aux, index) => {
                                return { value: String(index), label: aux.label };
                            }),
                        },
                    ];
                },
                (event, value) => {
                    const index = Number(value);
                    this.#drawAuxiliaries.at(index)?.execute();
                }
            );

            return;
        }

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

        super.altUse(event);

        game.pf2e.rollActionMacro({
            actorUUID: this.actor.uuid,
            type: "strike",
            itemId: this.item.id,
            slug: this.slug,
        });
    }

    #getItem(): Maybe<StrikeItem> {
        const dataItem = this.attackData?.item;
        if (dataItem || !this.attachment) return dataItem as Maybe<StrikeItem>;

        return this.actor.itemTypes.weapon
            .find((item) => item.subitems.has(this.itemId))
            ?.subitems.get(this.itemId) as Maybe<StrikeItem>;
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
    attachment: fields.BooleanField<boolean, boolean, false, false, true>;
    slug: fields.StringField<string, string, true, false, false>;
};

type StrikeShortcutData = WithPartial<ShortcutSource<StrikeShortcutSchema>, "attachment"> & {
    type: "strike";
};

type StrikeItem = MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>;

export { StrikeShortcut };
export type { StrikeShortcutData };
