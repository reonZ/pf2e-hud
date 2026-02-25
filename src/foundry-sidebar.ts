import { createToggleHook, htmlQuery } from "foundry-helpers";
import { FakePF2eHUD, HUDSettingsList } from "hud";

class FoundrySidebarPF2eNotHUD extends FakePF2eHUD<SidebarSettings> {
    #renderChatInputHook = createToggleHook("renderChatInput", () => this.#updateChatControls(), {
        onActivate: () => this.#updateChatControls(),
        onDisable: () => this.#cleanupChatControls(),
    });

    get key(): "foundrySidebar" {
        return "foundrySidebar";
    }

    get settingsSchema(): HUDSettingsList<SidebarSettings> {
        return [
            {
                key: "expand",
                type: Boolean,
                default: true,
                scope: "user",
            },
            {
                key: "noRollMode",
                type: Boolean,
                default: false,
                scope: "user",
                onChange: (value: boolean) => {
                    this.#renderChatInputHook.toggle(value);
                },
            },
        ];
    }

    init(): void {
        if (this.settings.noRollMode) {
            this.#renderChatInputHook.activate();
        }
    }

    ready(): void {
        if (this.settings.expand) {
            requestAnimationFrame(() => {
                ui.sidebar.toggleExpanded(true);
            });
        }
    }

    #cleanupChatControls() {
        const chatControls = document.getElementById("chat-controls");
        if (!chatControls) return;

        if (!game.user.isGM) {
            return (chatControls.style.display = "");
        }

        const parent = chatControls?.parentElement;

        htmlQuery(chatControls, "#roll-privacy")?.removeAttribute("hidden");

        if (ui.sidebar.expanded && parent?.id === "chat-notifications") {
            const chat = htmlQuery(document.getElementById("chat"), ".chat-form");
            const input = htmlQuery(chat, "#chat-message");

            if (input) {
                input.before(chatControls);
            } else {
                chat?.append(chatControls);
            }

            htmlQuery(chatControls, ".control-buttons")?.setAttribute("hidden", "");
        }
    }

    #updateChatControls() {
        const chatControls = document.getElementById("chat-controls");
        if (!chatControls) return;

        if (!game.user.isGM) {
            return (chatControls.style.display = "none");
        }

        const parent = chatControls?.parentElement;

        htmlQuery(chatControls, "#roll-privacy")?.setAttribute("hidden", "");

        if (parent instanceof HTMLFormElement && parent.classList.contains("chat-form")) {
            document.getElementById("chat-notifications")?.append(chatControls);
            htmlQuery(chatControls, ".control-buttons")?.removeAttribute("hidden");
        }
    }
}

type SidebarSettings = {
    expand: boolean;
    noRollMode: boolean;
};

export { FoundrySidebarPF2eNotHUD };
