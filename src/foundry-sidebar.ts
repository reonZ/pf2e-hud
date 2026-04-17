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

        const popout = ui.sidebar.popouts.chat;
        const chatTabActive = ui.sidebar.tabGroups.primary === "chat";
        const sidebarExpanded = ui.sidebar.expanded;

        htmlQuery(chatControls, "#message-modes")?.removeAttribute("hidden");
        htmlQuery(chatControls, ".control-buttons")?.toggleAttribute(
            "hidden",
            !popout && (!chatTabActive || !sidebarExpanded),
        );

        popout?.render();

        if (chatTabActive && sidebarExpanded) {
            const input = document.getElementById("chat-message");
            input?.before(chatControls);
        }
    }

    #updateChatControls() {
        const chatControls = document.getElementById("chat-controls");
        if (!chatControls) return;

        if (!game.user.isGM) {
            return (chatControls.style.display = "none");
        }

        htmlQuery(chatControls, "#message-modes")?.setAttribute("hidden", "");
        htmlQuery(chatControls, ".control-buttons")?.removeAttribute("hidden");
        document.getElementById("chat-notifications")?.append(chatControls);
    }
}

type SidebarSettings = {
    expand: boolean;
    noRollMode: boolean;
};

export { FoundrySidebarPF2eNotHUD };
