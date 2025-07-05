import { IdField } from "module-helpers";
import { BaseShortcutSchema } from ".";

// class ToggleShortcut
//     extends foundry.abstract.DataModel<null, ToggleShortcutSchema>
//     implements IPersistentShortcut
// {
//     get canUse(): boolean {
//         throw new Error("Method not implemented.");
//     }

//     get canAltUse(): boolean {
//         throw new Error("Method not implemented.");
//     }

//     get dataset(): ShortcutDataset | undefined {
//         throw new Error("Method not implemented.");
//     }

//     get disabled(): boolean {
//         throw new Error("Method not implemented.");
//     }

//     get greyed(): boolean {
//         throw new Error("Method not implemented.");
//     }

//     get item(): Maybe<ItemPF2e<ActorPF2e<TokenDocumentPF2e<ScenePF2e | null> | null> | null>> {
//         throw new Error("Method not implemented.");
//     }

//     get usedImage(): `${string}.apng` | `${string}.avif` | `${string}.bmp` | `${string}.gif` | `${string}.jpeg` | `${string}.jpg` | `${string}.png` | `${string}.svg` | `${string}.tiff` | `${string}.webp` {
//         throw new Error("Method not implemented.");
//     }

//     // checkbox?: { checked: boolean; } | null | undefined;
//     // counter?: ValueAndMaybeMax | null | undefined;
//     // _tooltip?: HTMLElement | undefined;

//     use(event: Event): void {
//         throw new Error("Method not implemented.");
//     }

//     altUse(event: Event): void {
//         throw new Error("Method not implemented.");
//     }

//     tooltipData(): ShortcutTooltipData {
//         throw new Error("Method not implemented.");
//     }

// }

type ToggleShortcutSchema = BaseShortcutSchema & {
    itemId: IdField<true, false, false>;
};

type ToggleShortcutData = SourceFromSchema<ToggleShortcutSchema>;

export type { ToggleShortcutData, ToggleShortcutSchema };
