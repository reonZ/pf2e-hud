import { BaseHudPopup } from "./base";
import ux = foundry.applications.ux;
import { createHTMLElement, NPCPF2e, R, render, traitSlugToObject, TraitViewData } from "foundry-helpers";

class NpcNotesHudPopup extends BaseHudPopup<NPCPF2e> {
    get title(): string {
        return `${this.actor.name} - ${game.i18n.localize("PF2E.NPC.NotesTab")}`;
    }

    protected async _prepareContext(_options: fa.ApplicationRenderOptions): Promise<NpcNotesHudContext> {
        const actor = this.actor;
        const rollData = actor.getRollData();
        const system = (actor as NPCPF2e).system;
        const whitelist = Object.keys(CONFIG.PF2E.creatureTraits);

        const publicNotes = await ux.TextEditor.implementation.enrichHTML(system.details.publicNotes, {
            rollData,
            secrets: actor.isOwner,
        });

        const privateNotes = await ux.TextEditor.implementation.enrichHTML(system.details.privateNotes, { rollData });

        const traits = R.pipe(
            system.traits.value,
            R.filter((trait) => whitelist.includes(trait)),
            R.map((trait) => traitSlugToObject(trait, CONFIG.PF2E.creatureTraits)),
        );

        return {
            blurb: system.details.blurb.trim(),
            privateNotes: actor.isOwner && privateNotes.trim(),
            publicNotes: publicNotes.trim(),
            traits,
        };
    }

    protected async _renderHTML(
        context: NpcNotesHudContext,
        _options: fa.ApplicationRenderOptions,
    ): Promise<HTMLElement> {
        const template = await render("popup/npc-notes", context);
        const content = await ux.TextEditor.implementation.enrichHTML(template);

        return createHTMLElement("div", {
            content,
            classes: ["text-content"],
        });
    }
}

type NpcNotesHudContext = fa.ApplicationRenderContext & {
    blurb: string;
    privateNotes: string | false;
    publicNotes: string;
    traits: TraitViewData[];
};

export { NpcNotesHudPopup };
