import {
    ActorPF2e,
    createHTMLElement,
    createHTMLElementContent,
    htmlQuery,
    ImageFilePath,
    ItemPF2e,
    R,
    RollOptionToggle,
    SYSTEM,
} from "foundry-helpers";
import { BaseSidebarItem, SidebarName, SidebarPF2eHUD, ToggleShortcutData } from "hud";

const ROLLOPTIONS_PLACEMENT = {
    actions: "actions",
    spells: "spellcasting",
    items: "inventory",
    skills: "proficiencies",
    feats: "feats",
    extras: undefined,
} as const satisfies Record<SidebarName, string | undefined>;

class ToggleSidebarItem<TItem extends ItemPF2e<ActorPF2e> = ItemPF2e<ActorPF2e>> extends BaseSidebarItem<
    TItem,
    SidebarToggle
> {
    get img(): ImageFilePath {
        return this.item.img;
    }

    get itemKey(): string {
        return generateToggleKey(this);
    }

    get elementSelector(): string {
        return `[data-item-id="${this.itemId}"][data-domain="${this.domain}"][data-option="${this.option}"]`;
    }

    toShortcut(): ToggleShortcutData {
        return {
            domain: this.domain,
            img: this.img,
            name: this.label,
            option: this.option,
            type: "toggle",
        };
    }
}

interface ToggleSidebarItem<TItem extends ItemPF2e<ActorPF2e> = ItemPF2e<ActorPF2e>> extends Readonly<SidebarToggle> {
    readonly item: TItem;
}

function generateToggleKey(options: { itemId: string; domain: string; option: string }): string;
function generateToggleKey(options: { itemId?: string; domain?: string; option?: string }): string | undefined;
function generateToggleKey({
    itemId,
    domain,
    option,
}: {
    itemId?: string;
    domain?: string;
    option?: string;
}): string | undefined {
    if (!itemId || !domain || !option) return;
    return `${itemId}-${domain}-${option}`;
}

async function createRollOptionsElements(this: SidebarPF2eHUD): Promise<HTMLElement | undefined> {
    const toggles = getRollOptionsData.call(this);
    if (!toggles.length) return;

    const togglesTemplate = await foundry.applications.handlebars.renderTemplate(
        SYSTEM.relativePath("templates/actors/partials/toggles.hbs"),
        { toggles },
    );

    const togglesElement = createHTMLElementContent({
        content: togglesTemplate,
    });

    for (const { filterValue, img, alwaysActive, elementSelector, suboptions } of toggles) {
        if (!img) continue;

        const imgEl = createHTMLElement("img", { classes: ["drag-img"] });
        imgEl.src = img;

        const toggleRow = htmlQuery(togglesElement, elementSelector);

        if (toggleRow) {
            toggleRow.draggable = !alwaysActive || suboptions.length > 1;
            toggleRow.appendChild(imgEl);
            toggleRow.classList.add("item");
            toggleRow.dataset.filterValue = filterValue.toString();
        }
    }

    return togglesElement;
}

function getRollOptionsData(this: SidebarPF2eHUD): ToggleSidebarItem[] {
    const selectedPlacement = ROLLOPTIONS_PLACEMENT[this.name];
    if (!selectedPlacement) return [];

    return R.pipe(
        R.values(this.actor.synthetics.toggles).flatMap((domain) => Object.values(domain)),
        R.map((toggle): ToggleSidebarItem | false | undefined => {
            if (toggle.placement !== selectedPlacement) return;
            if (toggle.domain === "elemental-blast" && toggle.option === "action-cost") return;

            const item = this.actor.items.get(toggle.itemId);
            return item && this.addSidebarItem(ToggleSidebarItem, "itemKey", { ...toggle, item });
        }),
        R.filter(R.isTruthy),
    );
}

type SidebarToggle = RollOptionToggle & {
    item: ItemPF2e<ActorPF2e>;
};

export { createRollOptionsElements, generateToggleKey, ToggleSidebarItem };
export type { SidebarToggle };
