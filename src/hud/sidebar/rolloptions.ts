import { SidebarName } from "hud";
import { ActorPF2e, R, RollOptionToggle } from "module-helpers";

const ROLLOPTIONS_PLACEMENT = {
    actions: "actions",
    spells: "spellcasting",
    items: "inventory",
    skills: "proficiencies",
    extras: undefined,
} as const satisfies Record<SidebarName, string | undefined>;

function getRollOptionsData(actor: ActorPF2e, selected: SidebarName): RollOptionsData[] {
    const selectedPlacement = ROLLOPTIONS_PLACEMENT[selected];
    if (!selectedPlacement) return [];

    return R.pipe(
        R.values(actor.synthetics.toggles).flatMap((domain) => Object.values(domain)),
        R.filter(({ placement, option, domain }) => {
            return (
                placement === selectedPlacement &&
                (domain !== "elemental-blast" || option !== "action-cost")
            );
        }),
        R.map((toggle): RollOptionsData => {
            return {
                ...toggle,
                img: actor.items.get(toggle.itemId)?.img,
            };
        })
    );
}

type RollOptionsData = RollOptionToggle & {
    img: ImageFilePath | undefined;
};

export { getRollOptionsData };
