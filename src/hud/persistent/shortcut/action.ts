import { getActionFrequency, getActionImg, getActionResource, toggleExploration } from "hud";
import {
    AbilityItemPF2e,
    ActionType,
    CreaturePF2e,
    FeatPF2e,
    IdField,
    localize,
    MacroPF2e,
    OneToThree,
    SelfEffectReference,
    useAction,
    ValueAndMaybeMax,
} from "module-helpers";
import {
    BaseShortcutSchema,
    generateBaseShortcutFields,
    PersistentShortcut,
    ShortcutCost,
    ShortcutSource,
} from ".";

class ActionShortcut extends PersistentShortcut<
    ActionShortcutSchema,
    FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>
> {
    #actionCost?: OneToThree | "reaction" | "free" | null;
    #isExploration?: boolean;
    #isTactic?: boolean;
    #selfEffect: Maybe<SelfEffectReference>;
    #macro: Maybe<MacroPF2e>;
    #uses?: ValueAndMaybeMax;
    #isUntrained?: boolean;

    static defineSchema(): ActionShortcutSchema {
        return {
            ...generateBaseShortcutFields("action"),
            itemId: new IdField({
                required: true,
                nullable: false,
            }),
        };
    }

    static async getItem(
        actor: CreaturePF2e,
        data: ActionShortcutData
    ): Promise<Maybe<FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>>> {
        return actor.items.get<FeatPF2e<CreaturePF2e> | AbilityItemPF2e<CreaturePF2e>>(data.itemId);
    }

    async _initShortcut(): Promise<void> {
        const item = this.item;
        if (!item) return;

        const isCharacter = this.actor.isOfType("character");

        const getActionMacro = this.cached("getActionMacro", () => {
            return game.toolbelt?.getToolSetting("actionable", "action")
                ? game.toolbelt?.api.actionable.getActionMacro
                : null;
        });

        const isTacticAbility =
            isCharacter &&
            this.cached("isTacticAbility", () => {
                return game.dailies?.active ? game.dailies?.api.isTacticAbility : null;
            })?.(item);

        const includedInTactics =
            isTacticAbility &&
            this.cached("commanderTactics", () => {
                return game.dailies?.active
                    ? game.dailies?.api.getCommanderTactics(this.actor)
                    : null;
            })?.includes(item.id);

        const crafting = item.crafting;
        const actionCost = this.item?.actionCost;
        const selfEffect = (this.#selfEffect = !crafting ? item.system.selfEffect : null);

        this.#macro = !crafting && !selfEffect ? await getActionMacro?.(item) : null;
        this.#uses = getActionResource(item) ?? getActionFrequency(item) ?? undefined;
        this.#actionCost = (actionCost?.type !== "action" && actionCost?.type) || actionCost?.value;
        this.#isTactic = !!isTacticAbility;
        this.#isUntrained = !includedInTactics;
    }

    get isUntrainedTactic(): boolean {
        return !!this.#isTactic && !!this.#isUntrained;
    }

    get canUse(): boolean {
        return !!this.item && (!this.uses || this.uses.value > 0) && !this.isUntrainedTactic;
    }

    get isExploration(): boolean {
        return (this.#isExploration ??= !!this.item?.system.traits.value.includes("exploration"));
    }

    get selfEffect(): Maybe<SelfEffectReference> {
        return this.#selfEffect;
    }

    get macro(): Maybe<MacroPF2e> {
        return this.#macro;
    }

    get actionCost(): Maybe<OneToThree | "reaction" | "free"> {
        return this.#actionCost;
    }

    get cost(): ShortcutCost | null {
        if (!this.item) return null;

        const actionCost = this.actionCost;
        return actionCost ? { value: actionCost } : null;
    }

    get uses(): ValueAndMaybeMax | null {
        return this.#uses ?? null;
    }

    get icon(): string {
        return this.isExploration ? "fa-solid fa-earth-americas" : "fa-solid fa-play";
    }

    get actionType(): ActionType {
        return this.item?.system.actionType.value ?? "action";
    }

    get usedImage(): ImageFilePath {
        return this.item ? getActionImg(this.item, this.macro) : this.img;
    }

    get checkbox(): { checked: boolean } | null {
        const explorations = this.cached("explorations", () => {
            return (this.actor.isOfType("character") && this.actor.system.exploration) || [];
        });

        return this.item && this.isExploration
            ? { checked: explorations.includes(this.item.id) }
            : null;
    }

    get subtitle(): string {
        if (this.isExploration) {
            return game.i18n.localize("PF2E.TraitExploration");
        }

        const label = game.i18n.localize(CONFIG.PF2E.actionTypes[this.actionType]);

        const suffix = this.macro
            ? localize("shortcuts.tooltip.subtitle.macro")
            : this.selfEffect
            ? game.i18n.localize("PF2E.Item.Ability.FIELDS.selfEffect.label")
            : null;

        return suffix ? `${label} (${suffix})` : label;
    }

    get unusableReason(): string | undefined {
        return !this.item
            ? "match"
            : this.uses && this.uses.value < 1
            ? "uses"
            : this.isUntrainedTactic
            ? "tactic"
            : undefined;
    }

    use(event: MouseEvent): void {
        if (!this.item) return;

        if (this.isExploration) {
            toggleExploration(this.actor, this.item.id);
        } else {
            useAction(event, this.item);
        }
    }
}

interface ActionShortcut extends ModelPropsFromSchema<ActionShortcutSchema> {}

type ActionShortcutSchema = BaseShortcutSchema & {
    itemId: IdField<true, false, false>;
};

type ActionShortcutData = ShortcutSource<ActionShortcutSchema> & {
    type: "action";
};

export { ActionShortcut };
export type { ActionShortcutData };
