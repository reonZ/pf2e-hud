import {
    addListenerAll,
    awaitDialog,
    createHTMLElement,
    elementDataset,
    getFlagProperty,
    htmlClosest,
    htmlQuery,
    localize,
    render,
    settingPath,
    templateLocalize,
    toggleControlTool,
} from "foundry-pf2e";
import { BaseRenderOptions, BaseSettings, PF2eHudBase } from "./base/base";

const DEFAULT_POSITION = { left: 150, top: 100 };

let TOOLTIPS: { decrease: string; increase: string } | null = null;
function getTooltips() {
    TOOLTIPS ??= (() => {
        const rightClick = localize("resources.edit");
        const create = (type: "Decrease" | "Increase") => {
            const leftClick = ["Click", "ShiftClick", "ControlClick"]
                .map((x) => game.i18n.localize(`PF2E.Actor.Inventory.ItemQuantity.${type}.${x}`))
                .join("<br>");
            return `${rightClick}<br>${leftClick}`;
        };

        return {
            decrease: create("Decrease"),
            increase: create("Increase"),
        };
    })();
    return TOOLTIPS;
}

class PF2eHudResources extends PF2eHudBase<ResourcesSettings, ResourcesUserSettings> {
    #initialized: boolean = false;

    static DEFAULT_OPTIONS: PartialApplicationConfiguration = {
        id: "pf2e-hud-resources",
        window: {
            positioned: true,
            frame: true,
        },
        position: {
            width: "auto",
            height: "auto",
        },
    };

    get key(): "resources" {
        return "resources";
    }

    get templates() {
        return ["tracker"];
    }

    get SETTINGS_ORDER(): (keyof ResourcesSettings)[] {
        return ["enabled", "fontSize"];
    }

    get worldResources() {
        return this.getSetting("worldResources").slice();
    }

    get userResources() {
        return this.getUserSetting("userResources")?.slice() ?? [];
    }

    getSettings() {
        const parentSettings = super.getSettings();

        const enabledSetting = parentSettings.find((x) => x.key === "enabled")!;
        enabledSetting.scope = "world";
        enabledSetting.hint = settingPath("resources.enabled.hint");
        enabledSetting.requiresReload = true;

        return parentSettings.concat([
            {
                key: "worldResources",
                type: Array,
                default: [],
                config: false,
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "position",
                type: Object,
                default: { ...DEFAULT_POSITION },
                scope: "client",
                config: false,
            },
        ]);
    }

    _onEnable() {
        if (this.#initialized) return;
        this.#initialized = true;

        const enabled = this.enabled;
        if (!enabled) return;

        Hooks.on("updateUser", this.#onUpdateUser.bind(this));
        Hooks.on("getSceneControlButtons", this.#onGetSceneControlButtons.bind(this));

        if (this.getUserSetting("showTracker")) this.render(true);
    }

    async _prepareContext(options: ResourcesRenderOptions): Promise<ResourcesContext> {
        const resourceContext = (resource: Resource) => {
            const validated = this.validateResource(resource) as ContextResource;
            validated.ratio = (validated.value - validated.min) / (validated.max - validated.min);
            return validated;
        };

        const isGM = game.user.isGM;
        const worldResources = isGM
            ? this.worldResources
            : this.worldResources.filter((resource) => resource.visible);

        return {
            isGM,
            tooltips: getTooltips(),
            worldResources: worldResources.map((resource) => resourceContext(resource)),
            userResources: this.userResources.map((resource) => resourceContext(resource)),
            i18n: templateLocalize("resources"),
        };
    }

    _onFirstRender(context: ResourcesContext, options: ResourcesRenderOptions) {
        const { left, top } = this.getSetting("position");
        options.position ??= {};
        options.position.left = left;
        options.position.top = top;
    }

    async _renderFrame(options: ResourcesRenderOptions) {
        const frame = await super._renderFrame(options);
        const windowHeader = htmlQuery(frame, ".window-header")!;

        const template = await render("resources/header", {
            i18n: templateLocalize("resources"),
        });

        const header = createHTMLElement("div", {
            innerHTML: template,
        });

        frame.dataset.tooltipClass = "pf2e-hud-resources-tooltip";
        windowHeader.replaceChildren(...header.children);

        return frame;
    }

    async _renderHTML(context: ResourcesContext, options: ResourcesRenderOptions) {
        return await this.renderTemplate("tracker", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: ResourcesRenderOptions) {
        content.innerHTML = result;

        content.style.setProperty(`--font-size`, `${options.fontSize}px`);

        this.#activateListeners(content);
    }

    _onPosition(position: ApplicationPosition) {
        this.#setPositionDebounce();
    }

    async _onClickAction(event: PointerEvent, target: HTMLElement) {
        if (event.button !== 0) return;

        const action = target.dataset.action as RecourcesActionEvent;

        const updateResource = (negative: boolean) => {
            const nb = event.ctrlKey ? 10 : event.shiftKey ? 5 : 1;
            const parent = htmlClosest(target, "[data-resource-id]")!;
            const { resourceId, isWorld } = elementDataset(parent);
            this.changeResourceQuantity(resourceId, isWorld === "true", negative ? nb * -1 : nb);
        };

        switch (action) {
            case "add-resource": {
                this.createResource(game.user.isGM);
                break;
            }

            case "decrease-resource": {
                updateResource(true);
                break;
            }

            case "increase-resource": {
                updateResource(false);
                break;
            }
        }
    }

    getResource(id: string, isWorld: boolean) {
        const resources = isWorld ? this.worldResources : this.userResources;
        return resources.find((x) => x.id === id) ?? null;
    }

    async createResource(isWorld: boolean) {
        if (isWorld && !game.user.isGM) return;

        const id = foundry.utils.randomID();
        const resource = await this.#openResourceMenu({
            id,
            name: localize("resources.menu.name.default"),
            max: 100,
            min: 0,
            value: 100,
            world: isWorld,
        });

        if (resource) {
            return this.addResource(resource);
        }
    }

    addResource(resource: Resource) {
        if (resource.world && !game.user.isGM) return;

        const resources = resource.world ? this.worldResources : this.userResources;
        resources.push(resource);

        return this.setResources(resources, resource.world);
    }

    changeResourceQuantity(id: string, isWorld: boolean, nb: number) {
        if (isWorld && !game.user.isGM) return;

        const resource = this.getResource(id, isWorld);
        if (!resource) return;

        const newValue = Math.clamp(resource.value + nb, resource.min, resource.max);
        if (newValue === resource.value) return;

        resource.value = newValue;
        return this.updateResource(resource);
    }

    updateResource(resource: Resource) {
        if (resource.world && !game.user.isGM) return;

        const resources = resource.world ? this.worldResources : this.userResources;
        const found = resources.findSplice((x) => x.id === resource.id, resource);
        if (!found) return;

        return this.setResources(resources, resource.world);
    }

    async editResource(id: string, isWorld: boolean) {
        if (isWorld && !game.user.isGM) return;

        const resource = this.getResource(id, isWorld);
        if (!resource) return;

        const editedResource = await this.#openResourceMenu(resource, true);
        if (!editedResource) return;

        if (editedResource.delete) {
            return this.deleteResource(id, isWorld);
        } else {
            delete editedResource.delete;
            return this.updateResource(editedResource);
        }
    }

    deleteResource(id: string, isWorld: boolean) {
        if (isWorld && !game.user.isGM) return;

        const resources = isWorld ? this.worldResources : this.userResources;
        const found = resources.findSplice((x) => x.id === id);
        if (!found) return;

        return this.setResources(resources, isWorld);
    }

    setResources(resources: Resource[], isWorld: boolean) {
        if (isWorld && !game.user.isGM) return;

        if (isWorld) {
            return this.setSetting("worldResources", resources);
        } else {
            return this.setUserSetting("userResources", resources);
        }
    }

    validateResource<T extends Resource>(resource: T): T {
        const { id, max = 0, min = 0, name = "", value = 0 } = resource;
        const validatedMin = Math.max(0, min);
        const validatedMax = Math.max(validatedMin + 2, max);

        return {
            ...resource,
            id,
            name: name.trim() ?? id,
            min: validatedMin,
            max: validatedMax,
            value: Math.clamp(value, validatedMin, validatedMax),
        };
    }

    async #openResourceMenu(resource: Resource, isEdit = false) {
        const content = await render("resources/resource-menu", {
            resource,
            isEdit,
            i18n: templateLocalize("resources.menu"),
        });

        const data = await awaitDialog<MenuResource>({
            title: localize("resources.menu.title", isEdit ? "edit" : "create"),
            content,
            classes: ["pf2e-hud-resource-menu"],
            yes: {
                label: localize("resources.menu.button.yes", isEdit ? "edit" : "create"),
                default: true,
            },
            no: {
                label: localize("resources.menu.button.no"),
            },
        });

        return data ? this.validateResource(data) : null;
    }

    #setPositionDebounce = foundry.utils.debounce(() => {
        const newPosition = foundry.utils.mergeObject(DEFAULT_POSITION, this.position, {
            inplace: false,
        });
        this.setSetting("position", newPosition);
    }, 1000);

    #onGetSceneControlButtons(controls: SceneControl[]) {
        controls[0].tools.push({
            title: settingPath("resources.title"),
            name: "pf2e-hud-resources",
            icon: "fa-regular fa-bars-progress",
            toggle: true,
            visible: true,
            active: this.getUserSetting("showTracker"),
            onClick: (active) => {
                this.setUserSetting("showTracker", active);
            },
        });
    }

    #onUpdateUser(user: UserPF2e, updates: Partial<UserSourcePF2e>) {
        if (user !== game.user) return;

        const showTracker = getFlagProperty<boolean>(updates, "resources.showTracker");
        if (showTracker !== undefined) {
            toggleControlTool("pf2e-hud-resources", showTracker);

            if (showTracker) this.render(true);
            else this.close();

            return;
        }

        const resources = getFlagProperty(updates, "resources.userResources");
        if (resources !== undefined) {
            this.render();
        }
    }

    #activateListeners(html: HTMLElement) {
        addListenerAll(html, "[data-resource-id]", "contextmenu", async (event, el) => {
            const { resourceId, isWorld } = elementDataset(el);
            this.editResource(resourceId, isWorld === "true");
        });
    }
}

type RecourcesActionEvent = "add-resource" | "decrease-resource" | "increase-resource";

type ResourcesContext = {
    isGM: boolean;
    i18n: ReturnType<typeof templateLocalize>;
    userResources: ContextResource[];
    worldResources: ContextResource[];
    tooltips: {
        decrease: string;
        increase: string;
    };
};

type ResourcesRenderOptions = BaseRenderOptions;

type Resource = {
    id: string;
    name: string;
    min: number;
    max: number;
    value: number;
    world: boolean;
    visible?: boolean;
};

type ContextResource = Resource & { ratio: number };

type MenuResource = Resource & {
    delete?: boolean;
};

type ResourcesUserSettings = {
    showTracker: boolean;
    userResources: Resource[];
};

type ResourcesSettings = BaseSettings & {
    worldResources: Resource[];
    position: { left: number; top: number };
};

export { PF2eHudResources };
