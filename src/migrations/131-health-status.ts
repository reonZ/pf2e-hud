import { getSetting, setSetting, userIsActiveGM } from "module-helpers";
import { ModuleMigration } from "module-helpers/dist/migration";
import { HealthStatus } from "../utils/health-status";

export default {
    version: 1.31,
    migrateSettings: migrateHealStatus,
} satisfies ModuleMigration;

async function migrateHealStatus(): Promise<string[] | undefined> {
    if (!userIsActiveGM()) return;

    const current = getSetting<Maybe<HealthStatus>>("healthStatusData");
    if (!current || current.entries.some((entry) => entry.marker === 1)) return;

    const setting = fu.deepClone(current);

    setting.entries.unshift({
        label: "???",
        marker: 1,
    });

    await setSetting("healthStatusData", setting);

    return ["pf2e-hud.healthStatusData"];
}
