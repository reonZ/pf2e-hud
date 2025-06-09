import {
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
    CharacterPF2e,
    NPCPF2e,
} from "module-helpers";
import { BaseActorPF2eHUD, HUDSettingsList } from ".";

class PersistentPF2eHUD extends BaseActorPF2eHUD<PersistentSettings, PersistentHudActor> {
    #actor: PersistentHudActor | null = null;

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-persistent",
    };

    get key(): "persistent" {
        return "persistent";
    }

    get settingsSchema(): HUDSettingsList<PersistentSettings> {
        return [];
    }

    get actor(): PersistentHudActor | null {
        return this.#actor;
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

type PersistentHudActor = CharacterPF2e | NPCPF2e;

type PersistentSettings = {};

export { PersistentPF2eHUD };
