# 0.3.0

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
