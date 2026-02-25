import { getFirstActiveToken, localize, panToToken, R, render } from "foundry-helpers";
import { ControlledToken } from ".";

async function randomPick(event?: PointerEvent) {
    if (!game.user.isGM) return;

    const members = game.actors.party?.members ?? [];

    const controlled = R.pipe(
        canvas.tokens.controlled,
        R.filter((token): token is ControlledToken => {
            const actor = token.actor;
            return !!actor?.isOfType("creature") && (actor.hasPlayerOwner || members.includes(actor));
        }),
        R.map((token) => token.actor),
    );

    const actors = controlled.length
        ? controlled
        : (game.actors.party?.members.filter((actor) => actor.isOfType("creature")) ?? []);

    if (!actors.length) {
        return localize.warning("no-selection");
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
        whisper: event?.ctrlKey ? (ChatMessage.getWhisperRecipients("GM") as any) : [],
    });
}

type ActorData = {
    name: string;
    targeted: boolean;
};

export { randomPick };
