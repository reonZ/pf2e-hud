import {
    addListenerAll,
    arrayIncludes,
    canUseStances,
    changeCarryType,
    confirmDialog,
    consumeItem,
    elementDataset,
    getActionAnnotation,
    getActionImg,
    getActiveModule,
    getFlag,
    getOwner,
    getRankLabel,
    hasItemWithSourceId,
    isInstanceOf,
    isValidStance,
    localize,
    MODULE,
    objectHasKey,
    R,
    resolveMacroActor,
    setFlag,
    setFlagProperty,
    toggleStance,
    warn,
} from "foundry-pf2e";
import { rollRecallKnowledge } from "../../actions/recall-knowledge";
import {
    PersistentContext,
    PersistentHudActor,
    PersistentRenderOptions,
    PF2eHudPersistent,
} from "../persistent";
import { PF2eHudItemPopup } from "../popup/item";
import {
    ActionBlast,
    ActionStrike,
    getActionFrequency,
    getBlastData,
    getStrikeData,
    getStrikeImage,
    getStrikeVariant,
    useAction,
    variantLabel,
} from "../sidebar/actions";
import { getAnnotationTooltip } from "../sidebar/base";
import {
    ACTION_IMAGES,
    ACTION_VARIANTS,
    getLoreSlug,
    getMapLabel,
    getSkillVariantName,
    rollStatistic,
    SkillVariantDataset,
} from "../sidebar/skills";

const SHORTCUTS_LIST_LIMIT = 3;
const ROMAN_RANKS = ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"] as const;

const GLOBAL: ShortcutsGlobal = {
    shortcuts: {},
    shortcutData: {},
    isVirtual: false,
    hasStances: false,
    selectedSet: 0,
    isLockedSet: false,
    worldActor: null,
};

async function prepareShortcutsContext(
    this: PF2eHudPersistent,
    context: PersistentContext,
    options: PersistentRenderOptions
): Promise<ShortcutsContext | (PersistentContext & { shortcutGroups: ShortcutGroup[] })> {
    const actor = this.actor;
    const nbSlots = this.getSetting("shortcutSlots");

    GLOBAL.hasStances = false;
    GLOBAL.isLockedSet = false;
    GLOBAL.isVirtual = false;
    GLOBAL.selectedSet = 0;
    GLOBAL.shortcutData = {};
    GLOBAL.shortcuts = {};
    GLOBAL.worldActor = this.worldActor;

    if (!actor) {
        return {
            ...context,
            shortcutGroups: R.range(0, nbSlots).map((n) => {
                return {
                    split: false,
                    shortcuts: [
                        {
                            index: "0",
                            groupIndex: String(n),
                            isEmpty: true,
                        },
                    ],
                } satisfies ShortcutGroup;
            }),
        };
    }

    const isGM = game.user.isGM;
    const cached: ShortcutCache = {};
    const shortcutGroups: ShortcutGroup[] = [];
    const isNPC = actor.isOfType("npc");

    const selfSetIndex = getSetIndex();
    const selfAutomatedSetIndex = await getAutomatedSetIndex();
    const selfShortcutsSet = getShortcutsSets().at(selfAutomatedSetIndex || selfSetIndex);
    const noShortcuts = !selfShortcutsSet;
    const autoFill = isNPC && noShortcuts && this.getSetting("autoFillNpc");

    const shortcutsOwner = await (async () => {
        if (!isGM || isNPC || !noShortcuts || !this.getSetting("ownerShortcuts")) return;

        const id = getOwner(actor, false)?.id;
        if (!id) return;

        const automatedSetIndex = await getAutomatedSetIndex(id);
        const shortcutsSet = getShortcutsSets(id).at(
            automatedSetIndex || selfAutomatedSetIndex || selfSetIndex
        );

        if (shortcutsAreEmpty(shortcutsSet)) return;

        return { id, automatedSetIndex, shortcutsSet };
    })();

    GLOBAL.isVirtual = !!shortcutsOwner || autoFill;
    GLOBAL.selectedSet = shortcutsOwner?.automatedSetIndex || selfAutomatedSetIndex || selfSetIndex;
    GLOBAL.isLockedSet = !!shortcutsOwner?.automatedSetIndex || !!selfAutomatedSetIndex;

    const shortcutsSet = shortcutsOwner?.shortcutsSet ?? selfShortcutsSet;

    for (const groupIndex of R.range(0, nbSlots)) {
        let isAttack = false;
        const shortcuts: (Shortcut | EmptyShortcut)[] = [];

        for (const index of R.range(0, 4)) {
            const shortcut: Shortcut | EmptyShortcut = isAttack
                ? { index: String(index), groupIndex: String(groupIndex), isEmpty: true }
                : autoFill
                ? await fillShortcut.call(this, groupIndex, index, cached)
                : await createShortcutFromSet.call(this, groupIndex, index, cached, shortcutsSet);

            shortcuts.push(shortcut);
            GLOBAL.shortcuts[`${groupIndex}-${index}`] = shortcut;

            if (index === 0 && !shortcut.isEmpty && shortcut.type === "attack") {
                isAttack = true;
            }
        }

        const firstShortcut = shortcuts.find(
            (shortcut): shortcut is Shortcut => "type" in shortcut
        );
        const split = !!firstShortcut && firstShortcut.type !== "attack";

        shortcutGroups.push({
            split,
            shortcuts: split ? shortcuts : [firstShortcut ?? shortcuts[0]],
        });
    }

    const data: ShortcutsContext = {
        ...context,
        shortcutGroups,
        isVirtual: GLOBAL.isVirtual,
        variantLabel,
    };

    return data;
}

function activateShortcutsListeners(this: PF2eHudPersistent, html: HTMLElement) {
    const shortcutElements = html.querySelectorAll<HTMLElement>(".stretch .shortcuts .shortcut");
    for (const shortcutElement of shortcutElements) {
        const classList = [...shortcutElement.classList];

        shortcutElement.addEventListener("drop", (event) => {
            onShortcutDrop.call(this, event, shortcutElement);
        });

        shortcutElement.addEventListener("mouseleave", () => {
            shortcutElement.classList.remove("show-damage");
            shortcutElement.classList.toggle(
                "use-variant",
                shortcutElement.dataset.variantFirst === "true"
            );
        });

        shortcutElement.addEventListener("contextmenu", async () => {
            const { groupIndex, index } = elementDataset(shortcutElement);

            if (GLOBAL.isVirtual) {
                if (GLOBAL.shortcutData[groupIndex]?.[index]) {
                    delete GLOBAL.shortcutData[groupIndex][index];
                }
                await overrideShortcutData.call(this);
            } else {
                if (GLOBAL.worldActor) {
                    await deleteShortcuts(groupIndex, index);
                }
            }
        });

        if (!arrayIncludes(["empty", "disabled", "attack"], classList)) {
            shortcutElement.addEventListener("click", async (event) => {
                onShortcutClick.call(this, event, shortcutElement);
            });
        }

        addListenerAll(shortcutElement, "[data-action]", (event, el) =>
            onShortcutAction.call(this, event, shortcutElement, el)
        );

        addListenerAll(shortcutElement, ".variants > .category > *", () => {
            shortcutElement.classList.toggle("use-variant");
        });

        const auxilaryElements = shortcutElement.querySelectorAll<HTMLElement>(
            "[data-action='auxiliary-action']"
        );
        for (const auxilaryElement of auxilaryElements) {
            auxilaryElement.dataset.tooltip = auxilaryElement.innerHTML.trim();
        }
    }
}

function getGlobalShortcut<T extends Shortcut>(
    groupIndex: Maybe<number | string>,
    index: Maybe<number | string>
) {
    return GLOBAL.shortcuts[`${groupIndex}-${index}`] as T | undefined;
}

function getShortcutFromElement<T extends Shortcut>(el: HTMLElement) {
    const { groupIndex, index } = el.dataset;
    return getGlobalShortcut<T>(groupIndex, index);
}

async function onShortcutClick(
    this: PF2eHudPersistent,
    event: MouseEvent,
    shortcutElement: HTMLElement
) {
    const actor = this.actor;
    const shortcut = getShortcutFromElement<Exclude<Shortcut, AttackShortcut>>(shortcutElement);
    if (!actor || !shortcut || shortcut.isEmpty || shortcut.isDisabled) return;

    function confirmUse(item: ItemPF2e) {
        return confirmShortcut("confirm", { name: item.name });
    }

    switch (shortcut.type) {
        case "skill": {
            if (!shortcut.item) return;

            if (shortcut.item.isOfType("lore")) {
                const slug = getLoreSlug(shortcut.item);
                return actor.getStatistic(slug)?.roll({ event });
            } else if (shortcut.actionId === "recall-knowledge" && !shortcut.statistic) {
                return rollRecallKnowledge(actor);
            } else if (shortcut.actionId === "earnIncome") {
                return game.pf2e.actions.earnIncome(actor);
            }

            rollStatistic(actor, event, shortcut);
            break;
        }

        case "consumable": {
            const item = shortcut.item;
            if (!item) return;

            const setting = this.getSetting("consumableShortcut");

            if (setting === "chat") {
                return item.toMessage(event);
            }

            if (shortcut.notCarried && shortcut.annotation) {
                if (setting === "confirm") {
                    const type = localize("sidebars.annotation", shortcut.annotation);
                    const name = item.name;
                    const confirm = await confirmShortcut("draw", { type, name });
                    if (!confirm) return;
                }

                return changeCarryType(actor, item, 1, shortcut.annotation);
            }

            if (setting === "confirm") {
                const confirm = await confirmUse(item);
                if (!confirm) return;
            }

            return consumeItem(event, item);
        }

        case "toggle": {
            const { domain, itemId, option } = shortcut;
            return actor.toggleRollOption(domain, option, itemId ?? null);
        }

        case "action": {
            const item = shortcut.item;
            if (!item) return;

            if (!isUsableAction(item)) {
                return new PF2eHudItemPopup({ actor, item, event }).render(true);
            }

            if (this.getSetting("confirmShortcut") && !(await confirmUse(item))) return;

            if (!shortcut.effectUuid || !isValidStance(item)) {
                return useAction(event, item);
            }

            return toggleStance(actor as CharacterPF2e, shortcut.effectUuid, event.ctrlKey);
        }

        case "spell": {
            const {
                castRank: rank,
                slotId,
                collection,
                item: spell,
                notCarried,
                annotation,
                parentItem,
            } = shortcut;

            if (!spell) return;

            const setting = this.getSetting("confirmShortcut");

            if (notCarried) {
                if (!annotation || !parentItem) return;

                if (setting) {
                    const type = localize("sidebars.annotation", annotation);
                    const name = parentItem.name;
                    const confirm = await confirmShortcut("draw", { type, name });

                    if (!confirm) return;
                }

                return changeCarryType(actor, parentItem, 1, annotation);
            }

            if (setting && !(await confirmUse(spell))) return;

            return spell.parentItem?.consume() ?? collection.entry.cast(spell, { rank, slotId });
        }
    }
}

function isUsableAction(item: FeatPF2e | AbilityItemPF2e) {
    return (
        item.system.selfEffect ||
        item.frequency?.max ||
        foundry.utils.getProperty(item, "flags.pf2e-toolbelt.actionable.macro")
    );
}

async function onShortcutAction(
    this: PF2eHudPersistent,
    event: MouseEvent,
    shortcutElement: HTMLElement,
    el: HTMLElement
) {
    const actor = this.actor;
    if (!actor) return;

    const action = el.dataset.action as ShortcutActionEvent;

    const getStrike = async <T extends StrikeData>(el: HTMLElement, readyOnly = false) => {
        const shortcut = getShortcutFromElement<StrikeShortcut>(shortcutElement);
        if (!shortcut?.strike || shortcut.isEmpty) return null;
        return getStrikeVariant<T>(shortcut.strike, el, readyOnly);
    };

    switch (action) {
        case "toggle-damage": {
            shortcutElement?.classList.toggle("show-damage");
            break;
        }

        case "open-attack-popup": {
            if (actor.isOfType("character")) {
                game.pf2e.rollActionMacro({
                    ...el.dataset,
                    actorUUID: actor.uuid,
                });
            }
            break;
        }

        case "blast-attack": {
            const shortcut = getShortcutFromElement<BlastShortcut>(shortcutElement);
            if (!shortcut?.blast || shortcut.isEmpty) return;

            const mapIncreases = Math.clamp(Number(el.dataset.mapIncreases), 0, 2);
            return shortcut.blast.attack(event, mapIncreases, el);
        }

        case "blast-damage": {
            const shortcut = getShortcutFromElement<BlastShortcut>(shortcutElement);
            if (!shortcut?.blast || shortcut.isEmpty) return;
            return shortcut.blast.damage(event, el);
        }

        case "strike-attack": {
            const strike = await getStrike(el, true);
            const variantIndex = Number(el.dataset.variantIndex);
            return strike?.variants[variantIndex]?.roll({ event });
        }

        case "strike-damage":
        case "strike-critical": {
            const strike = await getStrike(el);
            const method = el.dataset.action === "strike-damage" ? "damage" : "critical";
            return strike?.[method]?.({ event });
        }

        case "auxiliary-action": {
            const strike = await getStrike<CharacterStrike>(el);
            const auxiliaryActionIndex = Number(el.dataset.auxiliaryActionIndex ?? NaN);
            strike?.auxiliaryActions?.at(auxiliaryActionIndex)?.execute();
            break;
        }

        case "channel-elements": {
            const action = actor.itemTypes.action.find((x) => x.slug === "channel-elements");

            if (!action) {
                warn("persistent.main.shortcut.noChannelElements");
                return;
            }

            return useAction(event, action);
        }
    }
}

async function onShortcutDrop(this: PF2eHudPersistent, event: DragEvent, el: HTMLElement) {
    const dropData: DropData = TextEditor.getDragEventData(event);
    const wrongType = () => warn("persistent.main.shortcut.wrongType");
    const wrongActor = () => warn("persistent.main.shortcut.wrongActor");
    const wrongOrigin = () => warn("persistent.main.shortcut.wrongOrigin");

    if (!["Item", "RollOption", "Action"].includes(dropData.type ?? "")) {
        return wrongType();
    }

    if (
        dropData.type === "Item" &&
        dropData.itemType === "melee" &&
        typeof dropData.index === "number"
    ) {
        dropData.type = "Action";
    }

    const actor = this.actor;
    if (!actor) return;

    let { index, groupIndex } = elementDataset(el);
    const shortcut = getGlobalShortcut(groupIndex, index);

    let newShortcut: ShortcutData | undefined;

    switch (dropData.type) {
        case "RollOption": {
            const { label, domain, option } = dropData as RollOptionData;
            if (
                typeof label !== "string" ||
                !label.length ||
                typeof domain !== "string" ||
                !domain.length ||
                typeof option !== "string" ||
                !option.length
            )
                return wrongType();

            const item = fromUuidSync(dropData.uuid ?? "");
            if (!(isInstanceOf(item, "ItemPF2e") && item.isEmbedded)) return wrongType();
            if (!this.isCurrentActor(item.actor)) return wrongActor();

            newShortcut = {
                type: "toggle",
                index,
                groupIndex,
                domain,
                option,
                img: item.img,
                itemId: item.id,
                name: label,
            } satisfies ToggleShortcutData;

            break;
        }

        case "Item": {
            if ((!dropData.uuid && !dropData.entryId) || !dropData.itemType) {
                return wrongType();
            }

            const item: Maybe<ItemPF2e> = dropData.entryId
                ? (actor as CreaturePF2e).spellcasting.collections
                      .get(dropData.entryId)
                      ?.get(dropData.itemId as string)
                : await fromUuid<ItemPF2e>(dropData.uuid as string);

            if (!item?.isOfType("consumable", "spell", "action", "feat", "lore")) {
                return wrongType();
            }

            if (
                (dropData.actorLess && dropData.actorUUID !== actor.uuid) ||
                (!dropData.actorLess && !this.isCurrentActor(item.actor))
            )
                return wrongActor();

            if (item.isOfType("consumable")) {
                if (event.ctrlKey && item.system.uses.autoDestroy) {
                    newShortcut = {
                        type: "consumable",
                        index,
                        groupIndex,
                        img: item.system.spell?.img ?? item.img,
                        name: item.name,
                        slug: itemSlug(item),
                    } satisfies GenericConsumableShortcutData;
                } else {
                    newShortcut = {
                        type: "consumable",
                        itemId: item.id,
                        index,
                        groupIndex,
                    } satisfies TemporaryConsumableShortcutData;
                }
            } else if (
                item.isOfType("action", "feat", "lore") &&
                dropData.actorLess &&
                dropData.isStatistic &&
                typeof dropData.uuid === "string" &&
                typeof dropData.actionId === "string"
            ) {
                newShortcut = {
                    type: "skill",
                    index,
                    groupIndex,
                    itemUuid: dropData.uuid,
                    actionId: dropData.actionId,
                    statistic: dropData.statistic,
                    map: dropData.map ? (Number(dropData.map) as 1 | 2) : undefined,
                    agile: dropData.agile === "true",
                    variant: dropData.variant ?? undefined,
                    option: dropData.option,
                } satisfies SkillShortcutData;
            } else if (item.isOfType("action", "feat")) {
                newShortcut = {
                    type: "action",
                    index,
                    groupIndex,
                    itemId: item.id,
                    name: item.name,
                    img: getActionImg(item, true),
                    effectUuid: dropData.effectUuid,
                } satisfies ActionShortcutData;
            } else if (item.isOfType("spell")) {
                const { fromSidebar, itemType, entryId, slotId } = dropData;
                const castRank = Number(dropData.castRank);
                const groupId =
                    dropData.groupId === "cantrips" ? "cantrips" : Number(dropData.groupId);

                if (!fromSidebar) return wrongOrigin();
                if (!entryId || (groupId !== "cantrips" && isNaN(groupId)) || isNaN(castRank)) {
                    return wrongType();
                }

                newShortcut = {
                    type: "spell",
                    index,
                    groupIndex,
                    itemType,
                    itemId: item.id,
                    castRank,
                    entryId,
                    slotId: Number(slotId),
                    groupId,
                } satisfies SpellShortcutData;
            }

            break;
        }

        case "Action": {
            if (typeof dropData.index !== "number" && !dropData.elementTrait) return wrongType();

            const itemActor = resolveMacroActor(dropData.actorUUID);
            if (!this.isCurrentActor(itemActor)) return wrongActor();

            const isCharacter = actor.isOfType("character");
            const { elementTrait, index: actionIndex } = dropData;

            index = "0";

            if (isCharacter && objectHasKey(CONFIG.PF2E.elementTraits, elementTrait)) {
                const blast = new game.pf2e.ElementalBlast(actor);
                const config = blast.configs.find((c) => c.element === elementTrait);
                if (!config) return wrongType();

                newShortcut = {
                    type: "attack",
                    index,
                    groupIndex,
                    elementTrait,
                    img: config.img,
                    variant: event.ctrlKey,
                    name: game.i18n.localize(config.label),
                } satisfies BlastShortcutData;
            } else if (actionIndex !== undefined) {
                const action = actor.system.actions[actionIndex];
                if (!action) return wrongType();

                newShortcut = createStrikeShortcutData(
                    groupIndex,
                    index,
                    action,
                    isCharacter && (action.altUsages?.length ?? 0) > 0 && event.ctrlKey
                );
            }

            break;
        }
    }

    if (!newShortcut) return;

    const group: Record<string, any> = GLOBAL.isVirtual
        ? GLOBAL.shortcutData[groupIndex] ?? {}
        : foundry.utils.deepClone(getShortcutsSets().at(GLOBAL.selectedSet)?.[groupIndex]) ?? {};

    if (newShortcut.type === "attack") {
        const wasSplit =
            (shortcut && !shortcut.isEmpty && shortcut.type !== "attack") ||
            Object.values(group).some((x) => "type" in x && x.type !== "attack");

        if (wasSplit) {
            for (const key of Object.keys(group)) {
                if (key === index) continue;
                delete group[key];
                group[`-=${key}`] = true;
            }
        }
    }

    if (group[index]) {
        const removedKeys: Record<string, any> = {};

        for (const key in group[index]) {
            if (key in newShortcut) continue;
            removedKeys[`-=${key}`] = true;
        }

        foundry.utils.mergeObject(newShortcut, removedKeys);
    }

    group[index] = newShortcut;

    if (GLOBAL.isVirtual) {
        GLOBAL.shortcutData[groupIndex] = group;
        overrideShortcutData.call(this);
    } else {
        await setShortcuts(group, groupIndex);
    }
}

async function fillShortcut(
    this: PF2eHudPersistent,
    groupIndex: Maybe<number | string>,
    index: Maybe<number | string>,
    cached: ShortcutCache
): Promise<Shortcut | EmptyShortcut> {
    index = String(index);
    groupIndex = String(groupIndex);

    const emptyData: EmptyShortcut = {
        index,
        groupIndex,
        isEmpty: true,
    };

    const actor = this.actor as NPCPF2e;

    const returnShortcut = async (shortcutData: ShortcutData) => {
        const shortcut = await createShortcut.call(this, shortcutData, cached);
        return shortcut;
    };

    const strike = actor.system.actions[Number(groupIndex)];
    if (strike) {
        const shortcutData = createStrikeShortcutData(groupIndex, index, strike, false);
        return returnShortcut(shortcutData);
    }

    const actions = [
        ["action", "autoFillActions"],
        ["reaction", "autoFillReactions"],
    ] as const;
    for (const [type, setting] of actions) {
        cached.fillActions ??= {};
        cached.fillActions[type] ??= { setting: this.getSetting(setting), index: 0 };
        if (!cached.fillActions[type]!.setting) continue;

        const action = actor.itemTypes.action
            .filter((x) => x.system.actionType.value === type)
            .at(cached.fillActions[type]!.index++);

        if (action) {
            const shortcutData: ActionShortcutData = {
                type: "action",
                index,
                groupIndex,
                itemId: action.id,
                name: action.name,
                img: getActionImg(action, true),
                effectUuid: undefined,
            };

            return returnShortcut(shortcutData);
        }
    }

    const checkSpells = async () => {
        const entryData = await actor.spellcasting.regular.at(0)?.getSheetData();
        if (!entryData) return emptyData;

        cached.spells ??= { groupIndex: 0, index: 0 };

        let spellGroup = entryData.groups.at(cached.spells.groupIndex);

        while (spellGroup && cached.spells.index >= spellGroup.active.length) {
            cached.spells.index = 0;
            spellGroup = entryData.groups.at(++cached.spells.groupIndex);
        }

        if (spellGroup) {
            const slotIndex = cached.spells.index++;
            const active = spellGroup.active[slotIndex]!;

            const shortcutData: SpellShortcutData = {
                type: "spell",
                index,
                groupIndex,
                itemType: "spell",
                entryId: entryData.id,
                groupId: spellGroup.id,
                itemId: active.spell.id,
                slotId: entryData.isPrepared ? slotIndex : undefined,
                castRank:
                    active.castRank ??
                    active.spell.system.location.heightenedLevel ??
                    active.spell.rank,
            };

            return returnShortcut(shortcutData);
        }
    };

    const checkConsumables = () => {
        cached.consumable ??= 0;

        const consumable = actor.itemTypes.consumable.at(cached.consumable++);
        if (!consumable || consumable.category === "ammo") return emptyData;

        const shortcutData: TemporaryConsumableShortcutData = {
            type: "consumable",
            itemId: consumable.id,
            index,
            groupIndex,
        };

        return returnShortcut(shortcutData);
    };

    cached.autoFillType ??= this.getSetting("autoFillType");

    const checks =
        cached.autoFillType === "one"
            ? [checkSpells, checkConsumables]
            : [checkConsumables, checkSpells];

    for (const checkFn of checks) {
        const result = await checkFn();
        if (result && "type" in result) return result;
    }

    return emptyData;
}

async function fillShortcuts(this: PF2eHudPersistent) {
    GLOBAL.shortcutData = {};
    const cached: ShortcutCache = {};
    const nbSlots = this.getSetting("shortcutSlots");

    for (const groupIndex of R.range(0, nbSlots)) {
        let isAttack = false;

        for (const index of R.range(0, 4)) {
            const shortcut: Shortcut | EmptyShortcut = isAttack
                ? {
                      index: String(index),
                      groupIndex: String(groupIndex),
                      isEmpty: true,
                  }
                : await fillShortcut.call(this, groupIndex, index, cached);

            if (index === 0 && !shortcut.isEmpty && shortcut.type === "attack") {
                isAttack = true;
            }
        }
    }

    return overrideShortcutData.call(this);
}

function createStrikeShortcutData(
    groupIndex: string,
    index: string,
    strike: NPCStrike | CharacterStrike,
    variant: boolean
): StrikeShortcutData {
    return {
        type: "attack",
        index,
        variant,
        groupIndex,
        itemId: strike.item.id,
        slug: strike.slug,
        img: strike.item.img,
        name: `${game.i18n.localize("PF2E.WeaponStrikeLabel")}: ${strike.label}`,
    };
}

async function createShortcutFromSet<T extends Shortcut>(
    this: PF2eHudPersistent,
    groupIndex: number,
    index: number,
    cached: CreateShortcutCache,
    shortcutSet?: UserShortcutsData
) {
    const shortcutData = shortcutSet?.[groupIndex]?.[index] ?? {
        groupIndex: String(groupIndex),
        index: String(index),
    };
    return createShortcut.call(this, shortcutData, cached) as Promise<T | EmptyShortcut>;
}

async function createShortcut<T extends Shortcut>(
    this: PF2eHudPersistent,
    shortcutData: ShortcutData | { groupIndex: string; index: string },
    cached: CreateShortcutCache
): Promise<T | EmptyShortcut> {
    const { groupIndex, index } = shortcutData;
    const throwError = () => {
        MODULE.throwError(
            `an error occured while trying to access shortcut ${groupIndex}/${index}`
        );
    };

    const actor = this.actor as CreaturePF2e;
    if (!actor || !groupIndex || isNaN(Number(groupIndex)) || !index || isNaN(Number(index))) {
        return throwError();
    }

    const emptyData: EmptyShortcut = {
        index,
        groupIndex,
        isEmpty: true,
    };

    if (!("type" in shortcutData)) return emptyData;

    const returnShortcut = async (shortcut: Shortcut) => {
        if (!shortcut.isEmpty) {
            foundry.utils.setProperty(GLOBAL.shortcutData, `${groupIndex}.${index}`, shortcutData);
        }

        return shortcut as T;
    };

    switch (shortcutData.type) {
        case "skill": {
            const item = await fromUuid(shortcutData.itemUuid);
            if (!item) return emptyData;

            if (!isInstanceOf(item, "ItemPF2e") || !item.isOfType("action", "feat", "lore")) {
                return throwError();
            }

            let name = (() => {
                if (!shortcutData.statistic) return "";

                const statisticLabel = game.i18n.localize(
                    shortcutData.statistic === "perception"
                        ? "PF2E.PerceptionLabel"
                        : CONFIG.PF2E.skills[shortcutData.statistic].label
                );

                return `${statisticLabel}: `;
            })();

            if (shortcutData.variant) {
                const variant = getSkillVariantName(shortcutData.actionId, shortcutData.variant);
                name += `${variant} (${item.name})`;
            } else {
                name += item.name;
            }

            if (shortcutData.map) {
                const mapLabel = getMapLabel(shortcutData.map, shortcutData.agile);
                name += ` (${mapLabel})`;
            }

            const isLore = item.isOfType("lore");

            if (isLore) {
                name = `${game.i18n.localize("PF2E.Lore")}: ${name}`;
            }

            const actionCost = isLore
                ? undefined
                : (shortcutData.variant &&
                      ACTION_VARIANTS[shortcutData.actionId]?.[shortcutData.variant]?.cost) ||
                  item?.actionCost;

            const img = isLore
                ? ACTION_IMAGES.lore
                : ACTION_IMAGES[shortcutData.actionId] ??
                  game.pf2e.actions.get(shortcutData.actionId)?.img ??
                  getActionImg(item);

            return {
                ...shortcutData,
                isDisabled: false,
                isFadedOut: false,
                item,
                name,
                img,
                cost: getCost(actionCost),
            } satisfies SkillShortcut as T;
        }

        case "action": {
            const item = actor.items.get(shortcutData.itemId);
            if (item && !item.isOfType("action", "feat")) return throwError();

            const name = item?.name ?? shortcutData.name;
            const frequency = item ? getActionFrequency(item) : undefined;
            const isStance = !!item && actor.isOfType("character") && isValidStance(item);
            const disabled = !item || frequency?.value === 0;

            const isActive = (() => {
                const effectUUID = shortcutData.effectUuid;
                if (!item || !effectUUID || !isStance) return null;
                return hasItemWithSourceId(actor, effectUUID, "effect");
            })();

            const hasEffect = (() => {
                if (!item || isActive !== null || !item.system.selfEffect) return false;
                return hasItemWithSourceId(actor, item.system.selfEffect.uuid, "effect");
            })();

            if (isStance) {
                GLOBAL.hasStances = true;
            }

            const cannotUseStances = isStance && !canUseStances(actor);

            return returnShortcut({
                ...shortcutData,
                isDisabled: disabled,
                isFadedOut: disabled || cannotUseStances,
                item,
                isActive,
                img: item ? getActionImg(item, true) : shortcutData.img,
                name: frequency ? `${name} - ${frequency.label}` : name,
                frequency,
                hasEffect,
                cost: getCost(item?.actionCost),
                subtitle: cannotUseStances ? localize("sidebars.actions.outOfCombat") : undefined,
            } satisfies ActionShortcut as T);
        }

        case "spell": {
            const { itemId, entryId, groupId, slotId } = shortcutData;
            const collection = (actor as CreaturePF2e).spellcasting.collections.get(entryId);
            const spell = collection?.get(itemId);
            const entry = collection?.entry;

            if (
                !spell ||
                !entry ||
                !collection ||
                isNaN(shortcutData.castRank) ||
                !shortcutData.castRank.between(1, 10)
            ) {
                return emptyData;
            }

            const castRank = shortcutData.castRank as OneToTen;

            cached.rankLabel ??= {};
            cached.rankLabel[castRank] ??= getRankLabel(castRank);
            const name = `${spell.name} - ${cached.rankLabel[castRank]}`;

            cached.spellcasting ??= {};
            cached.spellcasting[entryId] ??= await entry.getSheetData();
            const entrySheetData = cached.spellcasting[entryId] as SpellcastingSheetData;

            cached.dailiesModule ??= getActiveModule("pf2e-dailies");
            const dailiesModule = cached.dailiesModule as Maybe<PF2eDailiesModule>;

            cached.entryLabel ??= {};
            cached.entryLabel[entryId] ??= entrySheetData.statistic?.dc.value
                ? `${entry.name} - ${game.i18n.format("PF2E.DCWithValue", {
                      dc: entrySheetData.statistic?.dc.value,
                      text: "",
                  })}`
                : entry.name;
            const entryLabel = cached.entryLabel[entryId] as string;

            const isCantrip = spell.isCantrip;
            const isFocus = entrySheetData.isFocusPool;
            const isConsumable = entrySheetData.category === "items";
            const isPrepared = !!entrySheetData.isPrepared;
            const isFlexible = entrySheetData.isFlexible;
            const isCharges = entrySheetData.category === "charges";
            const isStaff = !!entrySheetData.isStaff;
            const isBroken = !isCantrip && isCharges && !dailiesModule;
            const isInnate = entrySheetData.isInnate;

            const canCastRank = (() => {
                if (!isStaff || !dailiesModule) return false;

                cached.canCastRank ??= {};
                cached.canCastRank[castRank] ??= !!dailiesModule.api.canCastRank(
                    actor as CharacterPF2e,
                    castRank
                );

                return !!cached.canCastRank[castRank];
            })();

            const group = entrySheetData.groups.find((x) => x.id === groupId);
            const groupUses =
                typeof group?.uses?.value === "number" ? (group.uses as ValueAndMax) : undefined;

            const active = slotId != null ? group?.active[slotId] : undefined;

            const uses =
                isCantrip || isConsumable || (isPrepared && !isFlexible)
                    ? undefined
                    : isFocus
                    ? (actor as CreaturePF2e).system.resources?.focus
                    : isCharges && !isBroken
                    ? entrySheetData.uses
                    : isInnate && !spell.atWill
                    ? spell.system.location.uses
                    : groupUses;

            const parentType = isConsumable
                ? (spell.parentItem?.category as Maybe<"wand" | "scroll">)
                : undefined;

            const categoryIcon = isStaff
                ? "fa-solid fa-staff"
                : isCharges
                ? "fa-solid fa-bolt"
                : parentType === "wand"
                ? "fa-solid fa-wand-magic-sparkles"
                : parentType === "scroll"
                ? "fa-solid fa-scroll"
                : undefined;

            const expended =
                isCantrip || isConsumable
                    ? false
                    : isStaff
                    ? !canCastRank
                    : uses
                    ? isCharges
                        ? uses.value < castRank
                        : uses.value === 0
                    : !!active?.expended;

            const notCarried = isConsumable
                ? spell.parentItem?.carryType !== "held"
                : isStaff
                ? (entry as dailies.StaffSpellcasting).staff.carryType !== "held"
                : false;

            const parentItem = isStaff
                ? dailiesModule?.api.getStaffItem(actor as CharacterPF2e)
                : spell.parentItem;

            const annotation =
                notCarried && parentItem ? getActionAnnotation(parentItem) : undefined;

            return returnShortcut({
                ...shortcutData,
                isDisabled: expended || isBroken,
                isFadedOut: expended || isBroken || notCarried,
                rank: ROMAN_RANKS[castRank],
                img: spell.img,
                categoryIcon,
                collection,
                item: spell,
                name: annotation ? `${getAnnotationTooltip(annotation)} - ${name}` : name,
                uses,
                entryLabel,
                isBroken,
                castRank: castRank,
                isPrepared: isPrepared && !isFlexible && !isCantrip,
                cost: getCost(spell.system.time),
                notCarried,
                isStaff,
                parentItem,
                annotation,
                subtitle: entryLabel,
            } satisfies SpellShortcut as T);
        }

        case "consumable": {
            const isGeneric = "slug" in shortcutData;
            const item = isGeneric
                ? actor.itemTypes.consumable.find((item) => itemSlug(item) === shortcutData.slug)
                : actor.items.get<ConsumablePF2e<CreaturePF2e>>(shortcutData.itemId);

            if (item && !item.isOfType("consumable")) return throwError();

            if (!isGeneric && !item) return emptyData;

            cached.mustDrawConsumable ??= this.getSetting("drawConsumables");

            const quantity = item?.quantity ?? 0;
            const uses =
                item?.uses.max && (item.uses.max > 1 || item.category === "wand")
                    ? item.uses.value
                    : undefined;
            const isOutOfStock = quantity === 0 || uses === 0;
            const categoryIcon =
                item?.category === "scroll"
                    ? "fa-solid fa-scroll"
                    : item?.category === "wand"
                    ? "fa-solid fa-wand-magic-sparkles"
                    : undefined;

            const img =
                item?.system.spell?.img ?? item?.img ?? (shortcutData as { img: string }).img;

            const notCarried = !!item && cached.mustDrawConsumable && item.carryType !== "held";
            const annotation = notCarried ? getActionAnnotation(item) : undefined;

            let name = item?.name ?? (shortcutData as { name: string }).name;
            if (uses !== undefined && quantity > 1) name += ` x ${quantity}`;

            return returnShortcut({
                ...shortcutData,
                isDisabled: item?.isAmmo || isOutOfStock,
                rank: consumableRank(item, true),
                quantity: uses ?? quantity,
                categoryIcon,
                isFadedOut: isOutOfStock || notCarried,
                annotation,
                subtitle: annotation ? getAnnotationTooltip(annotation) : undefined,
                notCarried,
                isGeneric,
                uses,
                item,
                name,
                img,
                cost: getCost(item?.system.spell?.system.time),
            } satisfies ConsumableShortcut as T);
        }

        case "attack": {
            const isBlast = "elementTrait" in shortcutData;

            if (isBlast) {
                if (!actor.isOfType("character")) return throwError();

                const blast = await getBlastData(actor, shortcutData.elementTrait);
                const versatile = blast?.damageTypes.find((x) => x.selected)?.icon;

                const category = (() => {
                    if (!blast) return;

                    const tooltip = shortcutData.variant ? blast.range.label : blast.reach;

                    return {
                        type: shortcutData.variant ? "blast" : "melee",
                        tooltip,
                        value: tooltip.replace(/[^\d]/g, ""),
                    } as const;
                })();

                return returnShortcut({
                    ...shortcutData,
                    isDisabled: !blast,
                    isFadedOut: !blast,
                    isBlast: true,
                    versatile,
                    blast,
                    category,
                    hasVariants: !!blast,
                } satisfies AttackShortcut as T);
            } else {
                const { itemId, slug } = shortcutData;
                const strike = await getStrikeData(actor, { id: itemId, slug });
                const disabled = !strike;
                const isNPC = actor.isOfType("npc");

                const img = strike ? getStrikeImage(strike, isNPC) : undefined;

                const additionalEffects =
                    strike && isNPC ? (strike as ActionStrike<NPCStrike>).additionalEffects : [];

                const nameExtra = additionalEffects
                    .map((x) => game.i18n.localize(x.label))
                    .join(", ");

                const name = strike
                    ? `${game.i18n.localize("PF2E.WeaponStrikeLabel")}: ${strike.label}`
                    : shortcutData.name;

                const traits =
                    strike && isNPC
                        ? strike.traits.filter((x) => x.name !== "attack").map((x) => x.label)
                        : [];

                const versatile =
                    strike && !isNPC
                        ? (strike as ActionStrike<CharacterStrike>).versatileOptions
                        : undefined;

                return returnShortcut({
                    ...shortcutData,
                    isDisabled: disabled,
                    isFadedOut: disabled || !strike.ready || strike.quantity === 0,
                    strike,
                    versatile: versatile?.find((x) => x.selected)?.glyph,
                    img: img ?? shortcutData.img,
                    name: nameExtra ? `${name} (${nameExtra})` : name,
                    subtitle: traits.length ? traits.join(", ") : undefined,
                    hasVariants: (strike?.altUsages?.length ?? 0) > 0,
                } satisfies AttackShortcut as T);
            }
        }

        case "toggle": {
            const { domain, option } = shortcutData;
            const item = actor.items.get(shortcutData.itemId);
            const toggle = foundry.utils.getProperty<RollOptionToggle>(
                actor,
                `synthetics.toggles.${domain}.${option}`
            );
            const disabled = !item || !toggle?.enabled;
            const checked = !!toggle?.checked;
            const label = game.i18n.localize(
                `PF2E.SETTINGS.EnabledDisabled.${checked ? "Enabled" : "Disabled"}`
            );

            return returnShortcut({
                ...shortcutData,
                isDisabled: disabled,
                isFadedOut: disabled,
                checked,
                item,
                img: item?.img ?? shortcutData.img,
                name: toggle ? `${toggle.label} (${label})` : shortcutData.name,
            } satisfies ToggleShortcut as T);
        }
    }

    return emptyData;
}

async function overrideShortcutData(this: PF2eHudPersistent) {
    if (!GLOBAL.worldActor) return;

    const shortcutData = foundry.utils.deepClone(GLOBAL.shortcutData);
    await setShortcuts(shortcutData);
}

function confirmShortcut(key: string, titleData: object, contentData: object = titleData) {
    return confirmDialog({
        title: localize("persistent.main.shortcut", key, "title", titleData),
        content: localize("persistent.main.shortcut", key, "message", contentData),
    });
}

function itemSlug(item: ItemPF2e) {
    if (item.isOfType("consumable") && item.system.spell) {
        const spell = item.system.spell;
        const baseSlug = spell.system.slug ?? game.pf2e.system.sluggify(spell.name);
        const rank = consumableRank(item);
        return `${baseSlug}-rank-${rank}`;
    }
    return item.slug ?? game.pf2e.system.sluggify(item.name);
}

function consumableRank(item: Maybe<ConsumablePF2e>, roman: true): RomanRank | undefined;
function consumableRank(item: Maybe<ConsumablePF2e>, roman?: false): OneToTen | undefined;
function consumableRank(
    item: Maybe<ConsumablePF2e>,
    roman?: boolean
): RomanRank | OneToTen | undefined {
    const rank = item?.system.spell
        ? item.system.spell.system.location.heightenedLevel ?? item.system.spell.system.level.value
        : undefined;
    return rank && roman ? ROMAN_RANKS[rank] : rank;
}

function getCost(costAction: { value: string | number } | ActionCost | undefined | null) {
    if (costAction == null) return undefined;

    const value = costAction.value;
    const type = "type" in costAction ? costAction.type : undefined;
    const cost = type && type !== "action" ? type : value;

    if (cost === null) return;
    if (typeof cost === "number") return cost;
    if (["reaction", "free"].includes(cost)) return cost;

    const costValue = Number(cost);
    return isNaN(costValue) ? (cost ? "extra" : undefined) : costValue;
}

function hasStances() {
    return GLOBAL.hasStances;
}

async function copyOwnerShortcuts() {
    if (!GLOBAL.worldActor) return;

    const owner = getOwner(GLOBAL.worldActor, false)?.id;
    if (owner === game.user.id) {
        return warn("persistent.main.shortcut.owner.self");
    }

    let hasShortcuts = false;
    const shortcutSets = owner ? getShortcutsSets(owner) : [];

    for (let i = 0; i < SHORTCUTS_LIST_LIMIT; i++) {
        const shortcuts = shortcutSets[i];
        if (!shortcutsAreEmpty(shortcuts)) {
            hasShortcuts = true;
            break;
        }
    }

    if (!hasShortcuts) {
        return warn("persistent.main.shortcut.owner.none");
    }

    const updates = {};

    setFlagProperty(
        updates,
        "persistent.shortcuts",
        game.user.id,
        foundry.utils.deepClone(shortcutSets)
    );

    const automations = getAutomationUUIDs(owner);

    setFlagProperty(
        updates,
        "persistent.automation",
        game.user.id,
        foundry.utils.deepClone(automations)
    );

    return GLOBAL.worldActor.update(updates);
}

function shortcutsAreEmpty(shortcuts: Maybe<UserShortcutsData>) {
    if (!shortcuts) return true;

    for (const group of Object.values(shortcuts)) {
        if (!foundry.utils.isEmpty(group)) return false;
    }

    return true;
}

function deleteShortcuts(
    groupIndex?: string | number,
    index?: string | number
): Promise<foundry.abstract.Document | undefined> | void {
    if (!GLOBAL.worldActor) return;

    const shortcutSets = getShortcutsSets();

    if (groupIndex == null) {
        shortcutSets[GLOBAL.selectedSet] = undefined;
    } else if (index == null) {
        delete shortcutSets[GLOBAL.selectedSet]?.[groupIndex];
    } else {
        delete shortcutSets[GLOBAL.selectedSet]?.[groupIndex]?.[index];
    }

    return setFlag(GLOBAL.worldActor, "persistent.shortcuts", game.user.id, shortcutSets);
}

function setShortcuts(
    data: ShortcutData,
    groupIndex: string | number,
    index: string | number
): Promise<foundry.abstract.Document> | void;
function setShortcuts(
    data: GroupShortcutsData,
    groupIndex: string | number,
    index?: never
): Promise<foundry.abstract.Document> | void;
function setShortcuts(
    data: UserShortcutsData,
    groupIndex?: never,
    index?: never
): Promise<foundry.abstract.Document> | void;
function setShortcuts(
    data: UserShortcutsData | GroupShortcutsData | ShortcutData,
    groupIndex?: string | number,
    index?: string | number
): Promise<foundry.abstract.Document> | void {
    if (!GLOBAL.worldActor) return;

    const shortcutSets = getShortcutsSets();

    if (groupIndex == null) {
        shortcutSets[GLOBAL.selectedSet] = data as UserShortcutsData;
    } else {
        const shortcutSet = (shortcutSets[GLOBAL.selectedSet] ??= {});

        if (index == null) {
            shortcutSet[groupIndex] = data as GroupShortcutsData;
        } else {
            shortcutSet[groupIndex] ?? {};
            shortcutSet[groupIndex][index] = data as ShortcutData;
        }
    }

    return setFlag(GLOBAL.worldActor, "persistent.shortcuts", game.user.id, shortcutSets);
}

function getShortcutsSets(owner = game.user.id) {
    if (!GLOBAL.worldActor) return [];

    const shortcutSets = getFlag<UserShortcutsData | UserShortcutsData[]>(
        GLOBAL.worldActor,
        "persistent.shortcuts",
        owner
    );

    return Array.isArray(shortcutSets) ? shortcutSets.map((x) => x || undefined) : [shortcutSets];
}

async function changeShortcutsSet(direction: 1 | -1, render = true): Promise<boolean> {
    return setShortcutSet(GLOBAL.selectedSet + direction, render);
}

async function setShortcutSet(value: number, render = true): Promise<boolean> {
    if (GLOBAL.isLockedSet || !GLOBAL.worldActor) return false;

    if (value < 0 || value > SHORTCUTS_LIST_LIMIT - 1 || value === GLOBAL.selectedSet) {
        return false;
    }

    const update = setFlagProperty({}, "persistent.selectedSet", game.user.id, value);
    await GLOBAL.worldActor.update(update, { render });

    return true;
}

function getAutomationUUIDs(owner = game.user.id) {
    if (!GLOBAL.worldActor) return [];

    const flag = getFlag<(string | undefined)[]>(GLOBAL.worldActor, "persistent.automation", owner);
    return flag?.map((x) => x || undefined) ?? [];
}

function getAutomationUUID() {
    return getAutomationUUIDs(game.user.id).at(GLOBAL.selectedSet) || undefined;
}

async function getAutomatedSetIndex(owner = game.user.id) {
    const actor = GLOBAL.worldActor;
    if (!actor) return;

    const list = getAutomationUUIDs(owner);

    for (let i = 0; i < SHORTCUTS_LIST_LIMIT; i++) {
        const uuid = list.at(i);
        if (!uuid) continue;

        const item = await fromUuid(uuid);

        if (
            (item instanceof Macro && (await item.execute({ actor })) === true) ||
            (isInstanceOf(item, "ItemPF2e") &&
                hasItemWithSourceId(actor, item.sourceId ?? uuid, "effect"))
        ) {
            return i;
        }
    }
}

function getSetIndex(owner = game.user.id) {
    if (!GLOBAL.worldActor) return 0;

    const value = getFlag<number>(GLOBAL.worldActor, "persistent.selectedSet", owner) ?? 0;
    return Math.clamp(value, 0, SHORTCUTS_LIST_LIMIT - 1);
}

async function setAutomationUUID(value: string | undefined) {
    if (!GLOBAL.worldActor) return;

    const owner = game.user.id;
    const list = getAutomationUUIDs(owner);
    const current = list[GLOBAL.selectedSet];
    const newValue = value || undefined;

    if (current === newValue) return;

    list[GLOBAL.selectedSet] = newValue || undefined;

    return setFlag(GLOBAL.worldActor, "persistent.automation", owner, list);
}

function getShortcutSetIndex() {
    return GLOBAL.selectedSet;
}

type ShortcutActionEvent =
    | "toggle-damage"
    | "open-attack-popup"
    | "blast-attack"
    | "blast-damage"
    | "strike-attack"
    | "strike-damage"
    | "strike-critical"
    | "auxiliary-action"
    | "channel-elements";

type ShortcutType = "action" | "attack" | "consumable" | "spell" | "toggle" | "skill";

type CreateShortcutCache = {
    rankLabel?: Partial<Record<OneToTen, string>>;
    spellcasting?: Record<string, SpellcastingSheetData>;
    dailiesModule?: Maybe<PF2eDailiesModule>;
    entryLabel?: Record<string, string>;
    canCastRank?: Partial<Record<OneToTen, boolean>>;
    canUseStances?: boolean;
    mustDrawConsumable?: boolean;
};

type FillShortcutCache = {
    spells?: { groupIndex: number; index: number };
    consumable?: number;
    autoFillType?: AutoFillSetting;
    fillActions?: Record<string, Maybe<{ index: number; setting: boolean }>>;
};

type ShortcutCache = CreateShortcutCache & FillShortcutCache;

type GroupShortcutsData = Record<string, ShortcutData>;

type UserShortcutsData = Record<string, GroupShortcutsData>;

type ShortcutDataBase<T extends ShortcutType> = {
    type: T;
    index: string;
    groupIndex: string;
};

type SpellShortcutData = ShortcutDataBase<"spell"> & {
    itemType: string;
    itemId: string;
    castRank: number;
    entryId: string;
    slotId: number | undefined;
    groupId: "cantrips" | number;
};

type ToggleShortcutData = ShortcutDataBase<"toggle"> & {
    itemId: string;
    domain: string;
    option: string;
    name: string;
    img: string;
};

type AttackShortcutDataBase = ShortcutDataBase<"attack"> & {
    img: string;
    name: string;
    variant: boolean;
};

type StrikeShortcutData = AttackShortcutDataBase & {
    itemId: string;
    slug: string;
};

type BlastShortcutData = AttackShortcutDataBase & {
    elementTrait: ElementTrait;
};

type AttackShortcutData = BlastShortcutData | StrikeShortcutData;

type SkillShortcutData = ShortcutDataBase<"skill"> & {
    type: "skill";
    actionId: string;
    statistic?: SkillSlug | "perception";
    itemUuid: string;
    variant: string | undefined;
    map: 1 | 2 | undefined;
    agile: boolean;
    option: string | undefined;
};

type ActionShortcutData = ShortcutDataBase<"action"> & {
    itemId: string;
    name: string;
    img: string;
    effectUuid: string | undefined;
};

type ConsumableShortcutDataBase = ShortcutDataBase<"consumable">;

type GenericConsumableShortcutData = ConsumableShortcutDataBase & {
    slug: string;
    img: string;
    name: string;
};

type TemporaryConsumableShortcutData = ConsumableShortcutDataBase & {
    itemId: string;
};

type ConsumableShortcutData = GenericConsumableShortcutData | TemporaryConsumableShortcutData;

type CostValue = number | string | undefined;

type ShortcutData =
    | ConsumableShortcutData
    | AttackShortcutData
    | ToggleShortcutData
    | ActionShortcutData
    | SpellShortcutData
    | SkillShortcutData;

type BaseShortCut<T extends ShortcutType> = ShortcutDataBase<T> & {
    name: string;
    subtitle?: string;
    css?: string[];
    isEmpty?: boolean;
    img: string;
    isDisabled: boolean;
    isFadedOut: boolean;
};

type SpellShortcut = BaseShortCut<"spell"> &
    SpellShortcutData & {
        categoryIcon: string | undefined;
        collection: SpellCollection<CreaturePF2e>;
        item: SpellPF2e<CreaturePF2e>;
        rank: string;
        uses: ValueAndMax | undefined;
        entryLabel: string;
        isBroken: boolean;
        isPrepared: boolean;
        cost: CostValue;
        castRank: OneToTen;
        notCarried: boolean;
        isStaff: boolean;
        parentItem: Maybe<ConsumablePF2e<CreaturePF2e> | PhysicalItemPF2e<CreaturePF2e>>;
        annotation: AuxiliaryActionPurpose;
    };

type SkillShortcut = BaseShortCut<"skill"> &
    SkillShortcutData & {
        item: AbilityItemPF2e | FeatPF2e | LorePF2e;
        cost: CostValue;
    };

type ActionShortcut = BaseShortCut<"action"> &
    ActionShortcutData & {
        item: FeatPF2e<ActorPF2e> | AbilityItemPF2e<ActorPF2e> | undefined;
        cost: CostValue;
        isActive: boolean | null;
        hasEffect: boolean;
        frequency: Maybe<{
            max: number;
            value: number;
            label: string;
        }>;
    };

type ToggleShortcut = BaseShortCut<"toggle"> &
    ToggleShortcutData & {
        item: ItemPF2e | undefined;
        checked: boolean;
    };

type SkillDropData = Partial<SkillVariantDataset> & {
    actionId?: string;
    statistic?: SkillSlug | "perception";
    isStatistic?: true;
    actorLess?: StringBoolean;
    option?: string;
};

type DropData = HotbarDropData & {
    fromSidebar?: boolean;
    entryId?: string;
    castRank?: StringNumber;
    slotId?: StringNumber;
    groupId?: StringNumber | "cantrips";
    itemId?: string;
    effectUuid?: string;
} & SkillDropData;

type RomanRank = (typeof ROMAN_RANKS)[number];

type ConsumableShortcut = BaseShortCut<"consumable"> &
    ConsumableShortcutData & {
        item: ConsumablePF2e<CreaturePF2e> | undefined;
        cost: CostValue;
        quantity: number;
        uses: number | undefined;
        isGeneric: boolean;
        rank: RomanRank | undefined;
        categoryIcon: string | undefined;
        notCarried: boolean;
        annotation: AuxiliaryActionPurpose | undefined;
    };

type BaseAttackShortcut = BaseShortCut<"attack"> &
    AttackShortcutData & {
        img: string;
        name: string;
        versatile: Maybe<string>;
        hasVariants: boolean;
    };

type BlastShortcut = BaseAttackShortcut & {
    isBlast: true;
    blast: ActionBlast | undefined;
    category: Maybe<{
        type: "melee" | "blast";
        tooltip: string;
        value: string;
    }>;
};

type StrikeShortcut = BaseAttackShortcut & {
    strike: ActionStrike | undefined;
    subtitle: string | undefined;
};

type AttackShortcut = BlastShortcut | StrikeShortcut;

type Shortcut =
    | ConsumableShortcut
    | AttackShortcut
    | ToggleShortcut
    | ActionShortcut
    | SpellShortcut
    | SkillShortcut;

type EmptyShortcut = { index: string; groupIndex: string; isEmpty: true };

type ShortcutGroup = {
    split: boolean;
    shortcuts: (Shortcut | { index: string; groupIndex: string })[];
};

type ShortcutsContext = PersistentContext & {
    shortcutGroups: ShortcutGroup[];
    isVirtual: boolean;
    variantLabel: typeof variantLabel;
};

type ShortcutsGlobal = {
    shortcuts: Record<string, Shortcut | EmptyShortcut>;
    shortcutData: UserShortcutsData;
    isVirtual: boolean;
    hasStances: boolean;
    selectedSet: number;
    isLockedSet: boolean;
    worldActor: PersistentHudActor | null;
};

type AutoFillSetting = "one" | "two";

export {
    activateShortcutsListeners,
    changeShortcutsSet,
    copyOwnerShortcuts,
    deleteShortcuts,
    fillShortcuts,
    getAutomationUUID,
    getShortcutSetIndex,
    hasStances,
    prepareShortcutsContext,
    setAutomationUUID,
    setShortcutSet,
    SHORTCUTS_LIST_LIMIT,
};
export type { AutoFillSetting, ShortcutsContext };