import {
    ApplicationConfiguration,
    ApplicationRenderContext,
    ApplicationRenderOptions,
} from "module-helpers";
import { BasePF2eHUD, HUDSettingsList } from ".";

class TrackerPF2eHUD extends BasePF2eHUD<TrackerSettings> {
    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-tracker",
    };

    get key(): "tracker" {
        return "tracker";
    }

    get settingsSchema(): HUDSettingsList<TrackerSettings> {
        return [];
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

type TrackerSettings = {};

export { TrackerPF2eHUD };
