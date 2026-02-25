import { ActorPF2e, getFlag, ImageFilePath, ItemPF2e, MacroPF2e, MacroUUID, setFlag } from "foundry-helpers";
import { MacroShortcutSource } from "hud";
import { BaseSidebarItem } from "..";

class MacroSidebarItem extends BaseSidebarItem<ItemPF2e, ExtraMacroData> {
    get item(): ItemPF2e {
        return null as any;
    }

    get id(): string {
        return this.macro.id;
    }

    get uuid(): MacroUUID {
        return this.macro.uuid as MacroUUID;
    }

    get img(): ImageFilePath {
        return this.macro.img ?? "icons/svg/dice-target.svg";
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

    toShortcut(): MacroShortcutSource {
        return {
            img: this.img,
            macroUUID: this.macro.uuid as MacroUUID,
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
