# 0.8.0

-   this release requires you to update `PF2e DAilies` to version `3.5.1` if use in your world
-   localized keybinds
-   made "everything" draggable in the sidebars
-   fixed not being able to toggle few `Token HUD` and `Persistent HUD` settings
-   `Combat Tracker`:
    -   fixed issue with token texture scaling
-   `Persistent HUD`:
    -   fixed linked sidebars not re-rendering on actor update
    -   implement the shortcut slots
        -   `consumables`, `strikes`, `elemental blasts`, `actions`, `spells` and `Roll Option` toggles can be dropped in the slots to create a shortcut
        -   only `spells` dragged from a sidebar will be able to be turned into a shortcut
        -   added `Confirm Action/Spell Shortcut` and `Consumable Shortcut` settings to add confirmation dialogs before using them
-   `Token HUD`:
    -   added exception for showing of the HUD when the `alt` key is held
    -   fixed enabling/disabled the feature not triggering a "require reload" event

# 0.7.0

-   added support for `Persistent HUD` sidebars
-   added trait description tooltips to NPCs strikes
-   tweaked the multi-columns logic to try to avoid useless scrollbars
-   heavily distinguish NPCs ability related strike traits from other strike traits
-   disable the `actions` sidebar icon for non-character actors that don't have any action
-   the selected persistent actor is now saved in a user flag instead of client setting (this shouldn't be cross-world)
-   fixed NPCs ability related strike traits not always being localized

# 0.6.0

-   this release requires `PF2e Toolbelt` to be updated to version `2.7.3` if used on your world
-   the module and its package dependency received a complete refactor
-   the `Use Modifiers` and `Show Highest Speed` settings are now global instead of per HUD
-   `Multi Columns Sidebars` settings now accept a value instead of just on/off
    -   sidebars can now have up to 5 columns
    -   the module still decides whenever a new column needs to be created
-   `Persistent HUD`:
    -   added a new `Disable Flash` setting
-   `Popup`:
    -   the popup can now be minimize and resized
    -   added a new `Popup on Cursor` setting to center the popup on the cursor when first rendered
    -   `@Damage` and `@Check` links aren't usable yet, the system has [plans](https://github.com/foundryvtt/pf2e/pull/15009) for those
-   `Sidebar`:
    -   sidebars are now planned to be shared between both the `Token HUD` and `Persistent HUD`
    -   implemented the `actions` sidebar (fully functional)

# 0.5.0

-   `Combat Tracker`
    -   prevent being able to drag & drop combatant when the tracker is collapsed
-   `Popup`
    -   will now fade out when the user is dragging anything in the page
-   `Token HUD`
    -   will now fade out when the user is dragging anything in the page
    -   now disable the `spells` sidebar icon when no spell exist on the actor
    -   added a new `Full Close on Click` setting
    -   added draw icon functionality to spell consumables
    -   added the `items` sidebar (fully functional)
-   `Token Tooltip`
    -   fixed health status not changing color

# 0.4.0

-   made a complete refactor of the templates across the different HUDs
-   `Popup`
    -   implemented the fundamentals for the popup application
    -   the popup is an actual foundry application and is persistent (can be moved/minimized)
-   `Token HUD`
    -   `spells` sidebar is now fully functional
-   `Persistent HUD`
    -   added new icon to remove the UI elements from the portrait, they show up when hovering over it
    -   added a flash animation on the portrait when selecting a token linked to the currently set actor
    -   added missing UI elements, the persistent HUD now has all the elements that are shown in the `Token HUD`
    -   improved automated set/unset of the persistent actor when changing user character

# 0.3.0

-   third prototype of the module
-   added functionalities for `languages`, `senses`, `immunities`, `weaknesses` and `resistances` to both the `Token HUD` and `Persistent HUD`
-   `Persistent HUD`
    -   now remembers persistent actor selection
    -   added a keybind to set the currently selected token as persistent
    -   you can right-click on the same icon used to set the persistent actor to unset it
        -   it will still revert to using the user's character if any
-   `Combat Tracker`
    -   hide names from players when appropriate if the `Tokens Determine NPC Name Visibility` system metagame setting is enabled
    -   the `Texture Scaling` setting allows for token images to be reverse scaled and to spill out of their bounds
        -   allows popout token to "pop out" of the tracker, though can end up being a mess in some circumstances
    -   added functionalities for targets both on the target button and also showing other users targets on each combatant
    -   added `Linked to scene` icon to the tracker
        -   available when holding the alt keybind in place of the threat icon
-   `Token Tooltip`
    -   fixed health status not showing up on the small tooltip
-   `Token HUD`
    -   worked on the core functionalities for the sidebars
    -   added prototype for the `spells` sidebar
    -   if the `Multi Columns Sidebars` setting is enabled, the module will split a sidebar between 1 and 3 columns depending on its expected height

# 0.2.0

-   second prototype of the module
-   renamed the Applications up the inheritance chain to avoid conflicts
-   added a new `Combat Tracker` HUD (fully functional)
-   prevent the tooltip and token HUD from showing when holding `shift` or `ctrl`
-   added multiple distance units to the tooltip
-   now use a custom `PIXI.Graphics` and add it to the `GridLayer` instead of using the debug layer, this allow for the line to be drawn bellow the tokens

# 0.1.1

-   display the persistent HUD even if no actor is set
-   ship with scss files

# 0.1.0

-   first prototype of the module
-   `Token Tooltip` is fully functional though still need some tweaking for the different actor types
-   the other features are just design prototypes
