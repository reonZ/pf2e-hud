import { ImageFilePath, ItemPF2e, R } from "foundry-helpers";
import { FilterValue, ShortcutData } from "hud";

abstract class BaseSidebarItem<
    TItem extends ItemPF2e = ItemPF2e,
    TData extends Record<string, any> = Record<string, any>,
> {
    #filterValue?: FilterValue;

    abstract readonly item: TItem;

    constructor(data: TData) {
        for (const [key, value] of R.entries(data)) {
            Object.defineProperty(this, key, {
                value,
                writable: false,
                configurable: false,
                enumerable: true,
            });
        }
    }

    get id(): string {
        return this.item.id;
    }

    get uuid(): string {
        return this.item.uuid;
    }

    get img(): ImageFilePath {
        return this.item.img;
    }

    get label(): string {
        return this.item.name;
    }

    get filterValue(): FilterValue {
        return (this.#filterValue ??= new FilterValue(this.label));
    }

    abstract toShortcut(event?: Event): ShortcutData;

    createDragData(event?: Event): SidebarItemDragData {
        return {
            fromSidebar: this.toShortcut(event),
        };
    }
}

type SidebarItemDragData = {
    fromInventory?: true;
    fromSidebar: ShortcutData;
};

export { BaseSidebarItem };
export type { SidebarItemDragData };
