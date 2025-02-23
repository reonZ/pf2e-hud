import {
    addListenerAll,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationPosition,
    createHook,
    createHTMLElement,
    elementDataset,
    getFlag,
    getFlagProperty,
    htmlClosest,
    htmlQuery,
    localize,
    R,
    render,
    settingPath,
    templateLocalize,
    toggleControlTool,
    UserPF2e,
    UserSourcePF2e,
    waitDialog,
} from "module-helpers";
import { BaseRenderOptions, BaseSettings, PF2eHudBase } from "./base/base";

const DEFAULT_POSITION = { left: 150, top: 100 };

class PF2eHudResources extends PF2eHudBase<
    ResourcesSettings,
    ResourcesUserSettings,
    ResourcesRenderOptions
> {
    #initialized: boolean = false;
    #userConnectedHook = createHook("userConnected", () => this.render());

    #setPositionDebounce = foundry.utils.debounce(() => {
        const newPosition = foundry.utils.mergeObject(DEFAULT_POSITION, this.position, {
            inplace: false,
        });
        this.setSetting("position", newPosition);
    }, 1000);

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
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
        return ["offlines", "enabled", "fontSize"];
    }

    get requiresReload(): boolean {
        return true;
    }

    getSettings() {
        return super.getSettings().concat([
            {
                key: "offlines",
                type: Boolean,
                default: false,
                scope: "world",
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

        if (!this.enabled) return;

        Hooks.on("updateUser", this.#onUpdateUser.bind(this));
        Hooks.on("getSceneControlButtons", this.#onGetSceneControlButtons.bind(this));

        if (this.getUserSetting("showTracker")) {
            this.render(true);
        }
    }

    async _prepareContext(options: ResourcesRenderOptions): Promise<ResourcesContext> {
        const showOfflines = this.getSetting("offlines");

        const resourceContext = (resource: Resource, withTooltip: boolean) => {
            const validated = this.validateResource(resource) as ContextResource;

            validated.ratio = (validated.value - validated.min) / (validated.max - validated.min);

            if (withTooltip) {
                validated.increase = createStepTooltip(validated, "increase");
                validated.decrease = createStepTooltip(validated, "decrease");
            }

            return validated;
        };

        const thisUser = game.user;
        const userResources = this.getUserResources(thisUser).map((resource) =>
            resourceContext(resource, true)
        );
        const sharedResources = R.pipe(
            game.users.filter((user): user is Active<UserPF2e> => {
                return user !== thisUser && (showOfflines || user.active);
            }),
            R.flatMap((user) => {
                return this.getUserResources(user, true).map(
                    (resource) => [user.name, resource] as const
                );
            }),
            R.map(([user, resource]) => {
                return {
                    ...resourceContext(resource, false),
                    user,
                };
            })
        );

        return {
            sharedResources,
            userResources,
            i18n: templateLocalize("resources"),
        };
    }

    _onFirstRender(context: ResourcesContext, options: ResourcesRenderOptions) {
        const { left, top } = this.getSetting("position");

        options.position ??= {} as ApplicationPosition;
        options.position.left = left;
        options.position.top = top;

        this.#userConnectedHook.activate();
    }

    _onClose(options: ApplicationClosingOptions) {
        this.#userConnectedHook.disable();
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

        this.element!.style.setProperty(`--font-size`, `${options.fontSize}px`);

        this.#activateListeners(content);
    }

    _onPosition(position: ApplicationPosition) {
        this.#setPositionDebounce();
    }

    async _onClickAction(event: PointerEvent, target: HTMLElement) {
        if (event.button !== 0) return;

        const action = target.dataset.action as RecourcesActionEvent;

        const updateResource = (negative: boolean) => {
            const parent = htmlClosest(target, "[data-resource-id]")!;
            const { resourceId } = elementDataset(parent);
            this.moveResourceByStep(
                resourceId,
                event.ctrlKey ? 3 : event.shiftKey ? 2 : 1,
                negative
            );
        };

        switch (action) {
            case "add-resource": {
                this.createResource();
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

    getUserResources(user = game.user, sharedOnly?: boolean) {
        const resources = getFlag<Resource[]>(user, "resources.userResources")?.slice() ?? [];
        return sharedOnly ? resources.filter((resource) => resource.shared) : resources;
    }

    getResource(id: string) {
        return this.getUserResources().find((x) => x.id === id);
    }

    async createResource() {
        const id = foundry.utils.randomID();
        const resource = await this.#openResourceMenu({
            id,
            name: localize("resources.menu.name.default"),
            max: 100,
            min: 0,
            value: 100,
            step1: 1,
        });

        if (resource) {
            return this.addResource(resource);
        }
    }

    addResource(resource: Resource) {
        const resources = this.getUserResources();
        resources.push(resource);
        return this.setUserSetting("userResources", resources);
    }

    async editResource(id: string) {
        const resource = this.getResource(id);
        if (!resource) return;

        const editedResource = await this.#openResourceMenu(resource, true);
        if (!editedResource) return;

        if (editedResource.delete) {
            return this.deleteResource(id);
        } else {
            delete editedResource.delete;
            return this.updateResource(editedResource);
        }
    }

    updateResource(resource: Resource) {
        const resources = this.getUserResources();
        const found = resources.findSplice((x) => x.id === resource.id, resource);
        if (!found) return;

        return this.setUserSetting("userResources", resources);
    }

    moveResourceByStep(resourceId: string, step: 1 | 2 | 3, negative: boolean) {
        const resource = this.getResource(resourceId);
        if (!resource) return;

        const stepValue =
            step === 3 ? resource.step3 : step === 2 ? resource.step2 : resource.step1;

        const nb = (stepValue || resource.step1 || 1) * (negative ? -1 : 1);
        const currentValue = Math.clamp(resource.value, resource.min, resource.max);
        const newValue = Math.clamp(currentValue + nb, resource.min, resource.max);
        if (newValue === resource.value) return;

        resource.value = newValue;
        return this.updateResource(resource);
    }

    deleteResource(id: string) {
        const resources = this.getUserResources();
        const found = resources.findSplice((x) => x.id === id);
        if (!found) return;

        return this.setUserSetting("userResources", resources);
    }

    validateResource<T extends Resource>(resource: T): T {
        const { id, max = 0, min = 0, name = "", value = 0 } = resource;
        const validatedMin = Number(min) || 0;
        const validatedMax = Math.max(validatedMin + 2, Number(max) || 0);

        return {
            ...resource,
            id,
            name: name.trim() ?? id,
            min: validatedMin,
            max: validatedMax,
            value: Math.clamp(Number(value) || 0, validatedMin, validatedMax),
        };
    }

    async #openResourceMenu(resource: Resource, isEdit = false) {
        const editedResource = await waitDialog<MenuResource>({
            title: localize("resources.menu.title", isEdit ? "edit" : "create"),
            content: "resources/resource-menu",
            classes: ["pf2e-hud-resource-menu"],
            yes: {
                label: localize("resources.menu.button.yes", isEdit ? "edit" : "create"),
                default: true,
            },
            no: {
                label: localize("resources.menu.button.no"),
            },
            data: {
                resource,
                isEdit,
                i18n: templateLocalize("resources"),
            },
        });

        return editedResource ? this.validateResource(editedResource) : null;
    }

    #onUpdateUser(user: UserPF2e, updates: Partial<UserSourcePF2e>) {
        const hudUpdates = getFlagProperty<ResourcesUserSettings>(updates, this.key);
        if (!R.isPlainObject(hudUpdates)) return;

        if (user !== game.user) {
            this.render();
            return;
        }

        const showTracker = hudUpdates.showTracker;

        if (showTracker !== undefined) {
            toggleControlTool("pf2e-hud-resources", showTracker);

            if (showTracker) {
                this.render(true);
            } else {
                this.close();
            }
        } else {
            this.render();
        }
    }

    #onGetSceneControlButtons(controls: SceneControl[]) {
        controls[0].tools.push({
            title: settingPath("resources.title"),
            name: "pf2e-hud-resources",
            icon: "fa-regular fa-bars-progress",
            toggle: true,
            visible: true,
            active: this.getUserSetting("showTracker"),
            onClick: (active: boolean) => {
                this.setUserSetting("showTracker", active);
            },
        });
    }

    #activateListeners(html: HTMLElement) {
        addListenerAll(html, "[data-resource-id]", "contextmenu", async (event, el) => {
            const { resourceId } = elementDataset(el);
            this.editResource(resourceId);
        });
    }
}

function createStepTooltip(resource: Resource, direction: "increase" | "decrease") {
    const steps = R.pipe(
        ["step1", "step2", "step3"] as const,
        R.map((step) => {
            const value = resource[step];
            if (typeof value !== "number" || value <= 0) return;

            const click = localize("resources", step);
            return localize("resources", direction, { click, value });
        }),
        R.filter(R.isTruthy)
    );

    if (steps.length === 0) {
        steps.push(
            localize("resources", direction, {
                click: localize("resources.step1"),
                value: 1,
            })
        );
    }

    steps.unshift(localize("resources.edit"));

    return steps.join("<br>");
}

type RecourcesActionEvent = "add-resource" | "decrease-resource" | "increase-resource";

type ResourcesContext = {
    i18n: ReturnType<typeof templateLocalize>;
    userResources: ContextResource[];
    sharedResources: (ContextResource & { user: string })[];
};

type ResourcesRenderOptions = BaseRenderOptions;

type Resource = {
    id: string;
    name: string;
    min: number;
    max: number;
    value: number;
    shared?: boolean;
    step1?: number;
    step2?: number;
    step3?: number;
};

type ContextResource = Resource & {
    ratio: number;
    increase: string;
    decrease: string;
};

type MenuResource = Resource & {
    delete?: boolean;
};

type ResourcesUserSettings = {
    showTracker: boolean;
    userResources: Resource[];
};

type ResourcesSettings = BaseSettings & {
    offlines: boolean;
    position: { left: number; top: number };
};

export { PF2eHudResources };
