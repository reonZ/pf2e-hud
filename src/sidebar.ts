import { SublocalizeI18n, createHTMLFromString, localizePath, templateLocalize } from "pf2e-api";
import { BaseContext, PF2eHudBase } from "./hud";
import { PF2eHudPersistent } from "./persistent";
import { PF2eHudToken } from "./token";

const SIDEBARS = ["actions", "items", "spells", "skills", "extras"] as const;

const SIDEBAR_ICONS = {
    actions: "fa-solid fa-sword",
    items: "fa-solid fa-backpack",
    spells: "fa-solid fa-wand-magic-sparkles",
    skills: "fa-solid fa-hand",
    extras: "fa-solid fa-cubes",
};

function getSidebars(disabled: Partial<Record<SidebarName, boolean>>, active?: SidebarName) {
    return SIDEBARS.map(
        (type): SidebarElement => ({
            type,
            icon: SIDEBAR_ICONS[type],
            label: localizePath("sidebars", type, "title"),
            disabled: !!disabled[type],
            active: active === type,
        })
    );
}

abstract class PF2eHudSidebar<
    TSettings extends Record<string, any>,
    TSidebar extends PF2eHudToken | PF2eHudPersistent
> extends PF2eHudBase<TSettings> {
    #parentHud: TSidebar;
    #innerElement: HTMLElement | null = null;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        position: {
            width: "auto",
            height: "auto",
        },
    };

    constructor(parent: TSidebar, options?: Partial<ApplicationConfiguration>) {
        super(options);
        this.#parentHud = parent;
    }

    abstract get sidebarKey(): SidebarName;

    get scrollElement() {
        return this.innerElement;
    }

    get templates() {
        return [this.sidebarKey];
    }

    get parentHud() {
        return this.#parentHud;
    }

    get parentElement() {
        return this.parentHud.element!;
    }

    get actor() {
        return this.parentHud.actor!;
    }

    get fontSize() {
        return this.parentHud.fontSize;
    }

    get innerElement() {
        return this.#innerElement!;
    }

    _configureRenderOptions(options: SidebarRenderOptions) {
        super._configureRenderOptions(options);
        options.fontSize = this.fontSize;
    }

    async _prepareContext(options: SidebarRenderOptions): Promise<SidebarContext> {
        const parentData = await super._prepareContext(options);
        return {
            ...parentData,
            i18n: templateLocalize(`sidebars.${this.sidebarKey}`),
        };
    }

    async _renderHTML(context: any, options: SidebarRenderOptions): Promise<string> {
        const template = await this.renderTemplate(this.templates[0], context);
        return `<div class="inner" data-tooltip-direction="UP">${template}</div>`;
    }

    _replaceHTML(result: string, content: HTMLElement, options: SidebarRenderOptions) {
        content.style.setProperty("--font-size", `${options.fontSize}px`);

        const oldElement = this.#innerElement;

        this.#innerElement = createHTMLFromString(result);

        if (oldElement) oldElement.replaceWith(this.#innerElement);
        else content.appendChild(this.#innerElement);
    }

    _insertElement(element: HTMLElement) {
        element.dataset.actorUuid = this.#parentHud.actor?.uuid;
    }
}

type SidebarContext = BaseContext & {
    i18n: SublocalizeI18n;
};

interface SidebarHUD<
    TSettings extends Record<string, any>,
    TSidebar extends PF2eHudToken | PF2eHudPersistent
> {
    get sidebar(): PF2eHudSidebar<TSettings, TSidebar> | null;
    toggleSidebar(sidebar: SidebarName | null): void;
}

type SidebarName = (typeof SIDEBARS)[number];

type SidebarRenderOptions<TParts extends string = string> = ApplicationRenderOptions<TParts> & {
    fontSize: number;
};

type SidebarElement = {
    type: string;
    icon: string;
    label: `${string}.${string}`;
    disabled: boolean;
    active: boolean;
};

export { SIDEBARS, SIDEBAR_ICONS, PF2eHudSidebar, getSidebars };
export type { SidebarElement, SidebarHUD, SidebarName, SidebarRenderOptions, SidebarContext };
