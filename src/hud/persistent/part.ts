import { ActorPF2e } from "module-helpers";
import { GlobalSettings } from "../base/base";
import {
    PersistentContext,
    PersistentHudActor,
    PersistentRenderOptions,
    PersistentSettings,
    PF2eHudPersistent,
} from "../persistent";

abstract class PersistentPart<TContext extends PersistentContext> {
    #hud: PF2eHudPersistent;

    constructor(hud: PF2eHudPersistent) {
        this.#hud = hud;
    }

    get hud() {
        return this.#hud;
    }

    get actor() {
        return this.hud.actor;
    }

    get worldActor() {
        return this.hud.worldActor;
    }

    get sidebar() {
        return this.hud.sidebar;
    }

    get tooltipDirection(): "RIGHT" | "UP" | "DOWN" | "LEFT" {
        return "UP";
    }

    get classes(): string[] {
        return [];
    }

    abstract prepareContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<TContext>;

    abstract activateListeners(html: HTMLElement): void;

    async render(
        options?: boolean | Partial<PersistentRenderOptions>,
        _options?: Partial<PersistentRenderOptions>
    ) {
        return this.hud.render(options, _options);
    }

    isCurrentActor(actor: Maybe<ActorPF2e>, flash = false): actor is PersistentHudActor {
        return this.hud.isCurrentActor(actor, flash);
    }

    async setActor(
        actor: ActorPF2e | null,
        options?: { token?: Token; skipSave?: boolean; force?: boolean }
    ) {
        return this.hud.setActor(actor, options);
    }

    getSetting<K extends keyof PersistentSettings>(key: K): PersistentSettings[K];
    getSetting<K extends keyof GlobalSettings>(key: K): GlobalSettings[K];
    getSetting(key: keyof PersistentSettings | keyof GlobalSettings) {
        return this.hud.getSetting(key as keyof PersistentSettings);
    }

    setSetting<K extends keyof PersistentSettings>(key: K, value: PersistentSettings[K]) {
        return this.hud.setSetting(key as keyof PersistentSettings, value);
    }
}

export { PersistentPart };
