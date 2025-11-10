import { getActionCategory, getNpcStrikeImage, getStrikeActions, simulateReload } from "hud";
import {
    ActorPF2e,
    CharacterStrike,
    ConsumablePF2e,
    CreaturePF2e,
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
    #isEquipped!: boolean;
    #actorIsNPC!: boolean;
    #strikeItem: Maybe<StrikeItem>;
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
        this.#strikeItem = this.#getItem();

        const ammo = (this.#ammo = this.item && "ammo" in this.item ? this.item.ammo : null);

        this.#uses =
            (ammo?.isOfType("ammo") && ammo.uses.max > 1 && ammo.uses) ||
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

    get isEquipped(): boolean {
        return this.#isEquipped;
    }

    get canUse(): boolean {
        if (this.actorIsNPC) {
            return !!this.item;
        }

        return (
            !!this.item &&
            !!this.attackData?.canAttack &&
            this.attackData.ready &&
            (!("quantity" in this.item) || this.item.quantity > 0)
        );
    }

    get canOpenPopup(): boolean {
        return !!this.item && (!this.actorIsNPC || !this.isAreaOrAutoFire);
    }

    get item(): Maybe<MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>> {
        return this.#strikeItem;
    }

    get usedImage(): ImageFilePath {
        const item = this.item;

        if (!item) return this.img;
        if (!this.actorIsNPC) return this.item.img;

        return (
            getNpcStrikeImage({ item, slug: this.slug, type: this.attackData!.type }) ||
            this.item.img
        );
    }

    get cost(): ShortcutCost | null {
        if (!this.attackData) return null;

        return {
            value: this.isEquipped
                ? this.attackData.glyph
                : this.#drawAuxiliaries.at(0)?.actions ?? 1,
        };
    }

    get label(): ShortcutLabel | null {
        const attackData = this.attackData;
        if (!attackData || this.isAreaOrAutoFire) return null;

        const variant0Label = this.actor.isOfType("character")
            ? this.attackData.variants[0].label
            : this.attackData.canAttack
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
        return this.item?.isThrown
            ? "fa-solid fa-reply-all"
            : this.item?.isRanged
            ? "fa-solid fa-bow-arrow"
            : "fa-solid fa-sword";
    }

    get isAreaOrAutoFire(): boolean {
        return isAreaOrAutoFireType(this.attackData?.type);
    }

    get damageType(): string | null {
        if (this.#damageType !== undefined) {
            return this.#damageType;
        }

        const attackData = this.attackData as Maybe<CharacterStrike>;
        if (!attackData || this.actorIsNPC) {
            return (this.#damageType = null);
        }

        const versatile = attackData?.versatileOptions?.find((option) => option.selected);

        if (versatile) {
            return (this.#damageType = game.i18n.localize(versatile.label));
        }

        const auxiliary = attackData.auxiliaryActions.find((auxiliary) => auxiliary.options);

        if (auxiliary?.options) {
            const label = R.values(auxiliary.options).find((option) => option.selected)?.label;
            return (this.#damageType = label ?? null);
        }

        return (this.#damageType = null);
    }

    get subtitle(): string {
        const attackData = this.attackData;
        if (!attackData) return "";

        if (this.mustBeDrawn) {
            return this.#drawAuxiliaries.map((aux) => aux.label).join(" / ");
        }

        const label = this.isAreaOrAutoFire
            ? attackData.variants[0].label.replace(/[\(\)]/g, "")
            : this.ammo?.name ?? this.damageType ?? super.subtitle;
        const range = this.item ? getActionCategory(this.actor, this.item)?.tooltip : null;

        return range ? `${label} (${range})` : label;
    }

    get unusableReason(): string | undefined {
        if (this.actorIsNPC) {
            return !this.item ? "match" : undefined;
        }

        return !this.item
            ? "match"
            : !this.attackData?.canAttack
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

    use(event: MouseEvent) {
        const attackData = this.attackData;
        if (!attackData) return;

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

        if (this.isAreaOrAutoFire) {
            return attackData.variants[0].roll({ event });
        }

        this.radialMenu(
            () => {
                const isCharacter = this.actor.isOfType("character");
                const strikeLabel = getStrikeLabel();

                const [areaOrAutoFireAlts, otherAlts] = R.pipe(
                    attackData.altUsages ?? [],
                    R.map((data, i) => [i + 1, data] as const),
                    R.partition(([i, data]) => isAreaOrAutoFireType(data.type))
                );

                const sections = R.pipe(
                    [[0, attackData], ...otherAlts] as const,
                    R.map(([index, { item, variants }]): ShortcutRadialSection => {
                        const variant0Label = isCharacter
                            ? variants[0].label
                            : variants[0].label.split(" ")[1];

                        const options: ShortcutRadialOption[] = [
                            { value: `${index}-0`, label: `${strikeLabel} ${variant0Label}` },
                            { value: `${index}-1`, label: variants[1].label },
                            { value: `${index}-2`, label: variants[2].label },
                        ];

                        return {
                            title: item.isMelee
                                ? "PF2E.WeaponRangeMelee"
                                : item.isThrown
                                ? "PF2E.TraitThrown"
                                : "PF2E.NPCAttackRanged",
                            options,
                        };
                    })
                );

                if (areaOrAutoFireAlts.length) {
                    const entries = areaOrAutoFireAlts.map(
                        ([index, { glyph, variants }]): ShortcutRadialOption => {
                            const label = variants[0].label.split(" (")[0];
                            const icon = Handlebars.helpers.actionGlyph(glyph);

                            return {
                                value: `${index}-0`,
                                label: `${label} ${icon}`,
                            };
                        }
                    );

                    sections[0].options.push(...entries);
                }

                const ammunition = attackData.ammunition;
                if (ammunition?.requiresReload) {
                    const label = game.i18n.localize("PF2E.Actions.Reload.ShortTitle");
                    const icon = Handlebars.helpers.actionGlyph(ammunition.reloadGlyph);
                    const remaining = ammunition.capacity > 1 ? ` ${ammunition.remaining}` : "";

                    sections[0].options.push({
                        value: "reload",
                        label: `${label} ${icon}${remaining}`,
                    });
                }

                return sections;
            },
            (event, value) => {
                if (value === "reload") {
                    const actor = this.actor;
                    const index = actor.system.actions?.findIndex((x) => x === attackData);

                    return simulateReload(
                        { actor, ammunition: attackData.ammunition, item: this.item, index },
                        this.element
                    );
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

function isAreaOrAutoFireType(type: Maybe<string>): type is "area-fire" | "auto-fire" {
    return R.isIncludedIn(type, ["area-fire", "auto-fire"]);
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
