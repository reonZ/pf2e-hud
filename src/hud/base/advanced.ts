import { addListenerAll, settingPath, templatePath } from "foundry-pf2e";
import { PF2eHudSidebarActions } from "../sidebar/actions";
import { PF2eHudSidebar, SidebarEvent, SidebarName } from "../sidebar/base";
import { PF2eHudSidebarExtras } from "../sidebar/extras";
import { PF2eHudSidebarItems } from "../sidebar/items";
import { PF2eHudSidebarSkills } from "../sidebar/skills";
import { PF2eHudSidebarSpells } from "../sidebar/spells";
import { BaseActorContext, BaseActorRenderOptions, PF2eHudBaseActor } from "./actor";
import { hud } from "../../main";

const CLOSE_SETTINGS = ["closeOnSendToChat", "closeOnSpell"] as const;

function makeAdvancedHUD<C extends abstract new (...args: any[]) => {}>(constructor: C) {
    abstract class PF2eHudAdvanced extends constructor {
        #sidebar: PF2eHudSidebar | null = null;

        abstract get sidebars(): HTMLElement | null;
        abstract get anchor(): AdvancedHudAnchor;

        get partials(): string[] {
            return [
                "action_blast-row",
                "stats_header",
                "stats_statistics",
                "stats_infos",
                "stats_speed",
                "stats_level",
                "stats_extras",
                "numbers",
                "slider",
                "sidebars",
            ];
        }

        get SETTINGS() {
            const thisSuper = constructor.prototype as PF2eHudBaseActor;
            return thisSuper.SETTINGS.concat([
                {
                    key: "sidebarFontSize",
                    type: Number,
                    range: {
                        min: 10,
                        max: 30,
                        step: 1,
                    },
                    default: 14,
                    scope: "client",
                    name: settingPath("shared.sidebarFontSize.name"),
                    hint: settingPath("shared.sidebarFontSize.hint"),
                    onChange: () => {
                        this.sidebar?.render();
                    },
                },
                {
                    key: "sidebarHeight",
                    type: Number,
                    range: {
                        min: 50,
                        max: 100,
                        step: 1,
                    },
                    default: 100,
                    scope: "client",
                    name: settingPath("shared.sidebarHeight.name"),
                    hint: settingPath("shared.sidebarHeight.hint"),
                    onChange: () => {
                        this.sidebar?.render();
                    },
                },
                {
                    key: "multiColumns",
                    type: Number,
                    default: 3,
                    scope: "client",
                    range: {
                        min: 1,
                        max: 5,
                        step: 1,
                    },
                    name: settingPath("shared.multiColumns.name"),
                    hint: settingPath("shared.multiColumns.hint"),
                    onChange: () => {
                        this.sidebar?.render();
                    },
                },
            ]);
        }

        get sidebar() {
            return this.#sidebar;
        }

        async _preFirstRender(
            context: ApplicationRenderContext,
            options: ApplicationRenderOptions
        ): Promise<void> {
            const thisSuper = constructor.prototype as PF2eHudBaseActor;
            thisSuper._preFirstRender.call(this, context, options);

            const templates: Set<string> = new Set();

            for (const partial of this.partials) {
                const path = templatePath("partials", partial);
                templates.add(path);
            }

            await loadTemplates(Array.from(templates));
        }

        async _prepareContext(options: BaseActorRenderOptions): Promise<AdvancedContext> {
            const thisSuper = constructor.prototype as PF2eHudBaseActor;
            const context = (await thisSuper._prepareContext.call(
                this,
                options
            )) as AdvancedContext;
            context.partial = (key: string) => templatePath("partials", key);
            return context;
        }

        _onClose(this: PF2eHudAdvanced & PF2eHudBaseActor, options: ApplicationClosingOptions) {
            this.closeSidebar();
            const thisSuper = constructor.prototype as PF2eHudBaseActor;
            thisSuper._onClose.call(this, options);
        }

        abstract closeIf(event: AdvancedHudEvent): boolean;

        eventToSetting(event: AdvancedHudEvent): CloseSetting {
            switch (event) {
                case "cast-spell":
                    return "closeOnSpell";
                case "send-to-chat":
                    return "closeOnSendToChat";
            }
        }

        closeSidebar(this: PF2eHudAdvanced & PF2eHudBaseActor) {
            this.#sidebar?.close();
            this.#sidebar = null;

            const sidebarElements = this.sidebars?.querySelectorAll<HTMLElement>("[data-sidebar]");
            for (const sidebarElement of sidebarElements ?? []) {
                sidebarElement.classList.remove("active");
            }
        }

        toggleSidebar(this: PF2eHudAdvanced & PF2eHudBaseActor, sidebar: SidebarName | null) {
            if (this.#sidebar?.key === sidebar) sidebar = null;

            const otherHUD = this.key === "token" ? hud.persistent : hud.token;
            otherHUD.closeSidebar();
            otherHUD.close();

            this.closeSidebar();

            if (!sidebar) return;

            switch (sidebar) {
                case "actions":
                    this.#sidebar = new PF2eHudSidebarActions(this);
                    break;
                case "extras":
                    this.#sidebar = new PF2eHudSidebarExtras(this);
                    break;
                case "items":
                    this.#sidebar = new PF2eHudSidebarItems(this);
                    break;
                case "skills":
                    this.#sidebar = new PF2eHudSidebarSkills(this);
                    break;
                case "spells":
                    this.#sidebar = new PF2eHudSidebarSpells(this);
                    break;
            }

            this.#sidebar.render(true);
        }
    }

    return PF2eHudAdvanced as C & (abstract new (...args: any[]) => IPF2eHudAdvanced);
}

function addSidebarsListeners(hud: IPF2eHudAdvanced, html: HTMLElement) {
    addListenerAll(html, "[data-action='open-sidebar']:not(.disabled)", (event, el) => {
        const sidebar = el.dataset.sidebar as SidebarName;
        const wasActive = el.classList.contains("active");

        hud.toggleSidebar(sidebar);

        const sidebarElements = (el.parentElement as HTMLElement).querySelectorAll<HTMLElement>(
            "[data-sidebar]"
        );

        for (const sidebarElement of sidebarElements) {
            sidebarElement.classList.toggle(
                "active",
                sidebarElement.dataset.sidebar === sidebar && !wasActive
            );
        }
    });
}

type AdvancedHudAnchor = Point & {
    limits?: {
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
    };
};

type CloseSetting = (typeof CLOSE_SETTINGS)[number];

type AdvancedHudEvent = SidebarEvent | "send-to-chat";

type AdvancedContext<TActor extends ActorPF2e = ActorPF2e> = BaseActorContext<TActor> & {
    partial: (template: string) => string;
};

interface IPF2eHudAdvanced {
    get partials(): string[];
    get sidebar(): PF2eHudSidebar | null;
    get anchor(): AdvancedHudAnchor;
    get sidebars(): HTMLElement | null;

    _renderSidebarHTML?(innerElement: HTMLElement, sidebar: SidebarName): Promise<void>;
    _onRenderSidebar?(innerElement: HTMLElement): void;
    _updateSidebarPosition?(
        element: HTMLElement,
        center: Point,
        limits: { right: number; bottom: number }
    ): void;

    closeSidebar(): void;
    closeIf(event: AdvancedHudEvent): boolean;
    toggleSidebar(sidebar: SidebarName | null): void;
    eventToSetting(event: AdvancedHudEvent): CloseSetting;
}

export { CLOSE_SETTINGS, addSidebarsListeners, makeAdvancedHUD };
export type { AdvancedHudAnchor, AdvancedHudEvent, CloseSetting, IPF2eHudAdvanced };
