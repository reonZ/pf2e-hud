import { getFlag, localize, MODULE, R, registerWrapper, SceneConfigPF2e, ScenePF2e } from "foundry-helpers";
import { hud } from "main";

const VISIBLE_OPTIONS = ["persistent", "token", "tooltip", "tracker"] as const;

Hooks.on("canvasReady", onUpdateScene);
Hooks.on("updateScene", onUpdateScene);

function prepareSceneConfigs() {
    registerWrapper(
        "WRAPPER",
        "CONFIG.Scene.sheetClasses.base['pf2e.SceneConfigPF2e'].cls.prototype._renderHTML",
        sceneConfigPF2eRenderHTML,
    );
}

function hudIsHidden(hud: VisibleOption): boolean {
    return document.body.classList.contains(`pf2e-hud-hidden-${hud}`);
}

function getSceneVisibleFlags(scene = game.scenes.current): VisibleOption[] {
    const flags = scene ? getFlag<VisibleOption[]>(scene, "visible") : undefined;
    return (flags?.filter((key) => R.isIncludedIn(key, VISIBLE_OPTIONS)) ?? VISIBLE_OPTIONS) as VisibleOption[];
}

function onUpdateScene() {
    const classList = document.body.classList;
    const visible = getSceneVisibleFlags();
    const persistentWasHidden = hudIsHidden("persistent");

    for (const option of VISIBLE_OPTIONS) {
        classList.toggle(`pf2e-hud-hidden-${option}`, !R.isIncludedIn(option, visible));
    }

    // we need to do that for the avatar portrait
    if (persistentWasHidden && R.isIncludedIn("persistent", visible)) {
        hud.persistent.render();
    }
}

async function sceneConfigPF2eRenderHTML(
    this: SceneConfigPF2e<ScenePF2e>,
    wrapped: libWrapper.RegisterCallback,
    ...args: any[]
): Promise<Record<string, HTMLElement>> {
    const rendered: Record<string, HTMLElement> = await wrapped(...args);

    const visibleSelect = foundry.applications.fields.createMultiSelectInput({
        name: `flags.${MODULE.id}.visible`,
        options: VISIBLE_OPTIONS.map((key) => {
            return { value: key, label: localize("settings", key, "title") };
        }),
        value: getSceneVisibleFlags(this.document) as string & string[],
    });

    const visibleGroup = foundry.applications.fields.createFormGroup({
        hint: localize("scene.visible.hint"),
        input: visibleSelect,
        label: localize("scene.visible.label"),
    });

    rendered.pf2e?.appendChild(visibleGroup);

    return rendered;
}

type VisibleOption = (typeof VISIBLE_OPTIONS)[number];

export { hudIsHidden, prepareSceneConfigs };
