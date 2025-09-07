import {
    CheckRoll,
    CreaturePF2e,
    R,
    render,
    ScenePF2e,
    TokenDocumentPF2e,
    TokenPF2e,
    warning,
    ZeroToFour,
} from "module-helpers";

async function rollGroupPerception() {
    if (!game.user.isGM) return;

    const controlled = R.pipe(
        canvas.tokens.controlled,
        R.filter((token): token is ControlledToken => !!token.actor?.isOfType("creature")),
        R.map((token) => token.actor)
    );

    const actors = controlled.length
        ? controlled
        : game.actors.party?.members.filter((actor) => actor.isOfType("creature")) ?? [];

    const data = await Promise.all(
        actors.map(async (actor): Promise<ActorData> => {
            const perception = actor.getStatistic("perception");
            const roll = (await perception.roll({ createMessage: false })) as Rolled<CheckRoll>;
            const rank =
                perception.rank ??
                (actor.isOfType("familiar") ? actor.master?.getStatistic("perception").rank : 0);

            return {
                die: roll.dice[0].total ?? 1,
                name: actor.name,
                rank: rank ?? 0,
                roll: roll.total,
            };
        })
    );

    if (!data.length) {
        return warning("group-perception.no-selection");
    }

    const ChatMessagePF2e = getDocumentClass("ChatMessage");

    ChatMessagePF2e.create({
        content: await render("group-perception", { actors: data }),
        whisper: ChatMessage.getWhisperRecipients("GM"),
    });
}

type ControlledToken = TokenPF2e<TokenDocumentPF2e<ScenePF2e>> & {
    actor: CreaturePF2e;
};

type ActorData = {
    die: number;
    name: string;
    rank: ZeroToFour;
    roll: number;
};

export { rollGroupPerception };
