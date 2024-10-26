import { addListener, getFlag, htmlQuery } from "foundry-pf2e";
import { PersistentContext, PersistentRenderOptions, PF2eHudPersistent } from "../persistent";
import { getStatsHeaderExtras, StatsHeaderExtras } from "../shared/advanced";
import { getStatsHeader, StatsHeader } from "../shared/base";
import { addStatsHeaderListeners } from "../shared/listeners";
import { AvatarData, editAvatar } from "../../utils/avatar";
import { PersistentPart } from "./part";

class PersistentPortrait extends PersistentPart<PortraitContext | PersistentContext> {
    get classes() {
        return ["app"];
    }

    async prepareContext(
        context: PersistentContext,
        options: PersistentRenderOptions
    ): Promise<PersistentContext | PortraitContext> {
        const actor = this.actor;

        if (!actor) {
            return context;
        }

        const data: PortraitContext = {
            ...context,
            ...getStatsHeader(actor),
            ...getStatsHeaderExtras(actor, this),
            avatar: actor.img,
            name: actor.name,
        };

        return data;
    }

    activateListeners(html: HTMLElement): void {
        const actor = this.actor;
        if (!actor) return;

        addStatsHeaderListeners(actor, html);

        addListener(html, "[data-action='edit-avatar']", () => {
            editAvatar(actor);
        });

        addListener(html, ".avatar", "drop", (event) => {
            actor.sheet._onDrop(event);
        });

        if (game.ready) {
            requestAnimationFrame(() => {
                this.#setupAvatar(html);
            });
        } else {
            Hooks.once("ready", () => {
                this.#setupAvatar(html);
            });
        }
    }

    #setupAvatar(html: HTMLElement) {
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
}

type PortraitContext = PersistentContext &
    StatsHeader &
    StatsHeaderExtras & {
        avatar: string;
        name: string;
    };

export { PersistentPortrait };
