import { PositionField, SchemaField } from "module-helpers";
import fields = foundry.data.fields;

class AvatarModel extends foundry.abstract.DataModel<null, AvatarDataSchema> {
    static defineSchema(): AvatarDataSchema {
        return {
            color: new fields.SchemaField({
                enabled: new fields.BooleanField({
                    required: false,
                    nullable: false,
                    initial: false,
                }),
                value: new fields.StringField({
                    required: false,
                    nullable: false,
                    blank: false,
                    initial: "#000000",
                }),
            }),
            position: new PositionField(),
            scale: new fields.NumberField({
                required: false,
                nullable: false,
                initial: 1,
            }),
            scales: new PositionField({ initial: () => ({ x: 1, y: 1 }) }),
            src: new fields.FilePathField({
                required: true,
                nullable: false,
                categories: ["IMAGE", "VIDEO"],
            }),
        };
    }
}

interface AvatarModel extends ModelPropsFromSchema<AvatarDataSchema> {}

type AvatarColorSchema = {
    enabled: fields.BooleanField<boolean, boolean, false, false, true>;
    value: fields.StringField;
};

type AvatarDataSchema = {
    color: SchemaField<AvatarColorSchema, false, false, true>;
    position: PositionField;
    scale: fields.NumberField<number, number, false, false, true>;
    scales: PositionField;
    src: fields.FilePathField<
        ImageFilePath | VideoFilePath,
        ImageFilePath | VideoFilePath,
        true,
        false,
        false
    >;
};

export { AvatarModel };
