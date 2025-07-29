import { ActorPF2e, getFlag, ItemPF2e, MacroPF2e, setFlag } from "module-helpers";
import { BaseSidebarItem } from "..";
import { MacroShortcutData } from "hud/persistent";

class MacroSidebarItem extends BaseSidebarItem<ItemPF2e, ExtraMacroData> {
    static DEFAULT_IMG: "icons/svg/dice-target.svg";

    get item(): ItemPF2e {
        return null as any;
    }

    get id(): string {
        return this.macro.id;
    }

    get uuid(): string {
        return this.macro.uuid;
    }

    get img(): ImageFilePath {
        return this.macro.img ?? MacroSidebarItem.DEFAULT_IMG;
    }

    get label(): string {
        return this.macro.name;
    }

    get worldActor(): ActorPF2e {
        return (this.actor.token?.baseActor ?? this.actor) as ActorPF2e;
    }

    delete() {
        const macroUuid = this.macro.uuid;
        const worldActor = this.worldActor;
        const macros = getFlag<string[]>(worldActor, "macros", game.user.id) ?? [];

        if (macros.findSplice((uuid) => uuid === macroUuid)) {
            setFlag(worldActor, "macros", game.user.id, macros);
        }
    }

    edit() {
        this.macro.sheet.render(true);
    }

    execute() {
        this.macro.execute({ actor: this.actor });
    }

    toShortcut(event?: Event): MacroShortcutData {
        return {
            img: this.img,
            macroUUID: this.macro.uuid,
            name: this.label,
            type: "macro",
        };
    }
}

interface MacroSidebarItem extends Readonly<ExtraMacroData> {}

type ExtraMacroData = {
    macro: MacroPF2e;
    actor: ActorPF2e;
};

export { MacroSidebarItem };
