import {
    ActorInstances,
    ActorType,
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    LootPF2e,
    PartyPF2e,
    TokenDocumentPF2e,
    TokenPF2e,
} from "module-helpers";
import { BaseTokenPF2eHUD, HUDSettingsList } from ".";

class TokenPF2eHUD extends BaseTokenPF2eHUD<TokenSettings, TokenHudActor> {
    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-token",
    };

    get key(): "token" {
        return "token";
    }

    get settingsSchema(): HUDSettingsList<TokenSettings> {
        return [];
    }

    protected _onSetToken(token: TokenPF2e | null): void {
        throw new Error("Method not implemented.");
    }

    protected _renderHTML(
        context: ApplicationRenderContext,
        options: ApplicationRenderOptions
    ): Promise<unknown> {
        throw new Error("Method not implemented.");
    }

    protected _replaceHTML(
        result: unknown,
        content: HTMLElement,
        options: ApplicationRenderOptions
    ): void {
        throw new Error("Method not implemented.");
    }
}

type TokenHudActor = Exclude<ActorInstances<TokenDocumentPF2e>[ActorType], LootPF2e | PartyPF2e>;

type TokenSettings = {};

export { TokenPF2eHUD };
