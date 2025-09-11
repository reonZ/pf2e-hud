import { BasePF2eHUD } from ".";

abstract class FakePF2eHUD<
    TSettings extends Record<string, any> = Record<string, any>
> extends BasePF2eHUD<TSettings> {
    async _renderHTML(): Promise<unknown> {
        return null;
    }

    protected _replaceHTML(): void {}
}

export { FakePF2eHUD };
