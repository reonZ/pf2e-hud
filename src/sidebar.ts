import {
    SublocalizeI18n,
    addListenerAll,
    createHTMLFromString,
    localizePath,
    templateLocalize,
} from "pf2e-api";
import { BaseContext, PF2eHudBase } from "./hud";
import { PF2eHudPersistent } from "./persistent";
import { PF2eHudPopup } from "./popup";
import { PF2eHudToken } from "./token";
import { addSendItemToChatListeners, hasSpells } from "./utils";

const SIDEBARS = ["actions", "items", "spells", "skills", "extras"] as const;

const SIDEBAR_DATA = {
    actions: {
        icon: "fa-solid fa-sword",
        disabled: (actor: ActorPF2e) => false,
    },
    items: {
        icon: "fa-solid fa-backpack",
        disabled: (actor: ActorPF2e) => false,
    },
    spells: {
        icon: "fa-solid fa-wand-magic-sparkles",
        disabled: (actor: ActorPF2e) => !hasSpells(actor),
    },
    skills: {
        icon: "fa-solid fa-hand",
        disabled: (actor: ActorPF2e) => false,
    },
    extras: {
        icon: "fa-solid fa-cubes",
        disabled: (actor: ActorPF2e) => false,
    },
};

function getSidebars(actor: ActorPF2e, active?: SidebarName) {
    return SIDEBARS.map((type): SidebarElement => {
        const { icon, disabled } = SIDEBAR_DATA[type];

        return {
            type,
            icon,
            label: localizePath("sidebars", type, "title"),
            disabled: disabled(actor),
            active: active === type,
        };
    });
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
        return this.innerElement.querySelector<HTMLElement>(".item-list.scroll");
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

    abstract _activateListener(html: HTMLElement): void;

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

    async _renderHTML(context: any, options: SidebarRenderOptions): Promise<HTMLElement> {
        const template = await this.renderTemplate(this.templates[0], context);
        const innerTemplate = `<div class="inner" data-tooltip-direction="UP">${template}</div>`;
        return createHTMLFromString(innerTemplate);
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement, options: SidebarRenderOptions) {
        content.style.setProperty("--font-size", `${options.fontSize}px`);

        const oldElement = this.#innerElement;

        this.#innerElement = result;
        this.#innerElement.classList.add(this.sidebarKey);

        if (oldElement) oldElement.replaceWith(this.#innerElement);
        else content.appendChild(this.#innerElement);

        this.#activateListeners(this.#innerElement);
        this._activateListener(this.#innerElement);
    }

    _insertElement(element: HTMLElement) {
        element.dataset.actorUuid = this.#parentHud.actor?.uuid;
    }

    abstract closeIf(option: SidebarCloseOptions): void;

    #activateListeners(html: HTMLElement) {
        addSendItemToChatListeners(this.actor, html, () => this.closeIf("sendToChat"));

        addListenerAll(html, "[data-action='item-description']", (event, el) => {
            PF2eHudPopup.showItemSummary(this.actor, el);
        });
    }
}

interface SidebarHUD<
    TSettings extends Record<string, any> = Record<string, any>,
    TSidebar extends PF2eHudToken | PF2eHudPersistent = PF2eHudToken | PF2eHudPersistent
> {
    get sidebar(): PF2eHudSidebar<TSettings, TSidebar> | null;

    toggleSidebar(sidebar: SidebarName | null): void;
}

type SidebarCloseOptions = "sendToChat" | "castSpell";

type SidebarContext = BaseContext & {
    i18n: SublocalizeI18n;
};

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

export { PF2eHudSidebar, getSidebars };
export type {
    SidebarCloseOptions,
    SidebarContext,
    SidebarElement,
    SidebarHUD,
    SidebarName,
    SidebarRenderOptions,
};
