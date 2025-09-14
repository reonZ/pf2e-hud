import { randomPick, rollGroupPerception, rollRecallKnowledge, useResolve } from "actions";
import { AvatarEditor, AvatarModel } from "avatar-editor";
import { FoundrySidebarPF2eNotHUD } from "foundry-sidebar";
import { HealthStatus } from "health-status";
import {
    addStance,
    canUseStances,
    DicePF2eHUD,
    getNpcStrikeImage,
    getStances,
    PersistentPF2eHUD,
    prepareActionGroups,
    prepareExtrasActions,
    TimePF2eHUD,
    toggleStance,
    TokenPF2eHUD,
    TooltipPF2eHUD,
    TrackerPF2eHUD,
} from "hud";
import { registerKeybinds } from "keybinds";
import {
    ActorPF2e,
    createHTMLElement,
    CreaturePF2e,
    MODULE,
    R,
    templatePath,
    userIsGM,
} from "module-helpers";
import { registerSettings } from "settings";

MODULE.register("pf2e-hud");
// MODULE.enableDebugMode();

const HUDS = {
    foundrySidebar: new FoundrySidebarPF2eNotHUD(),
    tracker: new TrackerPF2eHUD(),
    dice: new DicePF2eHUD(),
    persistent: new PersistentPF2eHUD(),
    time: new TimePF2eHUD(),
    token: new TokenPF2eHUD(),
    tooltip: new TooltipPF2eHUD(),
};

Hooks.once("init", () => {
    const isGM = userIsGM();

    const templates = [
        ["actions", "extras", "items", "skills", "spells"].map((x) => templatePath("sidebar", x)),
        ["attack-category", "item-image", "sidebars", "slider", "statistic-action"].map((x) =>
            templatePath("partials", x)
        ),
        ["actor-hud", "tooltip"].map((x) => templatePath(x)),
    ];

    foundry.applications.handlebars.loadTemplates(templates.flat());

    registerKeybinds(HUDS);
    registerSettings(HUDS);

    for (const hud of R.values(HUDS)) {
        hud._initialize();
        hud.init(isGM);
    }

    // we preload foundry checkboxes to avoid weirdness with sidebars toggles
    const fakeCheckboxes = R.map([true, false], (checked) => {
        const fakeCheckbox = createHTMLElement("input", {
            classes: ["fake"],
        });

        fakeCheckbox.type = "checkbox";
        fakeCheckbox.checked = checked;

        document.body.appendChild(fakeCheckbox);

        return fakeCheckbox;
    });

    // we remove the preloaded checkboxes to not pollute the DOM
    setTimeout(() => {
        for (const checkbox of fakeCheckboxes) {
            checkbox.remove();
        }
    }, 1000);
});

Hooks.once("ready", async () => {
    const isGM = game.user.isGM;

    await prepareActionGroups();
    await prepareExtrasActions();

    for (const hud of R.values(HUDS)) {
        hud.ready(isGM);
    }
});

MODULE.apiExpose({
    actions: {
        randomPick,
        rollGroupPerception,
        rollRecallKnowledge,
        useResolve,
    },
    utils: {
        addStance,
        canUseStances,
        editAvatar: (actor: ActorPF2e) => {
            if (!actor.isOfType("creature", "npc")) return;
            const worldActor = (actor.token?.baseActor ?? actor) as CreaturePF2e;
            new AvatarEditor(worldActor).render(true);
        },
        getNpcStrikeImage,
        getStances,
        toggleStance,
    },
});

MODULE.devExpose({ huds: HUDS });

MODULE.debugExpose({ AvatarModel, HealthStatus });

export { HUDS as hud };
