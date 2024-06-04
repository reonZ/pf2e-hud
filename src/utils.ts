import {
    ErrorPF2e,
    ITEM_CARRY_TYPES,
    IdentifyItemPopup,
    R,
    addListener,
    addListenerAll,
    closest,
    coerceToSpellGroupId,
    consumeItem,
    createHTMLElement,
    detachSubitem,
    elementData,
    getActivePF2eModule,
    getFlag,
    htmlClosest,
    setFlag,
    signedInteger,
    tupleHasValue,
} from "pf2e-api";

const COVER_UUID = "Compendium.pf2e.other-effects.Item.I9lfZUiCwMiGogVi";

const ADJUSTMENTS_INDEX = ["weak", null, "elite"] as const;

const STATS_PARTIALS = [
    "stats_header",
    "stats_statistics",
    "stats_infos",
    "stats_speed",
    "stats_level",
    "stats_extras",
    "numbers",
    "slider",
    "sidebars",
];

const ADJUSTMENTS = {
    normal: { icon: "fa-regular fa-alien-8bit", label: "PF2E.NPC.Adjustment.NormalLabel" },
    weak: { icon: "fa-thin fa-alien-8bit", label: "PF2E.NPC.Adjustment.WeakLabel" },
    elite: { icon: "fa-solid fa-alien-8bit", label: "PF2E.NPC.Adjustment.EliteLabel" },
};

const STATISTICS = [
    { slug: "fortitude", icon: "fa-solid fa-chess-rook" },
    { slug: "reflex", icon: "fa-solid fa-person-running" },
    { slug: "will", icon: "fa-solid fa-brain" },
    { slug: "perception", icon: "fa-solid fa-eye" },
    { slug: "stealth", icon: "fa-duotone fa-eye-slash" },
    { slug: "athletics", icon: "fa-solid fa-hand-fist" },
] as const;

const IWR_DATA = [
    { type: "immunities", icon: "fa-solid fa-ankh", label: "PF2E.ImmunitiesLabel" },
    { type: "resistances", icon: "fa-solid fa-shield-virus", label: "PF2E.ResistancesLabel" },
    { type: "weaknesses", icon: "fa-solid fa-heart-crack", label: "PF2E.WeaknessesLabel" },
] as const;

const INFOS = [
    {
        slug: "languages",
        label: "PF2E.Actor.Creature.Language.Plural",
        icon: "fa-solid fa-message-dots",
        createTooltip: (actor: ActorPF2e) => {
            if (!actor.isOfType("creature")) return [];
            return actor.system.details.languages.value.map((lang) =>
                game.i18n.localize(CONFIG.PF2E.languages[lang])
            );
        },
    },
    {
        slug: "senses",
        label: "PF2E.Actor.Creature.Sense.Plural",
        icon: "fa-solid fa-signal-stream",
        createTooltip: (actor: ActorPF2e) =>
            actor.perception?.senses.map((sense) => sense.label) ?? [],
    },
    {
        slug: "immunities",
        ...IWR_DATA[0],
        createTooltip: (actor: ActorPF2e) =>
            actor.attributes.immunities.map((immunity) => immunity.label),
    },
    {
        slug: "resistances",
        ...IWR_DATA[1],
        createTooltip: (actor: ActorPF2e) =>
            actor.attributes.resistances.map((resistance) => resistance.label),
    },
    {
        slug: "weaknesses",
        ...IWR_DATA[2],
        createTooltip: (actor: ActorPF2e) =>
            actor.attributes.weaknesses.map((weakness) => weakness.label),
    },
] as const;

const SPEEDS_ICONS = {
    land: "fa-solid fa-shoe-prints",
    burrow: "fa-solid fa-chevrons-down",
    climb: "fa-solid fa-spider",
    fly: "fa-solid fa-feather",
    swim: "fa-solid fa-person-swimming",
};

function getHealth(actor: ActorPF2e): HealthData | undefined {
    const hp = actor.attributes.hp as CharacterHitPoints | undefined;
    if (!hp?.max) return;

    const isCharacter = actor.isOfType("character");
    const useStamina = isCharacter && game.pf2e.settings.variants.stamina;
    const currentHP = Math.clamp(hp.value, 0, hp.max);
    const maxSP = (useStamina && hp.sp?.max) || 0;
    const currentSP = Math.clamp((useStamina && hp.sp?.value) || 0, 0, maxSP);
    const currentTotal = currentHP + currentSP;
    const maxTotal = hp.max + maxSP;

    const calculateRatio = (value: number, max: number) => {
        const ratio = value / max;
        return {
            ratio,
            hue: ratio * ratio * 122 + 3,
        };
    };

    return {
        value: currentHP,
        max: hp.max,
        ...calculateRatio(currentHP, hp.max),
        temp: hp.temp,
        sp: {
            value: currentSP,
            max: maxSP,
            ...calculateRatio(currentSP, maxSP),
        },
        useStamina,
        total: {
            value: currentTotal,
            max: maxTotal,
            ...calculateRatio(currentTotal, maxTotal),
        },
    };
}

function getCoverEffect(actor: ActorPF2e) {
    return actor?.itemTypes.effect.find((effect) => effect.flags.core?.sourceId === COVER_UUID);
}

function getStatsHeader(actor: ActorPF2e, withExtra: true): StatsHeaderWithExtras;
function getStatsHeader(actor: ActorPF2e, withExtra: false): StatsHeader;
function getStatsHeader(actor: ActorPF2e, withExtra: boolean): StatsHeader | StatsHeaderWithExtras {
    const isArmy = actor.isOfType("army");

    const data: StatsHeader = {
        health: getHealth(actor),
        ac: isArmy ? actor.system.ac.value : actor.attributes.ac?.value,
        scouting: isArmy ? signedInteger(actor.scouting.mod) : undefined,
        hardness: actor.isOfType("vehicle", "hazard") ? actor.attributes.hardness : undefined,
    };

    if (!withExtra) return data;

    const isNPC = actor.isOfType("npc");
    const isFamiliar = actor.isOfType("familiar");
    const isCharacter = actor.isOfType("character");

    const dataWithExtra: StatsHeaderWithExtras = {
        ...data,
        isNPC,
        isFamiliar,
        isCharacter,
        isCombatant: isCharacter || isNPC,
        hasCover: !!getCoverEffect(actor),
        resolve: isCharacter ? actor.system.resources.resolve : undefined,
        shield: isCharacter || isNPC ? actor.attributes.shield : undefined,
        adjustment: (isNPC && ADJUSTMENTS[actor.attributes.adjustment ?? "normal"]) || undefined,
    };

    return dataWithExtra;
}

function addStatsHeaderListeners(actor: ActorPF2e, html: HTMLElement, token?: TokenPF2e | null) {
    addEnterKeyListeners(html);

    addListenerAll(html, "input[type='number']", "change", (event, el: HTMLInputElement) => {
        let path = el.name;
        let value = Math.max(el.valueAsNumber, 0);

        const cursor = foundry.utils.getProperty(actor, path);
        if (cursor === undefined || Number.isNaN(value)) return;

        if (
            R.isObjectType<{ value: number; max: number } | null>(cursor) &&
            "value" in cursor &&
            "max" in cursor
        ) {
            path += ".value";
            value = Math.min(el.valueAsNumber, cursor.max);
        }

        if (path === "system.attributes.shield.hp.value") {
            const heldShield = actor.isOfType("creature") ? actor.heldShield : undefined;
            if (heldShield) {
                heldShield.update({ "system.hp.value": value });
            }
        } else {
            actor.update({ [path]: value });
        }
    });

    addListenerAll(html, "[data-action]:not(.disabled)", (event, el) => {
        const action = el.dataset.action as StatsHeaderActionEvent;

        switch (action) {
            case "raise-shield": {
                game.pf2e.actions.raiseAShield({ actors: [actor], event });
                break;
            }
            case "take-cover": {
                const existing = getCoverEffect(actor);
                if (existing) {
                    existing.delete();
                } else {
                    const options: Partial<ActionUseOptions> = { actors: [actor], event };
                    if (token) options.tokens = [token];
                    game.pf2e.actions.get("take-cover")?.use(options);
                }
                break;
            }
        }
    });

    if (actor.isOfType("npc")) {
        addListener(html, "[data-slider-action='adjustment']", "mousedown", (event) => {
            if (![0, 2].includes(event.button)) return;

            const direction = event.button === 0 ? 1 : -1;
            const currentAdjustment = actor.attributes.adjustment ?? null;
            const currentIndex = ADJUSTMENTS_INDEX.indexOf(currentAdjustment);
            const adjustment = ADJUSTMENTS_INDEX[Math.clamp(currentIndex + direction, 0, 2)];

            if (adjustment !== currentAdjustment) {
                return actor.applyAdjustment(adjustment);
            }
        });
    }
}

function getStatistics(actor: ActorPF2e, useModifier?: boolean) {
    return R.pipe(
        STATISTICS,
        R.map(({ slug, icon }): StatsStatistic | undefined => {
            const statistic = actor.getStatistic(slug);
            if (!statistic) return;

            const mod = signedInteger(statistic.mod);
            const dc = statistic.dc.value;

            return {
                dc,
                mod,
                slug,
                icon,
                label: statistic.label,
                value: useModifier ? mod : useModifier === false ? dc : undefined,
            };
        }),
        R.compact
    );
}

function addEnterKeyListeners(html: HTMLElement) {
    addListenerAll(html, "input", "keyup", (event, el) => {
        if (event.key === "Enter") el.blur();
    });
}

function getSpeeds(actor: ActorPF2e): StatsSpeeds {
    const speeds = actor.isOfType("creature")
        ? R.pipe(
              [actor.attributes.speed, ...actor.attributes.speed.otherSpeeds] as const,
              R.filter(
                  ({ total, type }) => type === "land" || (typeof total === "number" && total > 0)
              ),
              R.map(({ type, total, label }) => ({
                  icon: SPEEDS_ICONS[type],
                  total,
                  label,
                  type,
              }))
          )
        : [];

    const speedNote = actor.isOfType("npc")
        ? actor.attributes.speed.details
        : actor.isOfType("vehicle")
        ? actor.system.details.speed
        : undefined;

    return {
        speeds,
        speedNote,
    };
}

function getStatsAdvanced(
    actor: ActorPF2e,
    { useModifier, useHighestSpeed }: { useModifier?: boolean; useHighestSpeed: boolean }
): StatsAdvanced {
    const isNPC = actor.isOfType("npc");
    const isArmy = actor.isOfType("army");
    const isHazard = actor.isOfType("hazard");
    const isVehicle = actor.isOfType("vehicle");
    const isCharacter = actor.isOfType("character");
    const isCombatant = isCharacter || isNPC;

    const infoSections = INFOS.map(({ createTooltip, label, slug, icon }): InfoSection => {
        const tooltipData = R.compact(createTooltip(actor)).map((row) => `<li>${row}</li>`);

        const tooltip = tooltipData.length
            ? `<h4>${game.i18n.localize(label)}</h4><ul>${tooltipData.join("")}</ul>`
            : label;

        return {
            slug,
            icon,
            label,
            tooltip,
            active: tooltipData.length > 0,
        };
    });

    const speeds = getSpeeds(actor).speeds;
    const mainSpeed = ((): StatsSpeed | undefined => {
        if (!speeds?.length) return;

        const selectedSpeed = getFlag<MovementType>(actor, "speed");
        if (selectedSpeed) {
            const index = speeds.findIndex((speed) => speed.type === selectedSpeed);
            if (index !== -1) return speeds.splice(index, 1)[0];
        }

        const landSpeed = speeds[0];
        if (!useHighestSpeed) return speeds.shift();

        const [_, highestSpeeds] =
            speeds.length === 1
                ? ["", speeds]
                : R.pipe(
                      speeds,
                      R.groupBy((x) => x.total),
                      R.toPairs.strict,
                      R.sortBy([(x) => Number(x[0]), "desc"]),
                      R.first()
                  )!;
        if (highestSpeeds.includes(landSpeed)) return speeds.shift();

        const highestSpeed = highestSpeeds[0];
        const index = speeds.findIndex((speed) => speed === highestSpeed);

        return speeds.splice(index, 1)[0];
    })();

    const otherSpeeds = speeds
        ?.map((speed) => `<i class="${speed.icon}"></i> <span>${speed.total}</span>`)
        .join("");

    return {
        isNPC,
        isArmy,
        isHazard,
        isVehicle,
        isCharacter,
        isCombatant,
        infoSections,
        mainSpeed,
        level: actor.level,
        dying: isCharacter ? actor.attributes.dying : undefined,
        wounded: isCharacter ? actor.attributes.wounded : undefined,
        recall: isNPC ? actor.identificationDCs.standard.dc : undefined,
        heroPoints: isCharacter ? actor.heroPoints : undefined,
        statistics: getStatistics(actor, useModifier),
        otherSpeeds: otherSpeeds || undefined,
    };
}

function addStatsAdvancedListeners(actor: ActorPF2e, html: HTMLElement) {
    addListenerAll(html, "[data-action]:not(.disabled)", (event, el) => {
        const action = el.dataset.action as StatsAdvancedActionEvent;

        switch (action) {
            case "roll-statistic": {
                const slug = elementData(el).statistic;
                actor.getStatistic(slug)?.roll({ event });
                break;
            }
            case "change-speed": {
                const selected = el.dataset.speed as MovementType;
                const speeds: MovementType[] = [
                    "land",
                    ...(actor as CreaturePF2e).attributes.speed.otherSpeeds.map(
                        (speed) => speed.type
                    ),
                ];
                const speedIndex = speeds.indexOf(selected);
                const newSpeed = speeds[(speedIndex + 1) % speeds.length];
                setFlag(actor, "speed", newSpeed);
                break;
            }
        }
    });

    addListenerAll(html, "[data-slider-action]:not(.disabled)", "mousedown", (event, el) => {
        if (![0, 2].includes(event.button)) return;

        const action = el.dataset.sliderAction as StatsAdvancedSliderEvent;
        const direction = event.button === 0 ? 1 : -1;

        switch (action) {
            case "hero": {
                const { max, value } = (actor as CharacterPF2e).heroPoints;
                const newValue = Math.clamp(value + direction, 0, max);
                if (newValue !== value) {
                    actor.update({ "system.resources.heroPoints.value": newValue });
                }
                break;
            }
            case "dying":
            case "wounded": {
                const max = (actor as CharacterPF2e).system.attributes[action].max;
                if (direction === 1) {
                    actor.increaseCondition(action, { max });
                } else {
                    actor.decreaseCondition(action);
                }
                break;
            }
        }
    });
}

function getItemFromElement(actor: ActorPF2e, el: HTMLElement) {
    const itemElement = closest(el, "[data-item-id]");
    const { itemId, parentId, entryId } = itemElement?.dataset ?? {};

    if (entryId && actor.isOfType("creature")) {
        const collection = actor.spellcasting.collections.get(entryId, {
            strict: true,
        });
        return collection.get(itemId, { strict: true });
    }

    const item = actor.items.get(parentId ?? itemId, { strict: true });
    return parentId && item.isOfType("physical")
        ? item.subitems.get(itemId, { strict: true })
        : item;
}

function getSpellFromElement(actor: CreaturePF2e, target: HTMLElement) {
    const spellRow = closest(target, "[data-item-id]");
    const { itemId, entryId, slotId } = spellRow?.dataset ?? {};
    const collection = actor.spellcasting.collections.get(entryId, {
        strict: true,
    });

    return {
        slotId,
        collection,
        castRank: spellRow?.dataset.castRank,
        spell: collection.get(itemId, { strict: true }),
    };
}

function canObserve(actor: ActorPF2e | null | undefined) {
    if (!actor) return false;
    return actor.testUserPermission(game.user, "OBSERVER");
}

function addStavesListeners(actor: ActorPF2e, html: HTMLElement) {
    const pf2eDailies = getActivePF2eModule("pf2e-dailies");
    if (!pf2eDailies || !actor.isOfType("character")) return;

    addListenerAll(
        html,
        "[data-action='update-staff-charges']",
        "change",
        (event, el: HTMLInputElement) => {
            const value = el.valueAsNumber;
            pf2eDailies.api.setStaffChargesValue(actor, value);
        }
    );
}

function addItemPropertyListeners(actor: ActorPF2e, parent: HTMLElement) {
    addListenerAll(
        parent,
        "input[data-item-id][data-item-property]",
        "change",
        (event, el: HTMLInputElement) => {
            event.stopPropagation();
            const { itemId, itemProperty } = elementData(el);
            actor.updateEmbeddedDocuments("Item", [
                {
                    _id: itemId,
                    [itemProperty]: el.valueAsNumber,
                },
            ]);
        }
    );
}

function addFocusListeners(actor: ActorPF2e, html: HTMLElement) {
    if (actor.isOfType("character")) {
        addListenerAll(html, "[data-slider-action='focus']", "mousedown", (event, el) => {
            const direction = event.button === 0 ? 1 : -1;
            const focusPoints = actor.system.resources.focus;
            const newValue = Math.clamp(focusPoints.value + direction, 0, focusPoints.max);

            if (newValue !== focusPoints.value) {
                actor.update({ "system.resources.focus.value": newValue });
            }
        });
    }
}

function addSendItemToChatListeners(
    actor: ActorPF2e,
    html: HTMLElement,
    onSendToChat?: () => void
) {
    addListenerAll(html, "[data-action='send-to-chat']", (event, el) => {
        const item = getItemFromElement(actor, el);

        if (item.isOfType("spell")) {
            const castRank = Number(closest(el, "[data-cast-rank]")?.dataset.castRank ?? NaN);
            item.toMessage(event, { data: { castRank } });
        } else {
            item.toMessage(event);
        }

        onSendToChat?.();
    });
}

function addSpellsListeners(
    actor: CharacterPF2e | NPCPF2e,
    html: HTMLElement,
    onSpellCast?: () => void
) {
    addEnterKeyListeners(html);
    addItemPropertyListeners(actor, html);
    addStavesListeners(actor, html);
    addFocusListeners(actor, html);

    addListenerAll(html, "[data-action]:not(disabled)", (event, el) => {
        const action = el.dataset.action as SpellsActionEvent;

        switch (action) {
            case "cast-spell": {
                const { spell, castRank, collection, slotId } = getSpellFromElement(actor, el);
                const maybeCastRank = Number(castRank) || NaN;

                if (Number.isInteger(maybeCastRank) && maybeCastRank.between(1, 10)) {
                    const rank = maybeCastRank as OneToTen;

                    onSpellCast?.();

                    return (
                        spell.parentItem?.consume() ??
                        collection.entry.cast(spell, { rank, slotId: Number(slotId) })
                    );
                }

                break;
            }

            case "toggle-slot-expended": {
                const row = htmlClosest(event.target, "[data-item-id]");
                const groupId = coerceToSpellGroupId(row?.dataset.groupId);
                if (!groupId) throw ErrorPF2e("Unexpected error toggling expended state");

                const slotId = Number(row?.dataset.slotId) || 0;
                const entryId = row?.dataset.entryId ?? "";
                const expend = row?.dataset.slotExpended === undefined;
                const collection = actor.spellcasting.collections.get(entryId);

                return collection?.setSlotExpendedState(groupId, slotId, expend);
            }

            case "draw-item": {
                const itemId = htmlClosest(event.target, "[data-item-id")?.dataset.itemId;
                const item = actor.inventory.get(itemId, { strict: true });
                return actor.changeCarryType(item, { carryType: "held", handsHeld: 1 });
            }
        }
    });
}

function addItemsListeners(actor: ActorPF2e, html: HTMLElement) {
    addEnterKeyListeners(html);
    addItemPropertyListeners(actor, html);

    addListenerAll(html, "[data-item-id]", "dragstart", (event, el) => {
        if (!event.dataTransfer) return;

        const item = getItemFromElement(actor, el);

        const img = new Image();
        img.src = item.img;
        img.style.width = "32px";
        img.style.height = "32px";
        img.style.borderRadius = "4px";
        img.style.position = "absolute";
        img.style.left = "-1000px";
        document.body.append(img);

        event.dataTransfer.setDragImage(img, 16, 16);
        event.dataTransfer.setData(
            "text/plain",
            JSON.stringify({ ...item.toDragData(), fromInventory: true })
        );

        el.addEventListener("dragend", () => img.remove(), { once: true });
    });

    addListenerAll(html, "[data-action]:not(disabled)", (event, el) => {
        const action = el.dataset.action as ItemsActionEvent;

        const item = getItemFromElement(actor, el) as PhysicalItemPF2e;

        switch (action) {
            case "toggle-container": {
                if (!item.isOfType("backpack")) return;
                const isCollapsed = item.system.collapsed ?? false;
                return item.update({ "system.collapsed": !isCollapsed });
            }

            case "delete-item": {
                return actor.sheet.deleteItem(item, event);
            }

            case "edit-item": {
                return item.sheet.render(true);
            }

            case "toggle-identified": {
                if (item.isIdentified) {
                    item.setIdentificationStatus("unidentified");
                } else {
                    new IdentifyItemPopup(item).render(true);
                }
                break;
            }

            case "toggle-invested": {
                const itemId = htmlClosest(event.target, "[data-item-id]")?.dataset.itemId;
                if (itemId && actor.isOfType("character")) {
                    actor.toggleInvested(itemId);
                }
                break;
            }

            case "detach-subitem": {
                return detachSubitem(item, event.ctrlKey);
            }

            case "repair-item": {
                return game.pf2e.actions.repair({ event, item });
            }

            case "open-carry-type-menu": {
                if (actor.isOfType("character")) {
                    openCarryTypeMenu(actor, el);
                }
                break;
            }

            case "use-item": {
                if (item.isOfType("consumable") && !item.isAmmo) {
                    consumeItem(event, item);
                }
                break;
            }
        }
    });
}

async function openCarryTypeMenu(actor: CharacterPF2e, anchor: HTMLElement): Promise<void> {
    // Close the menu and return early if any carry-type menu is already open
    const menuOpen = !!document.body.querySelector("aside.locked-tooltip.carry-type-menu");
    if (menuOpen) game.tooltip.dismissLockedTooltips();

    const itemId = htmlClosest(anchor, "[data-item-id]")?.dataset.itemId;
    const item = actor.inventory.get(itemId, { strict: true });
    const hasStowingContainers = actor.itemTypes.backpack.some(
        (i) => i.system.stowing && !i.isInContainer
    );
    const templateArgs = { item, hasStowingContainers };
    const template = await renderTemplate(
        "systems/pf2e/templates/actors/partials/carry-type.hbs",
        templateArgs
    );
    const content = createHTMLElement("ul", { innerHTML: template });

    content.addEventListener("click", (event) => {
        const menuOption = htmlClosest(event.target, "a[data-carry-type]");
        if (!menuOption) return;

        const carryType = menuOption.dataset.carryType;
        if (!tupleHasValue(ITEM_CARRY_TYPES, carryType)) {
            throw ErrorPF2e("Unexpected error retrieving requested carry type");
        }

        const handsHeld = Number(menuOption.dataset.handsHeld) || 0;
        if (!tupleHasValue([0, 1, 2], handsHeld)) {
            throw ErrorPF2e("Invalid number of hands specified");
        }

        const inSlot = "inSlot" in menuOption.dataset;
        const current = item.system.equipped;
        if (
            carryType !== current.carryType ||
            inSlot !== current.inSlot ||
            (carryType === "held" && handsHeld !== current.handsHeld)
        ) {
            actor.changeCarryType(item, { carryType, handsHeld, inSlot });
            game.tooltip.dismissLockedTooltips();
        }
    });

    game.tooltip.activate(anchor, { cssClass: "pf2e-carry-type", content, locked: true });
}

function addDragoverListener(html: HTMLElement) {
    html.addEventListener(
        "dragover",
        () => {
            html.style.setProperty("pointer-events", "none");
            window.addEventListener("dragend", () => html.style.removeProperty("pointer-events"), {
                once: true,
                capture: true,
            });
        },
        true
    );
}

function hasSpells(actor: ActorPF2e) {
    return (
        actor.isOfType("character", "npc") &&
        actor.spellcasting.contents.some(
            (entry) =>
                (entry.spells?.size && entry.spells?.size > 0) ||
                (entry.isEphemeral && entry.id.endsWith("-casting"))
        )
    );
}

type ItemsActionEvent =
    | "toggle-container"
    | "delete-item"
    | "edit-item"
    | "toggle-identified"
    | "toggle-invested"
    | "detach-subitem"
    | "repair-item"
    | "open-carry-type-menu"
    | "use-item";

type SpellsActionEvent = "cast-spell" | "toggle-slot-expended" | "draw-item";

type StatsSpeed = {
    icon: string;
    total: number;
    label: string;
    type: "land" | "burrow" | "climb" | "fly" | "swim";
};

type StatsSpeeds = {
    speeds: StatsSpeed[];
    speedNote: string | undefined;
};

type StatsHeaderActionEvent = "take-cover" | "raise-shield";

type StatsAdvancedSliderEvent = "hero" | "wounded" | "dying";

type StatsAdvancedActionEvent =
    | "use-resolve"
    | "show-notes"
    | "recovery-chec"
    | "recall-knowledge"
    | "roll-statistic"
    | "open-sidebar"
    | "change-speed";

type StatsAdvanced = {
    level: number;
    isNPC: boolean;
    isArmy: boolean;
    isHazard: boolean;
    isVehicle: boolean;
    isCharacter: boolean;
    isCombatant: boolean;
    recall: number | undefined;
    dying: ValueAndMax | undefined;
    wounded: ValueAndMax | undefined;
    heroPoints: ValueAndMax | undefined;
    mainSpeed: StatsSpeed | undefined;
    statistics: StatsStatistic[];
    infoSections: InfoSection[];
    otherSpeeds: string | undefined;
};

type StatsStatistic = {
    dc: number;
    mod: string;
    slug: string;
    icon: string;
    label: string;
    value: string | number | undefined;
};

type InfoSection = {
    icon: string;
    label: string;
    active: boolean;
    tooltip: string;
    slug: "languages" | "immunities" | "weaknesses" | "resistances" | "senses";
};

type StatsHeader = {
    health: HealthData | undefined;
    ac: number | undefined;
    hardness: number | undefined;
    scouting: string | undefined;
};

type StatsHeaderWithExtras = StatsHeader & {
    isNPC: boolean;
    isFamiliar: boolean;
    isCharacter: boolean;
    isCombatant: boolean;
    hasCover: boolean;
    resolve: ValueAndMax | undefined;
    adjustment: (typeof ADJUSTMENTS)[keyof typeof ADJUSTMENTS] | undefined;
    shield: HeldShieldData | undefined;
};

type HealthData = {
    temp: number;
    sp: {
        ratio: number;
        hue: number;
        value: number;
        max: number;
    };
    useStamina: boolean;
    total: {
        ratio: number;
        hue: number;
        value: number;
        max: number;
    };
    ratio: number;
    hue: number;
    value: number;
    max: number;
};

export {
    IWR_DATA,
    STATS_PARTIALS,
    addDragoverListener,
    addEnterKeyListeners,
    addItemPropertyListeners,
    addItemsListeners,
    addSendItemToChatListeners,
    addSpellsListeners,
    addStatsAdvancedListeners,
    addStatsHeaderListeners,
    addStavesListeners,
    canObserve,
    getHealth,
    getItemFromElement,
    getSpeeds,
    getSpellFromElement,
    getStatistics,
    getStatsAdvanced,
    getStatsHeader,
    hasSpells,
};
export type {
    HealthData,
    StatsAdvanced,
    StatsHeader,
    StatsHeaderWithExtras,
    StatsSpeed,
    StatsSpeeds,
    StatsStatistic,
};
