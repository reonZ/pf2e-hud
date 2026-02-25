import { R, registerModuleKeybinds } from "foundry-helpers";
import { BasePF2eHUD, SidebarPF2eHUD } from "hud";

function registerKeybinds(huds: Record<string, BasePF2eHUD>) {
    registerModuleKeybinds(
        R.pipe(
            R.values(huds),
            R.map((hud) => [hud.key, hud.keybindsSchema] as const),
            R.concat([["sidebar", SidebarPF2eHUD.keybindsSchema] as const]),
            R.filter(([_, schemas]) => schemas.length > 0),
            R.fromEntries(),
        ),
    );
}

export { registerKeybinds };
