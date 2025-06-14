import { ActorPF2e, addListenerAll, ItemPF2e, R } from "module-helpers";

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
            const isDelta = input.startsWith("+") || isNegative;
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

function addEnterKeyListeners(html: HTMLElement) {
    addListenerAll(html, "input", "keyup", (el, event) => {
        if (event.key === "Enter") el.blur();
    });
}

export { addEnterKeyListeners, addTextNumberInputListeners };
