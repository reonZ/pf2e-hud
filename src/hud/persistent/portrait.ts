import { addListener, getFlag, htmlQuery } from "foundry-pf2e";
import { PersistentContext, PersistentRenderOptions, PF2eHudPersistent } from "../persistent";
import { getStatsHeaderExtras, StatsHeaderExtras } from "../shared/advanced";
import { getStatsHeader, StatsHeader } from "../shared/base";
import { addStatsHeaderListeners } from "../shared/listeners";
import { AvatarData, editAvatar } from "../../utils/avatar";

function preparePortraitContext(
    this: PF2eHudPersistent,
    context: PersistentContext,
    options: PersistentRenderOptions
): PortraitContext | PersistentContext {
    const actor = this.actor;
    if (!actor) return context;

    const data: PortraitContext = {
        ...context,
        ...getStatsHeader(actor),
        ...getStatsHeaderExtras(actor, this),
        avatar: actor.img,
        name: actor.name,
    };

    return data;
}

function activatePortraitListeners(this: PF2eHudPersistent, html: HTMLElement) {
    const actor = this.actor;
    if (!actor) return;

    addStatsHeaderListeners(actor, html);

    addListener(html, "[data-action='edit-avatar']", () => {
        editAvatar(actor);
    });

    if (game.ready) {
        requestAnimationFrame(() => {
            setupAvatar.call(this, html);
        });
    } else {
        Hooks.once("ready", () => {
            setupAvatar.call(this, html);
        });
    }
}

function setupAvatar(this: PF2eHudPersistent, html: HTMLElement) {
    const actor = this.worldActor;
    const avatarElement = htmlQuery(html, ".avatar");
    if (!avatarElement || !actor) return;

    const avatarFlag = getFlag<AvatarData>(actor, "avatar");
    if (!avatarFlag) {
        avatarElement.style.backgroundImage = `url("${actor.img}")`;
        return;
    }

    const { position, src, scales } = avatarFlag;

    avatarElement.style.backgroundImage = `url("${src}")`;
    avatarElement.style.backgroundSize = `${scales.x * 100}% ${scales.y * 100}%`;

    const offsetX = position.x * avatarElement.clientWidth;
    const offsetY = position.y * avatarElement.clientHeight;

    avatarElement.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
}

type PortraitContext = PersistentContext &
    StatsHeader &
    StatsHeaderExtras & {
        avatar: string;
        name: string;
    };

export type { PortraitContext };
export { activatePortraitListeners, preparePortraitContext };
