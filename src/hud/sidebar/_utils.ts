import { ItemPF2e } from "module-helpers";

class SidebarFilter {
    #list: string[];

    constructor(...entries: (string | ItemPF2e | SidebarFilter)[]) {
        this.#list = [];
        this.add(...entries);
    }

    add(...entries: (string | ItemPF2e | SidebarFilter)[]) {
        for (const entry of entries) {
            if (entry instanceof Item) {
                this.#list.push(entry.name);
            } else if (entry instanceof SidebarFilter) {
                this.#list.push(...entry.#list);
            } else {
                this.#list.push(entry);
            }
        }
    }

    toString(): string {
        return this.#list.map((x) => x.toLowerCase()).join("|");
    }
}

export { SidebarFilter };
