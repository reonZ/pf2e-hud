# 0.17.1

-   `Persistent HUD`:
    -   fixed issue with portrait width

# 0.17.0

-   made some slight improvement to filters
-   `Persistent HUD`:
    -   added a new `Shortcut Slots` setting to set the number of shortcut slots available in the HUD (NOTE: the module was designed to have 4 slots)
    -   implemented the `Font Size` setting for the persistent HUD
    -   fixed not being able to manually unset the persistent actor when the `Auto-Set Actor` setting is set to `On Token Select`
-   `Resources Tracker`:
    -   implement the `Font Size` setting for the resources tracker
    -   you can now use negative limits to the resources
    -   resource steps are now customizable, if empty or 0 the step shortcut will be removed

# 0.16.0

-   IMPORTANT:
    -   keybindings have been reset
-   added a new `Use Sidebar Filter` keybinding
    -   using that bind whenever a sidebar is open will display a filter field in the center of the screen
    -   typing anything in the field will filter the current sidebar content
    -   the field doesn't care about capital letters
    -   nothing happens if the typed filter doesn't match anything
    -   if anything matches the filter, the rest of the sidebar will be darkened to highlight it
    -   if the matched element is related to another element/section, those parent elements will also remain highlighted
        -   a variant action skill will highlight the variant, the parent action and the skill they belong to
        -   an item inside a backpack in the container section will have all 3 highlighted
    -   the filter field closes as soon as it loses focus
    -   pressing the `Enter` key will close the filter field while retaining the current filter for the sidebar
    -   pressing the `Escape` key will close the filter field and revert any filter
    -   pressing the `Use Sidebar Filter` keybind when there is a filter active on the current sidebar will cancel the filter
-   changed the default text color across the different HUDs to be the same as the one in the foundry interface
-   `Combat Tracker`
    -   removed the previously added scene control tool button for the combat tracker
-   `Token Tooltip`
    -   fixed (hopefully) a rare error when switching scene that would prevent the canvas from rendering

# 0.15.0

-   IMPORTANT:
    -   changes have been made to the data-structure of skills shortcuts, you will need to replace the existing ones (again)
-   added support for statistic action shortcuts from the `Extras` sidebar
-   added a new `Resource Tracker` HUD
    -   a small widget to track arbitrary resources
    -   GMs resources can be shared with everybody
    -   players resources only exist on their client (they are saved as user settings, not client)
    -   the HUD can be shown/hidden via a scene control tool button
-   `Combat Tracker`
    -   added a scene control tool button to enable/disable the combat tracker without the need to go to the settings

# 0.14.0

-   IMPORTANT:
    -   this release requires you to update `PF2e Dailies` to version `3.5.3` if used in your world
    -   changes have been made to the data-structure of skills shortcuts, you will need to replace the existing ones
-   added `Show Notes` functionality for NPCs
-   added `Use Resolve Point` functionality for Characters (added a tooltip for the `R` btn)
-   added perception and perception actions to the `Skills` sidebar
-   added implementation for the `Extras` sidebar
    -   everything is functional except the `Recall Knowledge` action
    -   the `Initiative` select is not persistent, it doesn't modify the value saved on the actor and is only used for the next initiative roll from the sidebar
    -   macros are saved on the world actor for unlinked actors and are shared between all tokens
-   `Persistent HUD`:
    -   added a variants dialog for skill/statistic actions when right clicking on the roll button
        -   can change the associated statistic
        -   can add/remove the agile trait behaviour for rolls that have a MAP
        -   can change the DC value for rolls with a defined DC
    -   the `Auto-Set Actor` behaviour has changed, it is now "smarter"
        -   manually set actor will override any other behaviour (it will never change regardless of the auto-set option)
        -   if the persistent actor is supposed to change but leads to no actor, it will automatically revert to the user assigned actor
            -   this can happen for instance when the current combatant/selected token isn't owned or an invalid actor
            -   it can also happen when un-selecting a token while using the `On Token Selection` option
        -   similar behaviour will happen when manually un-setting the actor, it will first try to look at the currently selected token/current combatant and then for the user assigned actor.
    -   fixed action shortcut opening the action popup instead of running the toolbelt macro

# 0.13.0

-   added a `Send to Chat` button to the item popup
-   the `Skills` sidebar icon is now disabled for non-creature actors
-   the `perception` and `stealth` rolls from the main HUD parts now have the `secret` roll option
-   strike versatile damage icons are now displayed directly bellow the variant row they are associated with
    -   this also fixes not seeing versatile damage types for anything but the first variant
-   `Persistent HUD`:
    -   added support for skill action shortcuts
    -   shortcuts are now filled by columns instead of by rows
    -   you can now manually set a persistent actor even when using the `Auto-Set Actor` setting (description of the setting was updated)
    -   removed the sidebars arrow
    -   fixed strike shortcuts linked to virtual items (e.g. strikes from stances) not being retrieved when re-created
    -   fixed issue with portrait url using escapable characters
-   `Sidebars`:
    -   added a new `Hide Untrained` setting to hide skill actions that require a character to be proficient when they are not
    -   added skill actions and their variants to the skills sidebar (lore skills are on standby for now)
    -   added `Follow the Expert` to the skills sidebar
    -   improved the margins of the different headers and items
-   `Token HUD`:
    -   added the attack sidebar icon to the `Hazard` and `Army` HUD next to level (though the army one is unusable for now)
    -   removed sidebars panel from `Hazard` actors
    -   disabled the skill sidebar icon for non-creature actors
    -   fixed styling the hazard HUD

# 0.12.0

-   raised minimum foundry version to `12.328`
-   newly opened sidebars are now always displayed on top of everything
-   started working on the `Skills` sidebar, only contains base skill rolls for now
-   `Persistent HUD`:
    -   added versatile icons to attack shortcuts
    -   added `autoFillActions` and `autoFillReactions` gm-only settings
        -   respectively add actions and reactions after strikes when auto filling NPC shortcuts
    -   now creates a `PF2e Toolbelt` stance shortcut when dropping a stance from the sidebar
        -   toolbelt stances refer to actions in the `Stances` section of the `Actions` sidebar
    -   now fades out strike shortcuts with item quantity of 0
    -   changed the way action shortcuts work if they aren't "usable"
        -   instead of simply sending it to chat, it will open its description popup
        -   usable refers to actions that have:
            -   a self-applied effect
            -   a macro when using `PF2e Toolbelt`
            -   a frequency use (e.g. 1/day)
    -   fixed sidebar arrow offset
    -   fixed sidebar closing on update if a character sheet was also open
    -   fixed issue when more than one instance of an item linked to a strike exist
    -   fixed actor not being unset when the encounter ends while using the `Current Combatant` option of the `Auto-Set Actor` setting
-   fixed styling issue of confirm dialogs introduced with foundry version `12.328`

# 0.11.0

-   added toggles to the exploration actions
-   now properly disable attack buttons in the sidebars and shortcuts if they can't be used
-   added action traits (`mindsmith`) to the actions sidebar
-   the `Popup` is now linked to its originating actor and will be re-rendered on update
-   `Persistent HUD`:
    -   added a new effects section that display the effects currently present on the persistent actor even when not selected
    -   added a new `Hold Shift for Effects` setting
        -   this is a fail-safe preventing misclicks on effects, when enabled, you are forced to hold `shift` to interact with the effect icons
-   `Token Tooltip`:
    -   fixed health status not selecting the right string to display
    -   fixed the tooltip not always showing up when moving too fast in, out and in again on a token that wasn't previously hovered

# 0.10.0

-   settings can now be `GM Only` and still be client settings
-   added extra tags to setting names in the "Configure Game Settings" application to indicate which ones are `GM Only` or `Requires Reload`
-   `Persistent HUD`:
    -   the `Auto-Fill NPCs` setting is now a checkbox and gm-only (setting was reset)
    -   added a new `Auto-Fill Preference` gm-only setting
        -   select menu that was originally in `Auto-Fill NPCs`
        -   is also used when using the auto-fill shortcut menu (see below)
    -   added a new `Use Owner Shortcuts` gm-only setting
        -   it will find the "main" owner of the Character actor and use its shortcuts if you never made any change in yours
    -   added shortcuts menus for GM above the shortcut slots
        -   you will find a way to delete, auto-fill or copy owner shortcuts
    -   added the "default" range of character strikes directly on the shortcut
-   fixed image size issue on firefox for dragged elements from sidebars

# 0.9.0

-   `Combat Tracker`:
    -   now dynamically uses the context menu entries of the combat tracker, allowing the addition of third party options
-   `Persistent HUD`:
    -   added `additional effects` to NPC strike shortcut name
    -   added `traits` to NPC strike shortcut subtitle
    -   position the `Attack Popup` application closer to the HUD when opening it from an attack shortcut
    -   now saves the state of the players application across reload
    -   changed the default highlighted button for the confirm dialogs to `yes`
    -   added a new `Auto-Set Actor` setting
        -   when set to anything but `Disabled`, every mean of setting the persistent actor manually will be removed
        -   when set to `On Token Selection`, it will also completely disable the `Token HUD` feature
    -   added a new `Auto-Fill NPCs` setting
        -   the module will try to fill all the shortcut slots with strikes, spells and consumables
        -   you can select the priority between spells and consumables
    -   fixed `free` and `reaction` cost icons not showing on shortcuts

# 0.8.0

-   this release requires you to update `PF2e Dailies` to version `3.5.1` if used in your world
-   localized keybinds
-   made "everything" draggable in the sidebars
-   fixed not being able to toggle few `Token HUD` and `Persistent HUD` settings
-   `Combat Tracker`:
    -   fixed issue with token texture scaling
-   `Persistent HUD`:
    -   fixed linked sidebars not re-rendering on actor update
    -   implemented the shortcut slots
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
