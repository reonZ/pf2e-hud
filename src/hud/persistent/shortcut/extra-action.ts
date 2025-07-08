import { ExtraAction, getExtraAction, getExtraKeys, StatisticType } from "hud";
import { AbilityItemPF2e } from "module-helpers";
import {
    generateStatisticActionSchema,
    ShortcutSource,
    StatisticActionShortcut,
    StatisticActionShortcutSchema,
} from "..";

class ExtraActionShortcut extends StatisticActionShortcut<ExtraAction, AbilityItemPF2e> {
    static defineSchema(): ExtraActionShortcutSchema {
        return generateStatisticActionSchema("extraAction", getExtraKeys);
    }

    get title(): string {
        return this.name;
    }

    get action(): ExtraAction | undefined {
        return getExtraAction(this.sourceId);
    }

    use(event: MouseEvent): void {
        this.action?.roll(this.actor, event, this.override);
    }
}

type ExtraActionShortcutSchema = StatisticActionShortcutSchema;

type ExtraActionShortcutData = Omit<ShortcutSource<ExtraActionShortcutSchema>, "override"> & {
    override?: {
        agile?: boolean;
        statistic?: StatisticType;
    };
};

export { ExtraActionShortcut };
export type { ExtraActionShortcutData };
