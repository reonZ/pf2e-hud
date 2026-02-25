import fields = foundry.data.fields;

class IdField<
    TRequired extends boolean = false,
    TNullable extends boolean = false,
    THasInitial extends boolean = true,
> extends fields.DocumentIdField<string, TRequired, TNullable, THasInitial> {
    static get _defaults() {
        return Object.assign(super._defaults, {
            required: false,
            blank: false,
            nullable: false,
            readonly: true,
        });
    }

    getInitialValue(data?: object): string {
        return foundry.utils.randomID();
    }
}

// this returns all the getters of an instance object into a plain data object
function gettersToData<T extends Object>(instance: T): ExtractReadonly<T> {
    const Cls = instance.constructor as ConstructorOf<T>;
    const keys = Object.entries(Object.getOwnPropertyDescriptors(Cls.prototype))
        .filter(([key, descriptor]) => typeof descriptor.get === "function")
        .map(([key]) => key) as ReadonlyKeys<T>[];

    const obj = {} as ExtractReadonly<T>;

    for (const key of keys) {
        obj[key] = instance[key];
    }

    return obj;
}

export { IdField, gettersToData };
