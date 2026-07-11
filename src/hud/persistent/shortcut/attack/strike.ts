import {
    ActorPF2e,
    AmmoPF2e,
    AttackAction,
    CharacterAttack,
    CharacterStrike,
    CreaturePF2e,
    ImageFilePath,
    MeleePF2e,
    R,
    ValueAndMaybeMax,
    WeaponAuxiliaryAction,
    WeaponPF2e,
    z,
    ZeroToTwo,
} from "foundry-helpers";
import { getActionCategory, getNpcStrikeImage, getStrikeActions, simulateReload } from "hud";
import { AttackShortcut, zAttackShortcut } from ".";
import { ShortcutCost, ShortcutData, ShortcutLabel, ShortcutRadialOption, ShortcutRadialSection } from "..";

const DRAW_AUXILIARY_ANNOTATION = ["draw", "grip", "pick-up", "retrieve"] as const;

const zStrikeShortcut = zAttackShortcut("strike").extend({
    attachment: z.boolean().default(false),
    slug: z.string().nonempty(),
});

class StrikeShortcut extends AttackShortcut<
    typeof zStrikeShortcut,
    MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>,
    AttackAction | CharacterStrike
> {
    #actorIsNPC!: boolean;
    #ammo!: AmmoPF2e<ActorPF2e> | WeaponPF2e<ActorPF2e> | null;
    #damageType?: string | null;
    #drawAuxiliaries!: WeaponAuxiliaryAction[];
    #isEquipped!: boolean;
    #strikeItem: Maybe<StrikeItem>;
    #uses!: ValueAndMaybeMax | null;

    static get schema() {
        return zStrikeShortcut;
    }

    async _initShortcut(): Promise<void> {
        await super._initShortcut();

        this.#actorIsNPC = this.actor.isOfType("npc");
        this.#strikeItem = this.#getItem();

        const item = this.item;
        const ammo = (this.#ammo = item && "ammo" in item ? item.ammo : null);

        this.#uses =
            (ammo?.isOfType("ammo") && ammo.uses.max > 1 && ammo.uses) ||
            (ammo && { value: ammo.quantity }) ||
            (isBombOrGrenade(item) && item.quantity > 1 ? { value: item.quantity } : null);

        this.#isEquipped = !!item && (!("isEquipped" in item) || item.isEquipped);

        this.#drawAuxiliaries =
            this.attackData && "auxiliaryActions" in this.attackData && !this.#isEquipped
                ? this.attackData.auxiliaryActions.filter(({ annotation }) => {
                      return annotation && R.isIncludedIn(annotation, DRAW_AUXILIARY_ANNOTATION);
                  })
                : [];
    }

    async _getAttackData(): Promise<Maybe<AttackAction | CharacterStrike>> {
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
            (this.attackData as CharacterStrike).handsAvailable &&
            (!("quantity" in this.item) || this.item.quantity > 0)
        );
    }

    get canOpenPopup(): boolean {
        return !!this.item && (!this.actorIsNPC || !this.isPureAreaType);
    }

    get item(): Maybe<MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>> {
        return this.#strikeItem;
    }

    get usedImage(): ImageFilePath {
        const item = this.item;

        if (!item) return this.img;
        if (!this.actorIsNPC) return this.item.img;

        return getNpcStrikeImage({ item, slug: this.slug, type: this.attackData!.type }) || this.item.img;
    }

    get cost(): ShortcutCost | null {
        if (!this.attackData) {
            return null;
        }

        if (this.isEquipped) {
            const glyph = this.attackData.glyph.toLowerCase();
            return { value: glyph === "a" ? 1 : this.attackData.glyph };
        }

        return { value: this.#drawAuxiliaries.at(0)?.actions ?? 1 };
    }

    get label(): ShortcutLabel | null {
        const attackData = this.attackData;
        if (!attackData) return null;

        const dcLabel = this.isMainAreaType && /(\d+)\)$/.exec(attackData.variants[0].label)?.[1];

        if (dcLabel) {
            return {
                class: "attack",
                value: dcLabel,
            };
        }

        const variant0Label = this.actor.isOfType("character")
            ? attackData.variants[0].label
            : attackData.canAttack
              ? attackData.variants[0].label.split(" ")[1]
              : null;

        return variant0Label ? { value: variant0Label, class: "attack" } : null;
    }

    get ammo(): AmmoPF2e<ActorPF2e> | WeaponPF2e<ActorPF2e> | null {
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

        const label = this.isMainAreaType
            ? attackData.variants[0].label.replace(/[\(\)]/g, "")
            : (this.ammo?.name ?? this.damageType ?? super.subtitle);
        const range = this.item ? getActionCategory(this.actor, this.item, this.type)?.tooltip : null;

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
              : !(this.attackData as Maybe<CharacterStrike>)?.handsAvailable
                ? "hands"
                : this.item && "quantity" in this.item && this.item.quantity <= 0
                  ? "quantity"
                  : undefined;
    }

    get isReady(): boolean {
        return !!this.attackData?.ready;
    }

    get mustBeDrawn(): boolean {
        return !this.isReady && this.#drawAuxiliaries.length > 0 && !this.isEquipped;
    }

    get isMainAreaType(): boolean {
        return isAreaOrAutoFireType(this.attackData);
    }

    get isPureAreaType(): boolean {
        return isAreaOrAutoFireType(this.attackData) && !this.attackData.altUsages?.length;
    }

    use(event: PointerEvent) {
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
                (_event, value) => {
                    const index = Number(value);
                    this.#drawAuxiliaries.at(index)?.execute();
                },
            );

            return;
        }

        if (this.isPureAreaType) {
            return attackData.variants[0].roll({ event });
        }

        this.radialMenu(
            () => {
                const isCharacter = this.actor.isOfType("character");
                const strikeLabel = getStrikeLabel();

                const [areaActions, actions] = R.pipe(
                    [attackData, ...(attackData.altUsages ?? [])],
                    R.map((data, i) => [i, data] as const),
                    R.partition(([_i, data]) => isAreaOrAutoFireType(data)),
                );

                const sections = R.pipe(
                    actions,
                    R.map(([index, { item, variants }]): ShortcutRadialSection => {
                        const variant0Label = isCharacter ? variants[0].label : variants[0].label.split(" ")[1];

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
                    }),
                );

                for (const [index, { glyph, type, variants }] of areaActions) {
                    const label = variants[0].label.split(" (")[0];
                    const icon = Handlebars.helpers.actionGlyph(glyph);
                    const mode = type === "area-fire" ? "unshift" : "push";

                    sections[0].options[mode]({
                        value: `${index}-0`,
                        label: `${label} ${icon}`,
                    });
                }

                const ammunition = attackData.ammunition;
                if (ammunition?.requiresReload && ammunition.remaining > 0) {
                    const label = game.i18n.localize("PF2E.Actions.Interact.Reload.Title");
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
                        this.element,
                    );
                }

                const [index, map] = value.split("-").map(Number) as [number, ZeroToTwo];
                const attack = index === 0 ? attackData : attackData.altUsages?.at(index - 1);

                attack?.variants[map]?.roll({ event });
            },
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

function isBombOrGrenade(
    item: Maybe<MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>>,
): item is WeaponPF2e<CreaturePF2e> {
    if (!item) return false;
    if (item.baseType === "grenade") return true;

    const traits = item.traits;
    return traits.has("alchemical") && traits.has("bomb");
}

function isAreaOrAutoFireType(data: Maybe<AttackAction | CharacterAttack>): data is AttackAction | CharacterAttack {
    return !!data && R.isIncludedIn(data.type, ["area-fire", "auto-fire"]);
}

interface StrikeShortcut extends ShortcutData<typeof zStrikeShortcut> {
    type: "strike";
}

type StrikeItem = MeleePF2e<CreaturePF2e> | WeaponPF2e<CreaturePF2e>;

type StrikeShortcutSource = z.input<typeof zStrikeShortcut>;
type StrikeShortcutData = z.output<typeof zStrikeShortcut>;

export { StrikeShortcut };
export type { StrikeShortcutData, StrikeShortcutSource };
