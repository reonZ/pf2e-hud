import { localize, R, z } from "foundry-helpers";
import { HealthData } from "hud";

const HEALTH_STATUS_DEFAULT_LABEL = "???";

const zHealthStatusEntry = z.object({
    label: z.string(),
    marker: z.number().min(1).max(99).multipleOf(1),
});

const zHealthStatusEntries = z.array(zHealthStatusEntry).catch(() => {
    const entries = getEntries();
    const nbEntries = entries.length - 1;

    if (nbEntries < 1) {
        return [];
    }

    const segment = 100 / (nbEntries - 1);

    return R.pipe(
        R.range(1, nbEntries),
        R.map((i) => {
            return {
                label: entries[i].trim(),
                marker: Math.max(Math.floor((i - 1) * segment), 1),
            };
        }),
    );
});

const zHealthStatusData = z.object({
    dead: z.string().catch(() => getEntry(0)),
    enabled: z.boolean().catch(true),
    full: z.string().catch(() => getEntry(-1)),
    entries: zHealthStatusEntries,
});

const zHealthStatus = zHealthStatusData.transform((data) => {
    if (data.entries.length === 0) {
        data.entries.push({ label: HEALTH_STATUS_DEFAULT_LABEL, marker: 50 });
    } else {
        filterHealthStatusSourceEntries(data);
    }

    return data;
});

function filterHealthStatusSourceEntries(source: HealthStatusSource) {
    const entries = R.pipe(
        source.entries,
        R.filter((entry) => R.isNumber(entry.marker)),
        R.sortBy(R.prop("marker")),
    );

    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        const previous = entries[i - 1]?.marker ?? 0;
        const next = entries[i + 1]?.marker ?? 100;

        if (entry.marker <= previous) {
            entry.marker = previous + 1;
        }

        if (entry.marker >= next) {
            entries.splice(i, 1);
        }
    }

    source.entries = entries;
}

function getEntryFromHealthData(health: HealthData, status: HealthStatus): string {
    const { max, ratio, value } = health.total;

    if (value === 0) {
        return status.dead;
    }

    if (value >= max) {
        return status.full;
    }

    const percent = Math.max(ratio * 100, 1);
    const entry = R.pipe(
        status.entries,
        R.sortBy([R.prop("marker"), "desc"]),
        R.find((entry) => percent >= entry.marker),
    );

    return entry?.label ?? HEALTH_STATUS_DEFAULT_LABEL;
}

function getEntries(): string[] {
    return localize("health-status.default").split(",");
}

function getEntry(index: number): string {
    return getEntries().at(index)?.trim() ?? "";
}

type HealthStatusSource = z.input<typeof zHealthStatusData>;
type HealthStatus = z.output<typeof zHealthStatusData>;

export {
    filterHealthStatusSourceEntries,
    getEntryFromHealthData,
    HEALTH_STATUS_DEFAULT_LABEL,
    zHealthStatus,
    zHealthStatusData,
};
export type { HealthStatus, HealthStatusSource };
