import { PersistentPF2eHUD, TokenPF2eHUD, TooltipPF2eHUD, TrackerPF2eHUD } from "hud";
import { MODULE, R, userIsGM } from "module-helpers";
import { registerSettings } from "settings";

MODULE.register("pf2e-hud");
// MODULE.enableDebugMode();

const HUDS = {
    persistent: new PersistentPF2eHUD(),
    token: new TokenPF2eHUD(),
    tooltip: new TooltipPF2eHUD(),
    tracker: new TrackerPF2eHUD(),
};

Hooks.on("init", () => {
    const isGM = userIsGM();

    // TODO load partials
    // foundry.applications.handlebars.loadTemplates([]);

    registerSettings(HUDS);

    for (const hud of R.values(HUDS)) {
        hud._initialize();
        hud.init(isGM);
    }
});

Hooks.on("ready", () => {
    const isGM = game.user.isGM;

    for (const hud of R.values(HUDS)) {
        hud.ready(isGM);
    }
});

MODULE.devExpose({ huds: HUDS });

export { HUDS as hud };
