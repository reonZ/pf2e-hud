import { AvatarEditor, AvatarModel, calculateAvatarPosition, loadAvatar } from "avatar-editor";
import { hud } from "main";
import {
    ActorPF2e,
    addListener,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    CharacterPF2e,
    createHook,
    createToggleKeybind,
    executeWhenReady,
    getDataFlag,
    htmlQuery,
    localize,
    NPCPF2e,
    R,
    render,
    TokenPF2e,
    warning,
} from "module-helpers";
import { PersistentEffectsPF2eHUD, PersistentShortcutsPF2eHUD } from ".";
import {
    AdvancedHudContext,
    BaseActorPF2eHUD,
    HUDSettingsList,
    IAdvancedPF2eHUD,
    makeAdvancedHUD,
    ReturnedAdvancedHudContext,
    SidebarCoords,
} from "..";

const SELECTION_MODES = ["disabled", "manual", "select", "combat"] as const;

class PersistentPF2eHUD
    extends makeAdvancedHUD(BaseActorPF2eHUD<PersistentSettings, PersistentHudActor>)
    implements IAdvancedPF2eHUD
{
    #actor: ActorPF2e | null = null;
    #effectsPanel = new PersistentEffectsPF2eHUD(this);
    #portraitElement: HTMLElement | null = null;
    #shortcutsPanel = new PersistentShortcutsPF2eHUD(this);

    #controlTokenHook = createHook(
        "controlToken",
        foundry.utils.debounce(() => this.render(), 1)
    );

    #setActorKeybind = createToggleKeybind({
        name: "setActor",
        onUp: () => {
            this.#setSelectedToken();
        },
    });

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
                    hud.token.configurate();
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
            {
                key: "showEffects",
                type: Boolean,
                default: true,
                scope: "user",
                config: false,
                onChange: (value) => {
                    this.effectsPanel.refresh();
                },
            },
        ];
    }

    get keybindsSchema(): KeybindingActionConfig[] {
        return [this.#setActorKeybind.configs];
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

    get portraitElement(): HTMLElement | null {
        return (this.#portraitElement ??= htmlQuery(this.element, `[data-panel="portrait"]`));
    }

    get effectsPanel(): PersistentEffectsPF2eHUD {
        return this.#effectsPanel;
    }

    get shortcutsPanel(): PersistentShortcutsPF2eHUD {
        return this.#shortcutsPanel;
    }

    protected _configurate(): void {
        const mode = this.settings.mode;

        executeWhenReady(() => {
            if (mode !== "disabled") {
                this.#controlTokenHook.toggle(mode === "select");
                this.#setActorKeybind.toggle(mode === "manual");

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

        if (isCurrentActor && flash) {
            this.flash();
        }

        return isCurrentActor;
    }

    async render(
        options?: boolean | DeepPartial<ApplicationRenderOptions>,
        _options?: DeepPartial<ApplicationRenderOptions>
    ): Promise<this> {
        const mode = this.settings.mode;
        const usedOptions = typeof options === "object" ? options : _options;

        if (usedOptions?.renderContext === "updateCombat" && mode !== "combat") {
            return this;
        }

        this._cleanupActor();

        const prospectActor =
            mode === "manual"
                ? this.savedActor ?? game.user.character
                : mode === "select"
                ? R.only(canvas.tokens.controlled)?.actor
                : mode === "combat"
                ? game.combat?.combatant?.actor
                : null;

        this.#actor = this.isValidActor(prospectActor) ? prospectActor : null;
        this.#portraitElement = null;

        if (this.#actor) {
            this.#actor.apps[this.id] = this;

            //  TODO is this stil needed?
            // if (this.#actor.token) {
            //     this.#actor.token.baseActor.apps[this.id] = this;
            // }
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

        this.#portraitElement = null;
        this.effectsPanel.close();
        this.shortcutsPanel.close();

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

    flash() {
        const portrait = this.portraitElement;
        const off = { boxShadow: "0 0 0px transparent" };
        const on = {
            boxShadow:
                "0 0 var(--flash-outset-blur) 0px var(--flash-outset-color), inset 0 0 var(--flash-inset-blur) 0px var(--flash-inset-color)",
        };

        portrait?.querySelector(".flash")?.animate([off, on, on, on, off], {
            duration: 200,
            iterations: 2,
        });
    }

    async _prepareContext(
        options: ApplicationRenderOptions
    ): Promise<PersistentContext | PersistentContextBase> {
        const actor = this.actor!;
        const context = (await super._prepareContext(options)) as ReturnedAdvancedHudContext;
        const setActor = getSetActorData(this);
        const noEffects = !this.settings.showEffects;

        if (!context.hasActor) {
            return {
                ...context,
                noEffects,
                setActor,
            };
        }

        return {
            ...context,
            ac: actor.attributes.ac.value,
            avatar: actor.img,
            noEffects,
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
                  ["alliance", "details", "info", "sidebars", "statistics"],
                  R.map((x) => `<div data-panel="${x}"></div>`),
                  R.join("")
              );

        return persistent + actorHud;
    }

    async _replaceHTML(result: string, content: HTMLElement, options: ApplicationRenderOptions) {
        const hotbar = document.getElementById("hotbar");

        content.innerHTML = result;
        content.classList.toggle("cleaned", this.settings.cleanPortrait);
        content.classList.toggle("locked", ui.hotbar.locked);
        content.classList.toggle("muted", game.audio.globalMute);

        if (hotbar) {
            content.appendChild(hotbar);
        }

        super._replaceHTML(result, content, options);

        this.#setupAvatar(content);
        this.effectsPanel.refresh();
        this.shortcutsPanel.render(true);

        this.#activateListeners(content);
    }

    protected _onFirstRender(context: object, options: ApplicationRenderOptions): void {
        document.getElementById("ui-bottom")?.appendChild(this.element);
    }

    protected _cleanupActor(): void {
        super._cleanupActor();
        this.#actor = null;
    }

    get worldActor(): PersistentHudActor | null {
        return (this.actor?.token?.baseActor ?? this.actor) as PersistentHudActor | null;
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
        } else if (action === "edit-avatar") {
            const worldActor = this.worldActor;

            if (worldActor) {
                new AvatarEditor(worldActor).render(true);
            }
        } else if (action === "mute-sound") {
            toggleFoundryBtn("hotbar-controls-left", "mute");
            this.element.classList.toggle("muted", game.audio.globalMute);
        } else if (action === "open-sheet") {
            this.actor?.sheet.render(true);
        } else if (action === "toggle-effects") {
            this.settings.showEffects = !this.settings.showEffects;
        } else if (action === "toggle-clean") {
            this.settings.cleanPortrait = !this.settings.cleanPortrait;
        } else if (action === "toggle-hotbar-lock") {
            toggleFoundryBtn("hotbar-controls-right", "lock");
            this.element.classList.toggle("locked", ui.hotbar.locked);
        }
    }

    #setSelectedToken() {
        const token = R.only(canvas.tokens.controlled);

        if (!token || !this.isValidActor(token.actor)) {
            return warning("persistent.error.selectOne");
        }

        this.setActor(token.actor, { token });
    }

    async #setupAvatar(html: HTMLElement) {
        const worldActor = this.worldActor;
        const avatarElement = htmlQuery(html, ".avatar");
        if (!avatarElement || !worldActor) return;

        const avatarData = getDataFlag(worldActor, AvatarModel, "avatar", { strict: true });
        if (!avatarData) {
            avatarElement.innerHTML = "";
            avatarElement.style.setProperty("background-image", `url("${worldActor.img}")`);
            avatarElement.style.removeProperty("background-color");
            return;
        }

        const image = await loadAvatar(avatarElement, avatarData);

        avatarElement.style.removeProperty("background-image");
        calculateAvatarPosition(avatarData, image);

        if (avatarData.color.enabled) {
            avatarElement.style.setProperty("background-color", avatarData.color.value);
        } else {
            avatarElement.style.removeProperty("background-color");
        }
    }

    #activateListeners(html: HTMLElement) {
        const actor = this.actor;
        if (!actor) return;

        addListener(html, ".avatar", "drop", (el, event) => {
            actor.sheet._onDrop(event);
        });
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
    | "edit-avatar"
    | "mute-sound"
    | "open-sheet"
    | "set-actor"
    | "toggle-clean"
    | "toggle-effects"
    | "toggle-hotbar-lock";

type SetActorOptions = { token?: TokenPF2e };

type PersistentHudActor = CharacterPF2e | NPCPF2e;

type PersistentSettings = {
    cleanPortrait: boolean;
    mode: (typeof SELECTION_MODES)[number];
    savedActor: string;
    showEffects: boolean;
};

type PersistentContext = AdvancedHudContext &
    PersistentContextBase & {
        ac: number;
        avatar: ImageFilePath;
        cleaned: boolean;
    };

type PersistentContextBase = {
    noEffects: boolean;
    setActor: { tooltip: string; disabled: boolean } | undefined;
};

type PersistentCloseOptions = ApplicationClosingOptions & {
    force?: boolean;
};

export { PersistentPF2eHUD };
