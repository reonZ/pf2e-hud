import { R, setSetting, userIsActiveGM } from "module-helpers";
import { ModuleMigration } from "module-helpers/dist/migration";
import { getDefaultHealthStatus } from "../utils/health-status";

export default {
    version: 1.28,
    migrateSettings: migrateHealStatus,
} satisfies ModuleMigration;

async function migrateHealStatus(): Promise<string[] | undefined> {
    if (!userIsActiveGM()) return;

    const previous = game.settings.storage.get("world").getSetting("pf2e-hud.healthStatus")?.value;
    if (!R.isString(previous)) return;

    const statuses = R.pipe(
        previous,
        R.split(","),
        R.map((status) => status.trim()),
        R.filter(R.isTruthy)
    );

    if (statuses.length >= 3) {
        await setSetting("healthStatusData", getDefaultHealthStatus(statuses));
        return ["pf2e-hud.healthStatusData"];
    } else {
        await setSetting("healthStatusEnabled", false);
        return ["pf2e-hud.healthStatusEnabled"];
    }
}
