import { hud } from "main";
import {
    ActorPF2e,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    CharacterPF2e,
    executeWhenReady,
    htmlQuery,
    localize,
    NPCPF2e,
    R,
    render,
    TokenPF2e,
    warning,
} from "module-helpers";
import {
    AdvancedHudContext,
    BaseActorPF2eHUD,
    HUDSettingsList,
    IAdvancedPF2eHUD,
    makeAdvancedHUD,
    ReturnedAdvancedHudContext,
    SidebarCoords,
} from ".";

const SELECTION_MODES = ["disabled", "manual", "select", "combat"] as const;

class PersistentPF2eHUD
    extends makeAdvancedHUD(BaseActorPF2eHUD<PersistentSettings, PersistentHudActor>)
    implements IAdvancedPF2eHUD
{
    #actor: ActorPF2e | null = null;

    static DEFAULT_OPTIONS: DeepPartial<ApplicationConfiguration> = {
        id: "pf2e-hud-persistent",
        window: {
            positioned: false,
        },
    };

    get key(): "persistent" {
        return "persistent";
    }

    get settingsSchema(): HUDSettingsList<PersistentSettings> {
        return [
            {
                key: "mode",
                type: String,
                default: "manual",
                scope: "user",
                choices: SELECTION_MODES,
                onChange: () => {
                    this.configurate();
                },
            },
            {
                key: "savedActor",
                type: String,
                default: "",
                scope: "user",
                config: false,
                onChange: () => {
                    this.render();
                },
            },
            {
                key: "cleanPortrait",
                type: Boolean,
                default: false,
                scope: "user",
                config: false,
                onChange: (value) => {
                    if (this.rendered) {
                        this.element.classList.toggle("cleaned", value);
                    }
                },
            },
        ];
    }

    get actor(): PersistentHudActor | null {
        return this.#actor as PersistentHudActor | null;
    }

    get savedActor(): PersistentHudActor | null {
        const uuid = this.settings.savedActor;
        const actor = fromUuidSync<PersistentHudActor>(uuid);
        return actor instanceof Actor && this.isValidActor(actor) ? actor : null;
    }

    get sidebarCoords(): SidebarCoords {
        const element = this.element;
        const sidebars = htmlQuery(element, `[data-panel="sidebars"]`);
        const bounds = (sidebars ?? element).getBoundingClientRect();

        return {
            origin: {
                x: bounds.x + bounds.width / 2,
                y: bounds.y,
            },
            limits: {
                left: 0,
                right: window.innerWidth,
                top: 0,
                bottom: bounds.top,
            },
        };
    }

    get sidebarCeption(): boolean {
        return false;
    }

    protected _configurate(): void {
        const mode = this.settings.mode;

        executeWhenReady(() => {
            if (mode !== "disabled") {
                this.render(true);
            } else {
                this.close({ force: true });
            }
        });
    }

    init() {
        this._configurate();
    }

    isValidActor(actor: Maybe<ActorPF2e>): actor is ActorPF2e {
        return super.isValidActor(actor) && actor.isOfType("character", "npc") && actor.isOwner;
    }

    isCurrentActor(actor: Maybe<ActorPF2e>, flash?: boolean): actor is PersistentHudActor {
        const isCurrentActor = super.isCurrentActor(actor);
        // if (isCurrentActor && flash){ this.flash();}
        return isCurrentActor;
    }

    render(
        options?: boolean | DeepPartial<ApplicationRenderOptions>,
        _options?: DeepPartial<ApplicationRenderOptions>
    ): Promise<this> {
        this._cleanupActor();
        this.#actor = this.settings.mode === "manual" ? this.savedActor : null;

        if (this.#actor) {
            this.#actor.apps[this.id] = this;

            if (this.#actor.token) {
                this.#actor.token.baseActor.apps[this.id] = this;
            }
        }

        return super.render(options, _options);
    }

    async close(options?: PersistentCloseOptions): Promise<this> {
        if (!options?.force) {
            return this;
        }

        const hotbar = document.getElementById("hotbar");

        if (hotbar) {
            document.getElementById("ui-bottom")?.prepend(hotbar);
        }

        return super.close(options);
    }

    setActor(actor: ActorPF2e | null, { token }: SetActorOptions = {}) {
        if (this.settings.mode !== "manual") return;

        if (!this.isValidActor(actor)) {
            actor = null;
        }

        if (actor) {
            const tokens = token ? [token] : actor.getActiveTokens();

            for (const token of tokens) {
                if (hud.token.token === token) {
                    hud.token.close();
                }

                if (hud.tooltip.token === token) {
                    hud.tooltip.close();
                }
            }
        }

        this.settings.savedActor = actor?.uuid ?? "";
    }

    setSelectedToken(event: PointerEvent) {
        if (event.button === 2) {
            return this.setActor(null);
        }

        const tokens = canvas.tokens.controlled;
        const token = tokens[0];

        if (tokens.length !== 1 || !this.isValidActor(token.actor)) {
            return warning("persistent.error.selectOne");
        }

        this.setActor(token.actor, { token });
    }

    async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<PersistentContext | PersistentContextBase> {
        const actor = this.actor!;
        const context = (await super._prepareContext(options)) as ReturnedAdvancedHudContext;
        const setActor = getSetActorData(this);

        if (!context.hasActor) {
            return {
                ...context,
                setActor,
            };
        }

        return {
            ...context,
            ac: actor.attributes.ac.value,
            avatar: actor.img,
            setActor,
        };
    }

    protected async _renderHTML(
        context: PersistentContext | {},
        options: ApplicationRenderOptions
    ): Promise<string> {
        const actor = this.actor;
        const persistent = await render("persistent", context);

        const actorHud = actor
            ? await render("actor-hud", { ...context, i18n: "actor-hud" })
            : R.pipe(
                  ["alliance", "details", "info", "resources", "sidebars", "statistics"],
                  R.map((x) => `<div data-panel="${x}"></div>`),
                  R.join("")
              );

        const character = !actor || actor.isOfType("character") ? "character" : "";
        const slots = R.times(18, () => `<div class="shortcut empty"></div>`).join("");
        const shortcuts = `<div data-panel="shortcuts" class="${character}">${slots}</div>`;

        return persistent + actorHud + shortcuts;
    }

    _replaceHTML(result: string, content: HTMLElement, options: ApplicationRenderOptions): void {
        const hotbar = document.getElementById("hotbar");

        content.innerHTML = result;
        content.classList.toggle("cleaned", this.settings.cleanPortrait);
        content.classList.toggle("locked", ui.hotbar.locked);
        content.classList.toggle("muted", game.audio.globalMute);

        if (hotbar) {
            content.appendChild(hotbar);
        }

        super._replaceHTML(result, content, options);
    }

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        document.getElementById("ui-bottom")?.appendChild(this.element);
    }

    protected _cleanupActor(): void {
        super._cleanupActor();
        this.#actor = null;
    }

    protected _onClickAction(event: PointerEvent, target: HTMLElement): void {
        super._onClickAction(event, target);

        const action = target.dataset.action as EventAction;

        if (action === "set-actor") {
            this.setSelectedToken(event);
        }

        if (event.button !== 0) return;

        if (action === "clear-hotbar") {
            clearHotbar();
        } else if (action === "mute-sound") {
            toggleFoundryBtn("hotbar-controls-left", "mute");
            this.element.classList.toggle("muted", game.audio.globalMute);
        } else if (action === "open-sheet") {
            this.actor?.sheet.render(true);
        } else if (action === "toggle-clean") {
            this.settings.cleanPortrait = !this.settings.cleanPortrait;
        } else if (action === "toggle-hotbar-lock") {
            toggleFoundryBtn("hotbar-controls-right", "lock");
            this.element.classList.toggle("locked", ui.hotbar.locked);
        }
    }
}

async function clearHotbar() {
    const proceed = await foundry.applications.api.DialogV2.confirm({
        window: {
            title: "HOTBAR.CLEAR",
            icon: "fa-solid fa-trash",
        },
        content: game.i18n.localize("HOTBAR.CLEAR_CONFIRM"),
        modal: true,
    });

    if (proceed) {
        await game.user.update({ hotbar: {} }, { recursive: false, diff: false, noHook: true });
    }
}

function toggleFoundryBtn(id: string, action: string) {
    document.querySelector<HTMLButtonElement>(`#${id} [data-action="${action}"]`)?.click();
}

function getSetActorData(hud: PersistentPF2eHUD): PersistentContextBase["setActor"] {
    if (hud.settings.mode !== "manual") return;

    const hasSavedActor = !!hud.savedActor;
    const setTxt = localize("persistent.menu.setActor.set");

    const tooltip = hasSavedActor
        ? `<div>${localize("leftClick")} ${setTxt}</div>
        <div>${localize("rightClick")} ${localize("persistent.menu.setActor.unset")}</div>`
        : `<div>${setTxt}</div>`;

    return {
        tooltip,
        disabled: !hasSavedActor,
    };
}

type EventAction =
    | "clear-hotbar"
    | "mute-sound"
    | "open-sheet"
    | "set-actor"
    | "toggle-clean"
    | "toggle-hotbar-lock";

type SetActorOptions = { token?: TokenPF2e };

type PersistentHudActor = CharacterPF2e | NPCPF2e;

type PersistentSettings = {
    cleanPortrait: boolean;
    mode: (typeof SELECTION_MODES)[number];
    savedActor: string;
};

type PersistentContext = AdvancedHudContext &
    PersistentContextBase & {
        ac: number;
        avatar: ImageFilePath;
        cleaned: boolean;
    };

type PersistentContextBase = {
    setActor: { tooltip: string; disabled: boolean } | undefined;
};

type PersistentCloseOptions = ApplicationClosingOptions & {
    force?: boolean;
};

export { PersistentPF2eHUD };
