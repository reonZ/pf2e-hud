import { ApplicationPosition, runWhenReady } from "module-helpers";
import { BaseRenderOptions, BaseSettings, PF2eHudBase } from "./base";

abstract class PF2eHudDirectory<
    TSettings extends BaseSettings = BaseSettings,
    TRenderOptions extends BaseRenderOptions = BaseRenderOptions
> extends PF2eHudBase<TSettings, any, TRenderOptions> {
    get hasFontSize() {
        return false;
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

    protected _updatePosition(position: ApplicationPosition): ApplicationPosition {
        Object.assign(this.element.style, { height: "", width: "100%" });
        return position;
    }
}

export { PF2eHudDirectory };
