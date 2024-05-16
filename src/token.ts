import { createWrapper } from "pf2e-api";
import { BaseTokenHUD } from "./hud";

const SIDEBARS = ["actions", "equipment", "spells", "skills", "extras"] as const;
const SETTING_ENABLED = ["never", "owned", "observed"] as const;

class TokenHUD extends BaseTokenHUD<TokenSettings> {
    // #tokenClickWrapper = createWrapper("CONFIG.Token.objectClass.prototype._onClickLeft",
    //     this.#tokenClickLeft
    // )

    #sidebarName: SidebarType | null = null;
    #sidebar: HTMLElement | null = null;
    #main: HTMLElement | null = null;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud.token",
    };

    get templates(): ["main"] {
        return ["main"];
    }

    get key(): "token" {
        return "token";
    }

    get enabled() {
        return false;
        // return this.setting("enabled") !== "never";
    }

    get mainElement() {
        return this.#main;
    }

    get sidebarElement() {
        return this.#sidebar;
    }

    get settings(): SettingOptions[] {
        return [
            {
                key: "enabled",
                type: String,
                choices: SETTING_ENABLED,
                default: "owned",
                scope: "client",
            },
        ];
    }

    async _prepareContext(options: ApplicationRenderOptions) {
        const token = this.token;
        const actor = token?.actor;
        if (!actor) return {};

        return {};
    }

    async _renderHTML(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<string> {
        return await this.renderTemplate("main", context);
    }

    _replaceHTML(result: string, content: HTMLElement, options: ApplicationRenderOptions) {
        content.dataset.tokenUuid = this.token?.document.uuid;
        content.innerHTML = result;
    }

    _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {}

    _updatePosition(position: ApplicationPosition) {
        return super._updatePosition(position);
    }

    _onEnable(enabled: boolean) {}
}

type SidebarType = (typeof SIDEBARS)[number];

type TokenSettings = {
    enabled: (typeof SETTING_ENABLED)[number];
};

export { TokenHUD };
