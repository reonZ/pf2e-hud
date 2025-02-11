import { getSetting, setSetting, userIsActiveGM } from "module-helpers";
import { ModuleMigration } from "module-helpers/dist/migration";
import { HealthStatus } from "../utils/health-status";

export default {
    version: 1.3,
    migrateSettings: migrateHealStatus,
} satisfies ModuleMigration;

async function migrateHealStatus(): Promise<string[] | undefined> {
    if (!userIsActiveGM()) return;

    const setting = fu.deepClone(getSetting<Maybe<HealthStatus>>("healthStatusData"));
    if (!setting) return;

    setting.entries.findSplice((entry) => entry.marker === 1);

    setting.entries = setting.entries.map((entry) => {
        return {
            label: entry.label,
            marker: Math.max(entry.marker, 1),
        };
    });

    await setSetting("healthStatusData", setting);

    return ["pf2e-hud.healthStatusData"];
}
