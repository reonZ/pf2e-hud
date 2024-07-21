import { hasItemWithSourceId, localize, promptDialog, templateLocalize, warn } from "foundry-pf2e";

const RESOLVE_UUID = "Compendium.pf2e.feats-srd.Item.jFmdevE4nKevovzo";

async function useResolve(actor: CharacterPF2e) {
    const name = actor.name;

    const checkCurrentData = () => {
        const stamina = actor.attributes.hp.sp;
        if (!stamina || stamina.value >= stamina.max) {
            warn("hud.resolve.full", { name });
            return null;
        }

        const resolve = actor.system.resources.resolve;
        if (!resolve || resolve.value < 1) {
            const warning = game.i18n.format("PF2E.Actions.SteelYourResolve.NoStamina", { name });
            ui.notifications.warn(warning);
            return null;
        }

        return { stamina, resolve };
    };

    if (!checkCurrentData()) return;

    const data = await promptDialog<{ pick: "breather" | "steel" }>({
        classes: ["pf2e-hud-resolve"],
        title: localize("hud.resolve.title"),
        content: "dialogs/resolve",
        data: {
            i18n: templateLocalize("dialogs.resolve"),
            hasSteel: hasItemWithSourceId(actor, RESOLVE_UUID, "feat"),
        },
    });
    if (!data) return;

    const stats = checkCurrentData();
    if (!stats) return;

    const ratio = `${stats.stamina.value}/${stats.stamina.max}`;

    const [updates, message] = (() => {
        if (data.pick === "breather") {
            return [
                {
                    "system.attributes.hp.sp.value": stats.stamina.max,
                    "system.resources.resolve.value": stats.resolve.value - 1,
                },
                localize("hud.resolve.breather.used", { name, ratio }),
            ];
        } else {
            const newSP = stats.stamina.value + Math.floor(stats.stamina.max / 2);
            return [
                {
                    "system.attributes.hp.sp.value": Math.min(newSP, stats.stamina.max),
                    "system.resources.resolve.value": stats.resolve.value - 1,
                },
                game.i18n.format("PF2E.Actions.SteelYourResolve.RecoverStamina", { name, ratio }),
            ];
        }
    })();

    const ChatMessagePF2e = getDocumentClass("ChatMessage");
    ChatMessagePF2e.create({
        content: message,
        author: game.user.id,
        speaker: ChatMessagePF2e.getSpeaker({ actor }),
    });

    actor.update(updates);
}

export { useResolve };
