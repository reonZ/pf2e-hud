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
    #selfEffect?: SelfEffectReference | null;
    #macro: Maybe<MacroPF2e>;
    #uses!: ValueAndMaybeMax | null;

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
        const ability = this.item;
        if (!ability) return;

        const getActionMacro = this.cached("getActionMacro", () => {
            return game.toolbelt?.getToolSetting("actionable", "action")
                ? game.toolbelt?.api.actionable.getActionMacro
                : null;
        });

        const crafting = ability.crafting;
        const selfEffect = (this.#selfEffect = !crafting ? ability.system.selfEffect : null);

        this.#macro = !crafting && !selfEffect ? await getActionMacro?.(ability) : null;
        this.#uses = getActionResource(ability) ?? getActionFrequency(ability) ?? null;
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

    get actionCost(): OneToThree | "reaction" | "free" | null {
        if (this.#actionCost !== undefined) {
            return this.#actionCost;
        }

        const actionCost = this.item?.actionCost;

        if (!actionCost) {
            return (this.#actionCost = null);
        }

        const type = actionCost.type;

        if (type !== "action") {
            return (this.#actionCost = type);
        }

        return (this.#actionCost = actionCost.value);
    }

    get cost(): ShortcutCost | null {
        if (!this.item) return null;

        const actionCost = this.actionCost;
        return actionCost ? { value: actionCost } : null;
    }

    get uses(): ValueAndMaybeMax | null {
        return this.#uses;
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
        const actionCost = this.actionCost;

        const suffix = this.macro
            ? localize("shortcuts.tooltip.subtitle.macro")
            : this.selfEffect
            ? game.i18n.localize("PF2E.Item.Ability.FIELDS.selfEffect.label")
            : null;

        const subtitle = suffix ? `${label} (${suffix})` : label;

        if (!this.item || !actionCost) {
            return subtitle;
        }

        const glyph = Handlebars.helpers.actionGlyph(actionCost);

        return `${glyph} ${subtitle}`;
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

type ActionShortcutData = ShortcutSource<ActionShortcutSchema>;

export { ActionShortcut };
export type { ActionShortcutData };
