import { FilterValue } from "hud";
import { ItemPF2e, R } from "module-helpers";

abstract class BaseSidebarItem<
    TItem extends ItemPF2e = ItemPF2e,
    TData extends Record<string, any> = Record<string, any>
> {
    #filterValue?: FilterValue;

    abstract get item(): TItem;

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

    get dragImg(): ImageFilePath {
        return this.img;
    }
}

export { BaseSidebarItem };
