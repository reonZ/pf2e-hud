import { getFlagProperty, R, setFlagProperty, UserSourcePF2e } from "module-helpers";
import { ModuleMigration } from "module-helpers/dist/migration";

export default {
    version: 1.25,
    migrateUser: (userSource) => {
        return userSource.role > CONST.USER_ROLES.ASSISTANT
            ? migrateGM(userSource)
            : migratePlayer(userSource);
    },
} satisfies ModuleMigration;

function migrateGM(userSource: UserSourcePF2e) {
    const storage = game.settings.storage.get("world");
    const storageResources = storage.find((x) => x.key === "pf2e-hud.resources.worldResources");
    const worldResources = foundry.utils.deepClone(storageResources?.value);

    if (!R.isArray(worldResources)) {
        return false;
    }

    const resources = R.pipe(
        worldResources,
        R.filter((resource) => R.isPlainObject(resource)),
        R.map((resource) => {
            delete resource.world;

            if (R.isBoolean(resource.visible)) {
                resource.shared = resource.visible;
                delete resource.visible;
            }

            return resource;
        })
    );

    setFlagProperty(userSource, "resources.userResources", resources);

    return true;
}

function migratePlayer(userSource: UserSourcePF2e) {
    const resourcesFlag = getFlagProperty<{ [k: string]: unknown }>(userSource, "resources");

    if (!R.isPlainObject(resourcesFlag) || !("userResources" in resourcesFlag)) {
        return false;
    }

    if (!R.isArray(resourcesFlag.userResources)) {
        resourcesFlag["-=userResources"] = true;
        return true;
    }

    resourcesFlag.userResources = R.pipe(
        foundry.utils.deepClone(resourcesFlag.userResources),
        R.filter((resource) => R.isPlainObject(resource)),
        R.map((resource) => {
            delete resource.world;
            resource.shared = false;
            return resource;
        })
    );

    return true;
}
