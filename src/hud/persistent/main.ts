import { randomPick, rollGroupPerception } from "actions";
import { AvatarEditor, AvatarModel, calculateAvatarPosition } from "avatar-editor";
import { hud } from "main";
import {
    ActorPF2e,
    addListener,
    ApplicationClosingOptions,
    ApplicationConfiguration,
    ApplicationRenderOptions,
    CharacterPF2e,
    CombatantPF2e,
    confirmDialog,
    CreateFormGroupParams,
    createHook,
    createToggleKeybind,
    CreaturePF2e,
    EncounterPF2e,
    getDataFlag,
    getFirstActiveToken,
    getFlag,
    htmlClosest,
    htmlQuery,
    localize,
    NPCPF2e,
    panToToken,
    PARTY_ACTOR_ID,
    pingToken,
    R,
    render,
    selectTokens,
    success,
    toggleHooksAndWrappers,
    TokenDocumentPF2e,
    TokenPF2e,
    updateFlag,
    waitDialog,
    warning,
} from "module-helpers";
import { PersistentEffectsPF2eHUD, PersistentShortcutsPF2eHUD, ShortcutData } from ".";
import {
    AdvancedStatistic,
    BaseActorPF2eHUD,
    calculateActorHealth,
    createDraggable,
    createSlider,
    getAdvancedStatistics,
    getAllSpeeds,
    HealthData,
    HUDSettingsList,
    HudSpeed,
    IAdvancedPF2eHUD,
    makeAdvancedHUD,
    ReturnedAdvancedHudContext,
    SidebarCoords,
    SliderData,
} from "..";
import fields = foundry.data.fields;

const ENABLED_MODES = ["disabled", "left", "middle"] as const;
const SELECTION_MODES = ["manual", "select", "combat"] as const;

const GM_SCREEN_UUID = "Compendium.pf2e.journals.JournalEntry.S55aqwWIzpQRFhcq";

class PersistentPF2eHUD
    extends makeAdvancedHUD(BaseActorPF2eHUD<PersistentSettings, PersistentHudActor>)
    implements IAdvancedPF2eHUD
{
    static #nbOwnedActors = 8;

    #actor: ActorPF2e | null = null;
    #controlled: ActorPF2e | null | undefined;
    #effectsPanel = new PersistentEffectsPF2eHUD(this);
    #isPinning: boolean = false;
    #ownedActors: string[] | null = null;
    #portraitElement: HTMLElement | null = null;
    #previousActor: ActorPF2e | null = null;
    #previousAvatar: HTMLImageElement | HTMLVideoElement | null = null;
    #shortcutsPanel = new PersistentShortcutsPF2eHUD(this);
    #shortcutsTab: ValueAndMinMax = {
        value: 1,
        min: 1,
        max: 3,
    };

    #deleteActorHook = createHook("deleteActor", (actor: ActorPF2e) => {
        if (this.isCurrentActor(actor) || this.#ownedActors?.includes(actor.id)) {
            this.render();
        }
    });

    #updateActorHook = createHook("updateActor", this.#onUpdateActor.bind(this));

    #deleteTokenHook = createHook("deleteToken", (token: TokenDocumentPF2e) => {
        const actor = token.actor;

        if (actor?.token) {
            const favorites = this.settings.favorites;
            const index = favorites.indexOf(actor.uuid);

            if (index !== -1) {
                favorites.splice(index, 1);
                this.settings.favorites = favorites;
                return;
            }
        }

        if (!token.isLinked && this.isCurrentActor(actor)) {
            this.render();
        }
    });

    #controlTokenHook = createHook(
        "controlToken",
        foundry.utils.debounce((token: TokenPF2e, controlled: boolean) => {
            if (!controlled) {
                this.#previousActor = null;
            }
            this.render();
        }, 1)
    );

    #combatHooks = [
        createHook("combatStart", (combat: EncounterPF2e) => {
            const hook = combat.combatants.size ? "updateCombat" : "createCombatant";
            Hooks.once(hook, () => {
                this.render();
            });
        }),
        createHook("deleteCombat", (combat: EncounterPF2e) => {
            this.render();
        }),
        createHook("deleteCombatant", (combatant: CombatantPF2e) => {
            if (combatant.encounter?.combatants.size === 0) {
                Hooks.once("combatTurnChange", (combat: EncounterPF2e) => {
                    this.render();
                });

                Hooks.once("createCombatant", () => {
                    this.render();
                });
            }
        }),
    ];

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
                key: "display",
                type: String,
                default: "left",
                scope: "user",
                choices: ENABLED_MODES,
                onChange: () => {
                    this.configurate();
                    hud.token.configurate();
                },
            },
            {
                key: "selection",
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
                key: "autoFill",
                type: Boolean,
                default: true,
                scope: "user",
                onChange: () => {
                    this.shortcutsPanel.render();
                },
            },
            {
                key: "shiftEffect",
                type: Boolean,
                default: true,
                scope: "user",
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
                key: "journal",
                type: String,
                default: "",
                scope: "user",
                config: false,
                onChange: (value: string) => {
                    this.render();
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
            {
                key: "favorites",
                type: new fields.ArrayField(
                    new fields.DocumentUUIDField({
                        blank: false,
                        nullable: false,
                        type: "Actor",
                    })
                ),
                default: [],
                scope: "user",
                config: false,
                onChange: (value: string) => {
                    this.render();
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

    get parentElement(): HTMLElement | null {
        return document.getElementById(
            this.settings.display === "left" ? "ui-left-column-1" : "ui-bottom"
        );
    }

    get shortcutsPanel(): PersistentShortcutsPF2eHUD {
        return this.#shortcutsPanel;
    }

    get shortcutsTab(): ValueAndMinMax {
        return this.#shortcutsTab;
    }

    get worldActor(): PersistentHudActor | null {
        return (this.actor?.token?.baseActor ?? this.actor) as PersistentHudActor | null;
    }

    protected _configurate(): void {
        const enabled = this.settings.display !== "disabled";
        const selection = this.settings.selection;

        this.#deleteActorHook.toggle(enabled);
        this.#deleteTokenHook.toggle(enabled);
        this.#controlTokenHook.toggle(enabled && selection === "select");
        this.#setActorKeybind.toggle(enabled && selection === "manual");

        toggleHooksAndWrappers(this.#combatHooks, enabled && selection === "combat");

        if (game.ready) {
            if (enabled) {
                this.render(true);
            } else {
                this.close({ force: true });
            }
        }
    }

    init() {
        this._configurate();
    }

    ready() {
        if (this.settings.display !== "disabled") {
            this.render(true);
        } else {
            this.close({ force: true });
        }

        if (this.settings.selection === "combat" && game.combat?.combatants.size === 0) {
            Hooks.once("createCombatant", () => {
                this.render();
            });
        }
    }

    isValidActor(actor: Maybe<ActorPF2e>): actor is ActorPF2e {
        return super.isValidActor(actor) && actor.isOfType("character", "npc") && actor.isOwner;
    }

    isValidOwnedActor(actor: Maybe<ActorPF2e>): actor is ActorPF2e {
        return (
            this.isValidActor(actor) &&
            !actor.token &&
            !game.tcal?.isTransientActor(actor) &&
            actor.flags.core?.sheetClass !== "pf2e.SimpleNPCSheet"
        );
    }

    isValidDraggableActor(actor: Maybe<ActorPF2e>): actor is ActorPF2e {
        return actor instanceof Actor && actor.isOwner;
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
        const mode = this.settings.selection;
        const usedOptions = typeof options === "object" ? options : _options;

        if (usedOptions?.renderContext === "updateCombat" && mode !== "combat") {
            return this;
        }

        this._cleanupActor();

        const prospectActor =
            mode === "manual"
                ? this.savedActor
                : mode === "select"
                ? (this.#controlled = R.only(canvas.tokens.controlled)?.actor) ??
                  this.#previousActor
                : mode === "combat"
                ? game.combat?.combatant?.actor
                : null;

        this.#actor = this.isValidActor(prospectActor) ? prospectActor : null;

        this.#portraitElement = null;

        if (this.#actor) {
            this.#actor.apps[this.id] = this;

            if (this.#actor !== this.#previousActor) {
                this.#shortcutsTab.value = 1;
            }
        }

        this.#previousActor = this.#actor;

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

        this.#ownedActors = null;
        this.#previousAvatar = null;
        this.#portraitElement = null;

        this.effectsPanel.close();
        this.shortcutsPanel.close();

        this.#updateActorHook.disable();

        return super.close(options);
    }

    setActor(actor: ActorPF2e | null, { token }: SetActorOptions = {}) {
        if (this.settings.selection !== "manual") return;

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

    setShortcutTab(value: number, skipRender?: boolean) {
        const { value: previous, min, max } = this.shortcutsTab;
        const newValue = (this.shortcutsTab.value = Math.clamp(value, min, max));
        const slider = htmlQuery(this.element, `[data-slider-action="shortcuts-tab"]`);
        const sliderValue = htmlQuery(slider, ".value");

        htmlQuery(slider, ".previous")?.classList.toggle("disabled", newValue <= 1);
        htmlQuery(slider, ".next")?.classList.toggle("disabled", newValue >= max);

        if (sliderValue) {
            sliderValue.innerHTML = String(newValue);
        }

        if (!skipRender && newValue !== previous) {
            this.shortcutsPanel.render({ keepCache: true });
        }
    }

    async updateShortcuts(
        ...args: [...string[], null | Record<string, ShortcutData[]>]
    ): Promise<void>;
    async updateShortcuts(...args: [string, number, null | ShortcutData[]]): Promise<void>;
    async updateShortcuts(...args: any[]) {
        const worldActor = this.worldActor;
        if (!worldActor) return;

        const value = args.at(-1) as null | ShortcutData[];
        const updateKey = ["shortcuts", ...(args.slice(0, -1) as string[])].join(".");

        // we don't want to re-render the entire persistent HUD
        await updateFlag(worldActor, { [updateKey]: value }, { render: false });
        this.shortcutsPanel.render({ keepCache: true });
    }

    async deleteShortcuts(all: boolean) {
        const updateKey = all ? `-=${game.userId}` : `${game.userId}.-=${this.shortcutsTab.value}`;
        return this.updateShortcuts(updateKey, null);
    }

    async overrideShortcuts(shortcuts: Record<string, ShortcutData[]>) {
        return this.updateShortcuts(`==${game.userId}`, shortcuts);
    }

    protected _configureRenderOptions(options: PersistentRenderOptions): void {
        options.selectionMode = this.settings.selection;
    }

    async _prepareContext(
        options: PersistentRenderOptions
    ): Promise<EmptyPersistentContext | PersistentContext | PersistentContextBase> {
        const actor = this.actor!;
        const context = (await super._prepareContext(options)) as ReturnedAdvancedHudContext;
        const noEffects = !this.settings.showEffects;

        const setActor: PersistentContextBase["setActor"] = (() => {
            if (options.selectionMode === "combat") return;

            const isManual = options.selectionMode === "manual";
            const hasSavedActor = isManual && !!this.savedActor;
            const isControlled = !isManual && !!actor && !this.#controlled;
            if (!isManual && !isControlled) return;

            const unsetTxt = localize("persistent.menu.setActor.unset");

            let tooltip = "";

            if (isManual) {
                const setTxt = localize("persistent.menu.setActor.set");
                tooltip += `<div>${localize("leftClick")} ${setTxt}</div>`;

                if (hasSavedActor) {
                    tooltip += `<div>${localize("rightClick")} ${unsetTxt}</div>`;
                }
            } else {
                tooltip += `<div>${unsetTxt}</div>`;
            }

            return {
                disabled: isManual && !hasSavedActor,
                icon: isManual ? "fa-solid fa-user-vneck" : "fa-solid fa-turn-left",
                tooltip,
            };
        })();

        const data: PersistentContextBase = {
            ...context,
            noEffects,
            setActor,
        };

        this.#ownedActors = null;

        if (context.hasActor) {
            const worldActor = this.worldActor!;
            const avatarData = getDataFlag(worldActor, AvatarModel, "avatar", { strict: true });
            const src = avatarData?.src ?? worldActor.img;
            const isVideo = foundry.helpers.media.VideoHelper.hasVideoExtension(src);

            const avatar: PersistentContext["avatar"] = {
                background: avatarData?.color.enabled ? avatarData.color.value : "transparent",
                isVideo,
                src,
            };

            return {
                ...data,
                ac: actor.attributes.ac.value,
                avatar,
                shortcutsTab: createSlider("shortcuts-tab", this.shortcutsTab),
            } satisfies PersistentContext;
        } else if (options.selectionMode !== "combat") {
            const isGM = game.user.isGM;
            const party = game.actors.party;

            const sortLogic: NonEmptyArray<Parameters<typeof R.sortBy<CreaturePF2e[]>>[1]> = [
                (actor) => actor.isOfType("npc"),
            ];

            if (!isGM) {
                if (party) {
                    sortLogic.unshift((actor) => !actor.parties.has(party));
                }

                const assigned = game.user.character as CreaturePF2e | null;
                if (this.isValidOwnedActor(assigned)) {
                    sortLogic.unshift((actor) => actor !== assigned);
                }
            }

            type OwnedActorEntry = { actor: CreaturePF2e; favorite: boolean } | undefined;

            const favoriteUUIDS = this.settings.favorites;
            const favorites: OwnedActorEntry[] = await Promise.all(
                favoriteUUIDS
                    .slice(0, PersistentPF2eHUD.#nbOwnedActors)
                    .map(async (uuid): Promise<OwnedActorEntry> => {
                        const actor = (await fromUuid(uuid)) as Maybe<CreaturePF2e>;
                        if (!this.isValidActor(actor)) return;

                        return { actor, favorite: true };
                    })
            );

            const freeSlots = PersistentPF2eHUD.#nbOwnedActors - favorites.length;

            const allOwned: FilterableIterable<ActorPF2e, CreaturePF2e> =
                freeSlots > 0 ? (isGM ? party?.members ?? [] : game.actors) : [];

            const ownedActors: OwnedActorEntry[] = R.pipe(
                allOwned.filter((actor) => {
                    return !favoriteUUIDS.includes(actor.uuid) && this.isValidOwnedActor(actor);
                }),
                R.sortBy(...sortLogic),
                R.take(freeSlots),
                R.map((actor) => {
                    return { actor, favorite: false };
                })
            );

            const actors = R.pipe(
                [...favorites, ...ownedActors],
                R.filter(R.isTruthy),
                R.map(({ actor, favorite }): OwnedActorContext => {
                    return {
                        ac: actor.attributes.ac.value,
                        favorite,
                        heroPoints: (actor as CharacterPF2e).heroPoints?.value,
                        hp: calculateActorHealth(actor),
                        id: actor.id,
                        img: actor.img,
                        name: actor.name,
                        speed: getAllSpeeds(actor)?.mainSpeed,
                        statistics: getAdvancedStatistics(actor),
                        tokenImage: getTokenImage(actor),
                        uuid: actor.uuid,
                    };
                })
            );

            this.#ownedActors = actors.map(R.prop("id"));

            const journal = isGM && (await fromUuid(this.settings.journal));

            return {
                ...data,
                actors,
                canPin: true,
                identify: isGM && !!game.toolbelt?.getToolSetting("identify", "enabled"),
                isGM,
                journal: journal instanceof JournalEntry ? journal.name : undefined,
                party: party && {
                    id: party.id,
                    name: party.name,
                    img: getTokenImage(party),
                },
            } satisfies EmptyPersistentContext;
        } else {
            return data;
        }
    }

    protected async _renderHTML(
        context: EmptyPersistentContext | PersistentContext,
        options: PersistentRenderOptions
    ): Promise<string> {
        const actor = this.actor;
        const persistent = await render("persistent", context);
        const actorHud = actor
            ? await render("actor-hud", { ...context, i18n: "actor-hud" })
            : options.selectionMode === "combat"
            ? R.pipe(
                  ["alliance", "details", "info", "npc-extras", "sidebars", "statistics"],
                  R.map((x) => `<div data-panel="${x}"></div>`),
                  R.join("")
              )
            : "";

        return persistent + actorHud;
    }

    async _replaceHTML(result: string, content: HTMLElement, options: PersistentRenderOptions) {
        const hotbar = document.getElementById("hotbar");

        content.innerHTML = result;
        content.classList.toggle("cleaned", this.settings.cleanPortrait);
        content.classList.toggle("locked", ui.hotbar.locked);
        content.classList.toggle("muted", game.audio.globalMute);

        if (hotbar) {
            content.appendChild(hotbar);
        }

        super._replaceHTML(result, content, options);
        this.parentElement?.appendChild(content);

        this.#setupAvatar(content);
        this.effectsPanel.refresh();

        if (this.actor || options.selectionMode === "combat") {
            this.shortcutsPanel.render(true);
        }

        this.#activateListeners(content);
    }

    protected _cleanupActor(): void {
        super._cleanupActor();

        this.#controlled = null;
        this.#actor = null;
    }

    protected async _onClickAction(event: PointerEvent, target: HTMLElement) {
        super._onClickAction(event, target);

        const action = target.dataset.action as EventAction;

        switch (action) {
            case "journal-sheet": {
                if (event.button === 0) {
                    const journal = await fromUuid(this.settings.journal);
                    return journal?.sheet.render(true);
                } else {
                    return (this.settings.journal = "");
                }
            }

            case "open-sheet": {
                if (event.button === 0) {
                    return this.actor?.sheet.render(true);
                } else {
                    const actor = this.actor;
                    return actor && this.#panToActiveToken(actor);
                }
            }

            case "party-sheet": {
                const party = game.actors.party;
                if (!party) return;

                if (event.button === 0) {
                    return party.sheet.render(true);
                } else {
                    return this.#panToActiveToken(party, true);
                }
            }

            case "set-actor": {
                if (this.settings.selection === "manual") {
                    return this.setSelectedToken(event);
                } else {
                    this.#previousActor = null;
                    return this.render();
                }
            }

            case "select-owned-actor":
                return this.#setOwnedActor(event, target);
        }

        if (event.button !== 0) return;

        switch (action) {
            case "browser":
                return game.pf2e.compendiumBrowser.render(true);
            case "check-prompt":
                return game.pf2e.gm.checkPrompt();
            case "clear-hotbar":
                return clearHotbar();
            case "clear-shortcuts":
                return this.#clearShortcuts();
            case "copy-shortcuts":
                return this.#copyShortcuts();
            case "edit-avatar":
                const worldActor = this.worldActor;
                return worldActor && new AvatarEditor(worldActor).render(true);
            case "fill-shortcuts": {
                if (await confirmDialog("persistent.shortcuts.fill")) {
                    const shortcutsData = await this.shortcutsPanel.generateFillShortcuts();
                    this.overrideShortcuts({ "1": shortcutsData });
                }
                return;
            }
            case "gm-screen": {
                const journal = await fromUuid(GM_SCREEN_UUID);
                return journal?.sheet.render(true);
            }
            case "group-perception":
                return rollGroupPerception();
            case "identify-menu":
                return game.toolbelt?.api.identify.openTracker();
            case "mute-sound": {
                toggleFoundryBtn("hotbar-controls-left", "mute");
                return this.element.classList.toggle("muted", game.audio.globalMute);
            }
            case "pin-token":
                return this.#pinToken();
            case "random-pick":
                return randomPick();
            case "select-all": {
                const scene = canvas.scene;
                const tokens = scene?.tokens.filter((token) => !!token.actor?.hasPlayerOwner);
                return selectTokens(tokens ?? []);
            }
            case "set-journal":
                return this.#setJournal();
            case "toggle-clean":
                return (this.settings.cleanPortrait = !this.settings.cleanPortrait);
            case "toggle-effects":
                return (this.settings.showEffects = !this.settings.showEffects);
            case "toggle-hotbar-lock": {
                toggleFoundryBtn("hotbar-controls-right", "lock");
                return this.element.classList.toggle("locked", ui.hotbar.locked);
            }
            case "travel-sheet":
                return this.#launchTravelSheet();
            case "unpin-owned-actor":
                return this.#unpinOwnedActor(event);
        }
    }

    _onSlider(action: "shortcuts-tab", direction: 1 | -1): void {
        if (action === "shortcuts-tab") {
            this.setShortcutTab(this.shortcutsTab.value + direction);
        }
    }

    #unpinOwnedActor(event: PointerEvent) {
        const uuid = htmlClosest(event.target, "[data-actor-uuid")?.dataset.actorUuid;

        if (uuid) {
            const favorites = this.settings.favorites;
            const index = favorites.indexOf(uuid as ActorUUID);

            if (index !== -1) {
                favorites.splice(index, 1);
                this.settings.favorites = favorites;
            }
        }
    }

    async #pinToken() {
        canvas.tokens.releaseAll();

        const notified = success("pin-token.notify", true);

        this.#isPinning = true;

        const hook = Hooks.once("controlToken", (token: TokenPF2e) => {
            this.#addToFavorites(token.actor);
        });

        requestAnimationFrame(() => {
            window.addEventListener(
                "click",
                () => {
                    ui.notifications.remove(notified.id);
                    Hooks.off("controlToken", hook);
                    this.#isPinning = false;
                },
                { once: true }
            );
        });
    }

    #addToFavorites(actor: Maybe<ActorPF2e>) {
        if (!actor) return;

        const uuid = actor.uuid;
        const favorites = this.settings.favorites;

        favorites.findSplice((x) => x === uuid);

        if (this.isValidActor(actor)) {
            favorites.unshift(uuid);
        }

        this.settings.favorites = favorites.slice(0, PersistentPF2eHUD.#nbOwnedActors);
    }

    async #setJournal() {
        const worlds = game.journal.map((journal) => {
            return { value: journal.uuid, label: journal.name };
        });

        const content: CreateFormGroupParams[] = [
            {
                type: "text",
                inputConfig: { name: "uuid" },
            },
        ];

        if (worlds.length) {
            content.unshift({
                type: "select",
                inputConfig: {
                    name: "world",
                    options: [{ value: "", label: "" }, ...worlds],
                },
            });
        }

        const result = await waitDialog<{ uuid: DocumentUUID }>({
            content,
            i18n: "set-journal",
            title: localize("persistent.patch.set-journal"),
            yes: {
                icon: "fa-solid fa-book-open",
            },
            onRender: (event, dialog) => {
                const html = dialog.element;
                const select = htmlQuery(html, "select");
                const input = htmlQuery(html, "input");
                if (!input || !select) return;

                select.addEventListener("change", async (event) => {
                    const journal = await fromUuid(select.value);
                    input.value = journal instanceof JournalEntry ? select.value : "";
                });

                input.addEventListener("input", (event) => {
                    select.value = input.value;
                });
            },
        });

        if (!result || !result.uuid) return;

        this.settings.journal = result.uuid;
    }

    #launchTravelSheet() {
        const controlled = canvas.tokens.controlled.filter(
            (token) => !!token.actor?.isOfType("character", "npc")
        );

        const actors = controlled.length
            ? controlled.map((token) => token.actor)
            : game.actors.party?.members?.filter((actor) => actor.isOfType("character", "npc"));

        return game.pf2e.gm.launchTravelSheet((actors ?? []) as CharacterPF2e[]);
    }

    async #getOwnedActorFromEvent(event: Event): Promise<Maybe<ActorPF2e>> {
        const target = htmlClosest(event.target, "[data-actor-id]");
        const { actorId, actorUuid } = target?.dataset ?? {};

        return actorUuid ? fromUuid<ActorPF2e>(actorUuid) : game.actors.get(actorId ?? "");
    }

    async #setOwnedActor(event: PointerEvent, target: HTMLElement) {
        const actor = await this.#getOwnedActorFromEvent(event);
        if (!actor) return;

        if (event.button !== 0) {
            return this.#panToActiveToken(actor, true);
        }

        if (this.#isPinning) {
            return this.#addToFavorites(actor);
        }

        const mode = this.settings.selection;

        if (mode === "manual") {
            this.setActor(actor);
        } else if (mode === "select") {
            this.#previousActor = actor;
            this.render();
        }
    }

    async #clearShortcuts() {
        const worldActor = this.worldActor;
        if (!worldActor) return;

        const hint = localize("persistent.shortcuts.clear.hint");
        const inputs = ["set", "all"].map((type, i) => {
            const checked = i === 0 ? " checked" : "";
            const label = localize("persistent.shortcuts.clear", type);

            return `<label class="flexrow" style="gap: .3em;">
                <input class="flex0" type="radio" name="type" value="${type}"${checked}>
                <span>${label}</span>
            </label>`;
        });

        const result = await waitDialog<{ type: "set" | "all" }>({
            content: `<div class="hint">${hint}</div>${inputs.join("")}`,
            i18n: "persistent.shortcuts.clear",
        });

        if (result) {
            this.deleteShortcuts(result.type === "all");
        }
    }

    async #copyShortcuts() {
        const worldActor = this.worldActor;
        if (!worldActor) return;

        const currentUser = game.user;
        const options: FormSelectOption[] = game.users
            .filter((user) => user !== currentUser && worldActor.testUserPermission(user, "OWNER"))
            .map((user) => {
                return { value: user.id, label: user.name };
            });

        if (options.length === 0) {
            warning("persistent.shortcuts.copy.none");
            return;
        }

        const hint = localize("persistent.shortcuts.copy.hint");

        const group = foundry.applications.fields.createFormGroup({
            label: localize("persistent.shortcuts.copy.label"),
            input: foundry.applications.fields.createSelectInput({
                name: "user",
                options,
            }),
        });

        const result = await waitDialog<{ user: string }>({
            content: `<div class="hint">${hint}</div>${group.outerHTML}`,
            i18n: "persistent.shortcuts.copy",
        });

        if (!result) return;

        const shortcuts = getFlag<Record<string, ShortcutData[]>>(
            worldActor,
            "shortcuts",
            result.user
        );

        if (!shortcuts) {
            await this.deleteShortcuts(true);
        } else {
            await this.overrideShortcuts(shortcuts);
        }

        this.setShortcutTab(1, true);
    }

    #setSelectedToken() {
        const token = R.only(canvas.tokens.controlled);

        if (!token || !this.isValidActor(token.actor)) {
            return warning("persistent.error.selectOne");
        }

        this.setActor(token.actor, { token });
    }

    async #setupAvatar(html: HTMLElement) {
        const previousImage = this.#previousAvatar;
        this.#previousAvatar = null;

        const worldActor = this.worldActor;
        if (!worldActor) return;

        const avatarData = getDataFlag(worldActor, AvatarModel, "avatar", { strict: true });
        if (!avatarData) return;

        const newImage = (this.#previousAvatar = htmlQuery(html, ".avatar .image"));
        if (!newImage) return;

        const sameImage = previousImage?.src === newImage.src;
        const image = sameImage ? previousImage : newImage;

        if (sameImage) {
            this.#previousAvatar = previousImage;
            newImage.replaceWith(previousImage);
        }

        image.classList.add("custom");
        calculateAvatarPosition(avatarData, image);
    }

    async #onDragOwnedActor(event: DragEvent) {
        const parent = htmlClosest(event.currentTarget, "[data-actor-id]");
        const actor = game.actors.get(parent?.dataset.actorId ?? "");

        if (!this.isValidDraggableActor(actor)) {
            event.preventDefault();
            return;
        }

        const exist = !actor.token && getFirstActiveToken(actor, { linked: true });

        if (exist) {
            event.preventDefault();

            warning("persistent.ownedActor.drag.exist");
            this.#panToToken(exist);
        } else {
            const image = htmlQuery<HTMLImageElement>(parent, "img.token")?.src ?? "";
            createDraggable(event, image as ImageFilePath, actor, null, {
                type: "Actor",
                uuid: actor.uuid,
            });
        }
    }

    async #onOwnedActorDrop(event: DragEvent) {
        const actor = await this.#getOwnedActorFromEvent(event);
        if (this.isValidDraggableActor(actor)) {
            actor.sheet._onDrop(event);
        }
    }

    #onUpdateActor(actor: ActorPF2e, changes: ActorUpdateChanges) {
        if (this.#ownedActors?.includes(actor.id)) {
            this.render();
        } else if (game.user.isGM) {
            actor.id === PARTY_ACTOR_ID && this.render();
        } else {
            const ownership = changes.ownership ?? changes["==ownership"];
            ownership && game.userId in ownership && this.render();
        }
    }

    #panToActiveToken(actor: ActorPF2e, linked?: boolean) {
        const token = actor.token ?? getFirstActiveToken(actor, { linked });

        if (token) {
            this.#panToToken(token);
        } else {
            warning("persistent.pan.none");
        }
    }

    #panToToken(token: TokenDocumentPF2e) {
        panToToken(token);
        pingToken(token, true);
    }

    #activateListeners(html: HTMLElement) {
        const actor = this.actor;
        const hasOwnedActors = !!this.#ownedActors?.length;

        this.#updateActorHook.toggle(hasOwnedActors);

        if (actor) {
            addListener(html, ".avatar", "drop", (el, event) => {
                actor.sheet._onDrop(event);
            });
        } else if (hasOwnedActors) {
            const ownedList = [
                ...html.querySelectorAll<HTMLElement>(".owned-actor img"),
                html.querySelector<HTMLElement>(`[data-action="party-sheet"]`),
            ].filter(R.isTruthy);

            for (const el of ownedList) {
                el.addEventListener("dragstart", this.#onDragOwnedActor.bind(this));
                el.addEventListener("drop", this.#onOwnedActorDrop.bind(this));
            }
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

function getTokenImage(actor: ActorPF2e): ImageFilePath | VideoFilePath {
    return actor.prototypeToken.texture.src ?? actor.img;
}

type ActorUpdateChanges = {
    ownership?: DocumentOwnership;
    "==ownership"?: DocumentOwnership;
};

type PatchEventAction =
    | "browser"
    | "check-prompt"
    | "gm-screen"
    | "group-perception"
    | "identify-menu"
    | "journal-sheet"
    | "party-sheet"
    | "random-pick"
    | "select-all"
    | "set-journal"
    | "travel-sheet";

type ShortcutsEventAction = "clear-shortcuts" | "copy-shortcuts" | "fill-shortcuts";

type MenuEventAction =
    | "clear-hotbar"
    | "edit-avatar"
    | "mute-sound"
    | "pin-token"
    | "set-actor"
    | "toggle-clean"
    | "toggle-effects"
    | "toggle-hotbar-lock";

type EventAction =
    | MenuEventAction
    | PatchEventAction
    | ShortcutsEventAction
    | "open-sheet"
    | "select-owned-actor"
    | "unpin-owned-actor";

type PersistentRenderOptions = ApplicationRenderOptions & {
    selectionMode: PersistentSettings["selection"];
};

type SetActorOptions = { token?: TokenPF2e };

type PersistentHudActor = CharacterPF2e | NPCPF2e;

type PersistentContext = PersistentContextBase & {
    ac: number;
    avatar: {
        background: string;
        isVideo: boolean;
        src: ImageFilePath | VideoFilePath;
    };
    shortcutsTab: SliderData;
};

type EmptyPersistentContext = PersistentContextBase & {
    actors: OwnedActorContext[];
    canPin: boolean;
    identify: boolean;
    isGM: boolean;
    journal: string | undefined;
    party: MaybeFalsy<{
        id: string;
        name: string;
        img: string;
    }>;
};

type OwnedActorContext = {
    ac: number;
    favorite: boolean;
    heroPoints: number | undefined;
    hp: HealthData | undefined;
    id: string;
    img: ImageFilePath;
    name: string;
    speed: HudSpeed | undefined;
    statistics: AdvancedStatistic[];
    tokenImage: ImageFilePath | VideoFilePath;
    uuid: ActorUUID;
};

type PersistentContextBase = ReturnedAdvancedHudContext & {
    noEffects: boolean;
    setActor: { tooltip: string; disabled: boolean; icon: string } | undefined;
};

type PersistentCloseOptions = ApplicationClosingOptions & {
    force?: boolean;
};

type PersistentSettings = {
    autoFill: boolean;
    cleanPortrait: boolean;
    display: (typeof ENABLED_MODES)[number];
    favorites: ActorUUID[];
    journal: string;
    savedActor: string;
    selection: (typeof SELECTION_MODES)[number];
    shiftEffect: boolean;
    showEffects: boolean;
};

export { PersistentPF2eHUD };
