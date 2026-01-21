import {
    CreaturePF2e,
    R,
    render,
    ScenePF2e,
    SYSTEM,
    TokenDocumentPF2e,
    TokenPF2e,
    warning,
    ZeroToFour,
} from "module-helpers";

const SEARCH_UUID = SYSTEM.uuid(
    "Compendium.pf2e.actionspf2e.Item.TiNDYUGlMmxzxBYU",
    "Compendium.sf2e.actions.Item.TiNDYUGlMmxzxBYU",
);

async function rollGroupPerception() {
    if (!game.user.isGM) return;

    const controlled = R.pipe(
        canvas.tokens.controlled,
        R.filter((token): token is ControlledToken => !!token.actor?.isOfType("creature")),
        R.map((token) => token.actor),
    );

    const actors = controlled.length
        ? controlled
        : (game.actors.party?.members.filter((actor) => actor.isOfType("creature")) ?? []);

    const data = await Promise.all(
        actors.map(async (actor): Promise<ActorData> => {
            const perception = actor.getStatistic("perception");
            const uuid = SEARCH_UUID();

            const isSearching =
                actor.isOfType("character") &&
                actor.system.exploration.find((id) => actor.items.get(id)?.sourceId === uuid);

            const roll = await perception.roll({
                createMessage: false,
                skipDialog: true,
            });

            return {
                die: roll?.dice[0].total ?? 1,
                name: actor.name,
                search: !!isSearching,
                rank: perception.rank ?? 0,
                roll: roll?.total ?? 0,
            };
        }),
    );

    if (!data.length) {
        return warning("no-selection");
    }

    const ChatMessagePF2e = getDocumentClass("ChatMessage");

    ChatMessagePF2e.create({
        content: await render("group-perception", { actors: data }),
        whisper: ChatMessage.getWhisperRecipients("GM"),
    });
}

// function getFamiliarPerceptionRank(actor: FamiliarPF2e): ZeroToFour {
//     return actor.master?.getStatistic("perception").rank ?? 0;
// }

// function getNpcPerceptionRank(actor: NPCPF2e): ZeroToFour {
//     const level = actor.level;
//     return level < 7 ? 1 : level < 13 ? 2 : 3;
// }

type ControlledToken = TokenPF2e<TokenDocumentPF2e<ScenePF2e>> & {
    actor: CreaturePF2e;
};

type ActorData = {
    die: number;
    name: string;
    search: boolean;
    rank: ZeroToFour;
    roll: number;
};

export { rollGroupPerception };
