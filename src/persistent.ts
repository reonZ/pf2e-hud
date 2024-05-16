import { BaseHUD } from "./hud";

class PersistentHUD extends BaseHUD<PersistentSettings> {
    #actor: ActorPF2e | null = null;

    static DEFAULT_OPTIONS: Partial<ApplicationConfiguration> = {
        id: "pf2e-hud.persistent",
    };

    get templates(): ["main"] {
        return ["main"];
    }

    get key(): "persistent" {
        return "persistent";
    }

    get enabled(): boolean {
        return false;
    }

    get settings(): SettingOptions<string>[] {
        return [
            {
                key: "enabled",
                type: Boolean,
                default: true,
                scope: "client",
            },
        ];
    }

    get actor() {
        return this.#actor;
    }

    async _prepareContext(options: ApplicationRenderOptions) {
        const actor = this.actor;
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
        content.dataset.actorUuid = this.actor?.uuid;
        content.innerHTML = result;
    }

    _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions) {}

    _updatePosition(position: ApplicationPosition) {
        return super._updatePosition(position);
    }

    _onEnable(enabled: boolean): void {}
}

type PersistentSettings = {};

export { PersistentHUD };
