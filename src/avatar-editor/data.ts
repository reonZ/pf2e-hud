import { ActorPF2e, getFlag, ImageFilePath, VideoFilePath, z, zFilePath, zPoint } from "foundry-helpers";

const zAvatarColor = z.object({
    enabled: z.boolean().default(false),
    value: z.string().trim().length(7).startsWith("#").default("#000000"),
});

const zAvatar = z.object({
    color: zAvatarColor.prefault({}),
    position: zPoint().optional(),
    scale: z.number().default(1),
    src: zFilePath<VideoFilePath | ImageFilePath>(["IMAGE", "VIDEO"]),
});

function getAvatarData(actor: ActorPF2e) {
    const source = getFlag<AvatarSource>(actor, "avatar") ?? { src: actor.img };
    return zAvatar.safeParse(source).data;
}

type AvatarSource = z.input<typeof zAvatar>;
type AvatarData = z.output<typeof zAvatar>;

export { getAvatarData, zAvatar };
export type { AvatarData, AvatarSource };
