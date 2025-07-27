import { ActorPF2e, createHTMLElement, ItemPF2e, R } from "module-helpers";

function addTextNumberInputListeners(doc: ActorPF2e | ItemPF2e, html: HTMLElement) {
    const textNumbers = html.querySelectorAll<HTMLInputElement>("input[type='text'].text-number");

    for (const el of textNumbers) {
        const cursor = foundry.utils.getProperty(doc, el.name);
        if (cursor === undefined) continue;

        const cursorIsObject =
            R.isObjectType<{ value: number; max: number } | null>(cursor) &&
            "value" in cursor &&
            "max" in cursor;

        const path = cursorIsObject ? `${el.name}.value` : el.name;
        const min = Number(el.dataset.min) || 0;
        const step = Number(el.dataset.step) || 1;
        const max = cursorIsObject ? cursor.max : Number(el.dataset.max) || Infinity;

        const wheelListener = (event: WheelEvent) => {
            const value = Number(el.value);
            const direction = event.deltaY >= 0 ? -1 : +1;
            const newValue = Math.clamp(value + step * direction, min, max);

            el.value = String(newValue);
        };

        el.addEventListener("focus", (event) => {
            el.setSelectionRange(0, -1);
            el.addEventListener("wheel", wheelListener);
        });

        el.addEventListener("blur", (event) => {
            el.removeEventListener("wheel", wheelListener);

            const input = el.value;
            const current: number = foundry.utils.getProperty(doc, path) ?? 0;
            const isNegative = input.startsWith("-");
            const isDelta = isNegative || input.startsWith("+");
            const isPercent = input.endsWith("%");
            const valueStr = input.slice(isDelta ? 1 : 0, isPercent ? -1 : undefined);
            const valueNum = Math.abs(Number(valueStr));

            if (isNaN(valueNum)) {
                el.value = String(current);
                return;
            }

            const calculatedValue = isPercent
                ? cursorIsObject
                    ? Math.floor(max * (valueNum / 100))
                    : Math.floor(Math.abs(current) * (valueNum / 100))
                : valueNum;

            const processedValue = isDelta
                ? current + calculatedValue * (isNegative ? -1 : 1)
                : calculatedValue;

            const value = Math.clamp(processedValue, min, max);

            if (value === current) {
                el.value = String(current);
            } else {
                el.value = String(value);
                doc.update({ [path]: value });
            }
        });
    }
}

function processSliderEvent<TAction extends string>(
    event: PointerEvent,
    target: HTMLElement,
    callback: (action: TAction, direction: 1 | -1) => void | Promise<void>
) {
    if (![0, 2].includes(event.button)) return;

    const action = target.dataset.sliderAction as TAction;
    const direction = event.button === 0 ? 1 : -1;

    callback(action, direction);
}

function createDraggable<T extends FoundryDragData>(
    event: DragEvent,
    img: ImageFilePath,
    actor: ActorPF2e,
    item: Maybe<ItemPF2e>,
    data: Omit<T, keyof FoundryDragData>
) {
    const target = event.target;
    if (!event.dataTransfer || !(target instanceof HTMLElement)) return;

    const draggable = createHTMLElement("div", {
        classes: ["pf2e-hud-draggable"],
        content: `<img src="${img}">`,
    });

    document.body.append(draggable);

    const dragData: FoundryDragData = {
        actorId: actor.id,
        actorUUID: actor.uuid,
        sceneId: canvas.scene?.id ?? null,
        tokenId: actor.token?.id ?? null,
        ...item?.toDragData(),
        ...data,
    };

    event.dataTransfer.setDragImage(draggable, 16, 16);
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));

    target.classList.add("dragging");

    target.addEventListener(
        "dragend",
        () => {
            target.classList.remove("dragging");
            draggable.remove();
        },
        { once: true }
    );
}

type FoundryDragData = {
    actorId: string;
    actorUUID: ActorUUID;
    sceneId: string | null;
    tokenId: string | null;
};

export { addTextNumberInputListeners, createDraggable, processSliderEvent };
export type { FoundryDragData };
