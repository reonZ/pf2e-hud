import { runWhenReady } from "module-helpers";
import { BaseRenderOptions, BaseSettings, PF2eHudBase } from "./base";

abstract class PF2eHudDirectory<
    TSettings extends BaseSettings = BaseSettings,
    TRenderOptions extends BaseRenderOptions = BaseRenderOptions
> extends PF2eHudBase<TSettings, any, TRenderOptions> {
    getSettings() {
        const parentSettings = super.getSettings();
        const fontSizeSetting = parentSettings.find((setting) => setting.key === "fontSize");

        if (fontSizeSetting) {
            fontSizeSetting.hide = true;
        }

        return parentSettings;
    }

    _onEnable(enabled = this.enabled) {
        if (enabled && !this.rendered) {
            runWhenReady(() => {
                if (ui.chat.rendered) {
                    this.render(true);
                } else {
                    Hooks.once("renderChatLog", () => {
                        this.render(true);
                    });
                }
            });
        } else if (!enabled && this.rendered) {
            this.close();
        }
    }
}

export { PF2eHudDirectory };
