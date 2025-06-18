import { MODULE, R, templatePath, userIsGM } from "module-helpers";
import { PersistentPF2eHUD, TokenPF2eHUD, TooltipPF2eHUD, TrackerPF2eHUD } from "hud";
import { registerSettings } from "settings";

MODULE.register("pf2e-hud");
MODULE.enableDebugMode();

const HUDS = {
    persistent: new PersistentPF2eHUD(),
    token: new TokenPF2eHUD(),
    tooltip: new TooltipPF2eHUD(),
    tracker: new TrackerPF2eHUD(),
};

Hooks.on("init", () => {
    const isGM = userIsGM();

    const partials = ["item-image", "sidebars", "slider"].map((x) => templatePath("partials", x));
    foundry.applications.handlebars.loadTemplates(partials);

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
