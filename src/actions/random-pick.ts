import {
    CreaturePF2e,
    getFirstActiveToken,
    localize,
    panToToken,
    R,
    render,
    ScenePF2e,
    TokenDocumentPF2e,
    TokenPF2e,
    warning,
} from "module-helpers";

async function randomPick() {
    if (!game.user.isGM) return;

    const members = game.actors.party?.members ?? [];

    const controlled = R.pipe(
        canvas.tokens.controlled,
        R.filter((token): token is ControlledToken => {
            const actor = token.actor;
            return (
                !!actor?.isOfType("creature") && (actor.hasPlayerOwner || members.includes(actor))
            );
        }),
        R.map((token) => token.actor)
    );

    const actors = controlled.length
        ? controlled
        : game.actors.party?.members.filter((actor) => actor.isOfType("creature")) ?? [];

    if (!actors.length) {
        return warning("no-selection");
    }

    const roll = await new Roll(`1d${actors.length}`).evaluate();
    const pickIndex = roll.total - 1;
    const pickActor = actors[pickIndex];
    const pickToken = getFirstActiveToken(pickActor)?.object;

    if (pickToken) {
        pickToken.setTarget(true);
        panToToken(pickToken);
    }

    const data = {
        actors: actors.map((actor, i): ActorData => {
            return {
                name: actor.name,
                targeted: i === pickIndex,
            };
        }),
    };

    const ChatMessagePF2e = getDocumentClass("ChatMessage");

    ChatMessagePF2e.create({
        flavor: localize("random-pick.title"),
        content: await render("random-pick", data),
    });
}

type ControlledToken = TokenPF2e<TokenDocumentPF2e<ScenePF2e>> & {
    actor: CreaturePF2e;
};

type ActorData = {
    name: string;
    targeted: boolean;
};

export { randomPick };
