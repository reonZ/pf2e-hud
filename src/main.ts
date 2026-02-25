import { randomPick, rollGroupPerception, rollRecallKnowledge, useResolve } from "actions";
import { AvatarEditor } from "avatar-editor";
import { ActorPF2e, createHTMLElement, CreaturePF2e, MODULE, R, userIsGM } from "foundry-helpers";
import { FoundrySidebarPF2eNotHUD } from "foundry-sidebar";
import {
    addStance,
    canUseStances,
    DicePF2eHUD,
    getNpcStrikeImage,
    getStances,
    PersistentPF2eHUD,
    prepareActionGroups,
    prepareExtrasActions,
    prepareNpcStrikes,
    TimePF2eHUD,
    toggleStance,
    TokenPF2eHUD,
    TooltipPF2eHUD,
    TrackerPF2eHUD,
} from "hud";
import { registerKeybinds } from "keybinds";
import { registerSettings } from "settings";

MODULE.register("pf2e-hud");

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
        ["actions", "extras", "items", "skills", "spells"].map((x) => MODULE.templatePath("sidebar", x)),
        ["item-image", "sidebars", "slider", "statistic-action"].map((x) => MODULE.templatePath("partials", x)),
        ["actor-hud", "tooltip"].map((x) => MODULE.templatePath(x)),
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

    prepareNpcStrikes();

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

MODULE.apiExpose("actions", {
    randomPick,
    rollGroupPerception,
    rollRecallKnowledge,
    useResolve,
});

MODULE.apiExpose("utils", {
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
});

MODULE.debugExpose("huds", HUDS);

export { HUDS as hud };
