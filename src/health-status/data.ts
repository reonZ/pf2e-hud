import { HealthData } from "hud";
import {
    ArrayField,
    localize,
    ModelPropFromDataField,
    R,
    SourcePropFromDataField,
} from "module-helpers";
import fields = foundry.data.fields;

class HealthStatusEntriesField extends fields.ArrayField<
    fields.SchemaField<HealthStatusEntrySchema>,
    SourcePropFromDataField<fields.SchemaField<HealthStatusEntrySchema>>[],
    ModelPropFromDataField<fields.SchemaField<HealthStatusEntrySchema>>[],
    true,
    false,
    true
> {
    constructor(options?: any, context?: fields.DataFieldContext) {
        super(
            new fields.SchemaField({
                label: new fields.StringField({
                    required: true,
                    nullable: false,
                }),
                marker: new fields.NumberField({
                    required: true,
                    nullable: false,
                    min: 1,
                    max: 99,
                }),
            }),
            options,
            context
        );
    }

    static get _defaults() {
        return Object.assign(super._defaults, {
            required: true,
            nullable: false,
        });
    }

    getInitialValue(data?: object): SourceFromSchema<HealthStatusEntrySchema>[] {
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
            })
        );
    }
}

class HealthStatus extends foundry.abstract.DataModel<null, HealthStatusSchema> {
    static DEFAULT_LABEL = "???";

    static defineSchema(): HealthStatusSchema {
        return {
            dead: new fields.StringField({
                required: true,
                nullable: false,
                blank: true,
                initial: () => {
                    return getEntry(0);
                },
            }),
            enabled: new fields.BooleanField({
                required: true,
                nullable: false,
                initial: true,
            }),
            full: new fields.StringField({
                required: true,
                nullable: false,
                blank: true,
                initial: () => {
                    return getEntry(-1);
                },
            }),
            entries: new HealthStatusEntriesField(),
        };
    }

    static filterSourceEntries(source: HealthStatusSource) {
        const entries = R.pipe(
            source.entries,
            R.filter((entry) => R.isNumber(entry.marker)),
            R.sortBy(R.prop("marker"))
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

    _initializeSource(
        data: object,
        options?: DataModelConstructionOptions<null> | undefined
    ): HealthStatusSource {
        const source = super._initializeSource(data, options);

        if (source.entries.length === 0) {
            source.entries.push({ label: HealthStatus.DEFAULT_LABEL, marker: 50 });
        } else {
            HealthStatus.filterSourceEntries(source);
        }

        return source;
    }

    getEntryFromHealthData(data: HealthData): string {
        const { max, ratio, value } = data.total;

        if (value === 0) {
            return this.dead;
        }

        if (value >= max) {
            return this.full;
        }

        const percent = ratio * 100;
        const entry = R.pipe(
            this.entries,
            R.sortBy([R.prop("marker"), "desc"]),
            R.find((entry) => percent >= entry.marker)
        );

        return entry?.label ?? HealthStatus.DEFAULT_LABEL;
    }
}

function getEntries(): string[] {
    return localize("health-status.default").split(",");
}

function getEntry(index: number): string {
    return getEntries().at(index)?.trim() ?? "";
}

interface HealthStatus
    extends foundry.abstract.DataModel<null, HealthStatusSchema>,
        ModelPropsFromSchema<HealthStatusSchema> {}

type HealthStatusEntrySchema = {
    marker: fields.NumberField<number, number, true, false, true>;
    label: fields.StringField<string, string, true, false, true>;
};

type HealthStatusSchema = {
    enabled: fields.BooleanField;
    dead: fields.StringField<string, string, true, false, true>;
    full: fields.StringField<string, string, true, false, true>;
    entries: ArrayField<fields.SchemaField<HealthStatusEntrySchema>, true, false, true>;
};

type HealthStatusSource = SourceFromSchema<HealthStatusSchema>;

export { HealthStatus };
export type { HealthStatusSource };
