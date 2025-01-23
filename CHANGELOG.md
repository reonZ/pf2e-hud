# 1.28.2

-   `Health Status`:
    -   fix wrong icon being used in import dialog
    -   fix issue with import dialog error message
-   fix recall-knowledge action not skipping manual input dice

# 1.28.1

-   reworked the styling of the recall-knowledge message to be more lean
-   add new localization keys for the recall-knowledge message to allow better customization

# 1.28.0

-   add an extra flavor text for consumables `use` to make it more obvious
-   `Combat Tracker`:
    -   the HP value displayed now includes the temp HP
-   rework of `Health Status`:
    -   the feature now has a dedicated menu to setup the different entries
    -   a setting migration will be done to recover the values from the old feature
    -   the overall value used to pick the entry and its color now uses the temp HP as well
        -   this is true for both the `Combat Tracker` & `Token Tooltip`
    -   fix health status being shown for actors with negative max HP

# 1.27.0

-   `Combat tracker`:
    -   now also move to next turn when a delayed combatant returns to initiative (making it the current combatant)
-   `Persistent HUD`:
    -   add a new button to lock the shortcuts

# 1.26.3

-   `Persistent Shortcuts`:
    -   fix NPC empty spell slots breaking the persistent HUD during auto-fill

# 1.26.2

-   `Resources Tracker`:
    -   fix tracker being toggled for every client instead of the current one only

# 1.26.1

-   fix hotbar navigation being unresponsive after any persistent HUD "update"

# 1.26.0

-   this is a system `6.8.0` release
-   update actions and action shortcuts to handle latest system changes
    -   notably the crafting formula picker menu
-   add support for `Mythic Points` (show in place of the `Hero Points`)
-   `Combat Tracker`:
    -   fix drag & drop not working now that the system methods are private
    -   fix health status tooltip not always showing
    -   fix initiative sometimes having decimals
-   `Persistent Shortcuts`:
    -   add counter to shortcut actions with a resource
    -   strike related to `Temporary` `Alchemical` `Bomb` items are now "smart"
        -   if the item bound to the shortcut isn't found or its quantity is `0`, the module will look for another alchemical bomb of the same type and use in its place if any exist
    -   strike's range & quantity are now displayed even if the strike weapon is sheathed
    -   always display the ammunition counter even if none are currently selected
-   `Roll Panel`:
    -   change the panel borders style to fix the horrible groove render when using firefox
-   `Sidebars`:
    -   add special resources to `extras` sidebar
    -   add counter to actions with a resource
        -   the counter isn't editable by design, go in the extras sidebar for that
    -   now display the invested count in the tooltip of the `Toggle Invested` button
    -   fix disabled `use` buttons not being greyed out
-   `Time Tracker`:
    -   Now override the `Enabled` settings for players if the system worldclock `Player Access` is disabled
    -   remove the `Encrypt` feature

# 1.25.0

-   if you use the `PF2e Dailies` module, make sure to update it to version `3.15.0`
-   the module now uses a migration manager
    -   the main GM will be asked to migrate on load
    -   if the system is migrating data, make sure to wait until it is done before starting
-   you can now use delta and percentage values in the `Health`, `Stamina` and `Shield` related input fields
    -   using `+x` or `-x` will add/subtract `x` to the current value
    -   using `x%` will set the value to be `x` percent of the max value
    -   using `+x%` or `-x%` will add/subtract `x` percent of the max value to the current value
    -   NOTE that any decimal number will be rounded down
    -   NOTE that `Temporary Hit Points` doesn't have a max value and therefore will be update by a percentage of its current value instead
-   `Persistent Shortcuts`:
    -   disable non-primary vessel spell shortcuts
    -   you can now create any kind of roll option toggle shortcut
        -   the current suboption (if any) will be recorded on shortcut creation
        -   if a toggle is `alwaysEnabled` then clicking on the shortcut will select the suboption
        -   if a toggle has a suboption but isn't `alwaysEnabled` then
            -   it will toggle on and set the suboption if the toggle is off or another suboption is selected
            -   will toggle off if it is currently on and with the same suboption selected
    -   you can now drag the elemental blast action cost (`Ⅰ Ⅱ`) to create a special rolloption shortcut
    -   now directly send-to-chat unusable actions for players (will still open the popup for the GM)
        -   "unusable" refers to actions that don't have a self-effect or a macro linked to them
    -   fix wand shortcuts not being expended
-   `Resources Tracker` rework:
    -   `Enabled` is now a client setting (still requires reload)
    -   there is no longer any world resource
    -   any resource can now be shared with the other users
        -   only the owner of the resource can update/edit it
        -   only show shared resources from logged-in users
-   `Sidebars`:
    -   hide non-primary vessel spells from the list
    -   fix drag image not always loading during drag event

# 1.24.3

-   `Dice Panel`:
    -   fix panel being squished when rendered while being on another directory tab

# 1.24.2

-   make sure `ChatLog` is rendered before trying to inject the `Dice Panel` & `Time Tracker` HUDs
-   `Dice Panel`:
    -   slight styling adjustment

# 1.24.1

-   `Skills Sidebar`:
    -   add `Halfling Ingenuity` & `Eclectic Skill` to the feats allowing you to use skill actions requiring to be tained

# 1.24.0

-   `Dice Panel`:
    -   add two `Flat Check` buttons for DC 5 & 11
    -   no longer generate a `[[/r 1dx]]` inline syntax but instead `[[1dx]]`
        -   this means that inline rolls will be evaluated when the chat message is added
        -   will however keep the `/r` if it is already present in the inline brackets
    -   fix parsing of dice number with more than one digit
-   `Persistent Shortcuts`:
    -   now display the map modifier (if any) on the skill action shortcuts
-   `Skills Sidebar`:
    -   add support for `Chirurgeon`
        -   `medicine` skill actions will all be displayed as usable even if not trained in it
    -   fix `Untrained Improviser` mixup
        -   the module was just not hiding the skill actions that required to be trained if you had `Untrained Improviser`
        -   the module now gives you the ability to roll any skill action if you have the `Cleaver Improviser` or `Ceremony of Knowledge` feats and no longer care about `Untrained Improviser`
    -   NOTE that the system `Treat Wounds` action will not work when using `medicine` because it double checks if you are trained in it and does not care for those feats
-   `Time Tracker`:
    -   add new `Encrypt` button for the GM
        -   it only shows up on the expanded version when hovering over the tracker
        -   makes the date & time unreadable for the players
        -   stays visible when enabled to indicate if the data is encrypted
        -   if encrypted and switching to the short version, the date+time will have a gm-only style applied

# 1.23.1

-   `Time Tracker`:
    -   fix short date year value when not using the `Unthemed (Gregorian Calendar)`

# 1.23.0

-   add new `Dice Panel` HUD:
    -   you can find it right above the chat input field
    -   depending on which key (`Shift` or `Ctrl`) is held while clicking, the behaviour will differ
        -   [None]: the die will be rolled right away and displayed in chat
        -   [Ctrl]: the die will be rolled right away and displayed in chat as a `Private` roll
        -   [Shift]: will update the chat and give it focus subsequently
            -   if nothing is present in the chat, a new `/r 1dx` will be added to it
            -   if the chat consists of a `/r 1dx` syntax, its dice will be updated with the clicked one
            -   if anything else is found in the chat:
                -   if it ends with a `[[/r 1dx]]` syntax, its dice will be updated with the clicked one
                -   if no `[[/r 1dx]]` is found at the end of the message, a new one will be generated
-   add new `Time Tracker` HUD:
    -   you can find it at the top of the directories sidebar
    -   you can click on the `time` to toggle its display with a shortened version
    -   the GM have access to buttons to advance or rewind time in `10-min`, `1-hour` and `1-day` increments
    -   the GM has access to a slider when hovering over the date (in the expanded version) to quickly move time in the current day

# 1.22.0

-   `Combat Tracker`:
    -   make sure to dispose of `Sortable` listeners to improve long term performances
-   `Token HUD`:
    -   now force reload when enabling/disabling the hud
    -   now show the skill names when hovering over the recall knowledge icon of a NPC
-   `Token Tooltip`:
    -   fix rare occurrence of health status wrapping into a second line
-   fix `Resolve` tooltip localization key
-   some internal changes

# 1.21.1

-   `Sidebars`:
    -   add public methods to retrieve items from sidebars DOM elements
-   fix `Hero Points` tooltip localization key

# 1.21.0

-   `Combat Tracker`:
    -   add new defeated image over the combatant image
    -   fix dead anonymous combatant name color
-   `Persistent HUD`:
    -   change shortcuts methods to be public for third party use, noteworthy mentions are:
        -   `getShortcut`
        -   `getShortcutFromElement`
        -   `shortcutsAreEmpty`

# 1.20.0

-   move the `Health Status` world setting outside the `Token Tooltip` context
    -   it is now a global setting and has been reset
-   `Combat Tracker`:
    -   slightly increase the border shadow of anonymous creature names
    -   add health status indicator for combatants that the user cannot observe
        -   this uses the `Health Status` global setting
        -   the actual status is shown when hovering over the `???`
-   fix rare issue related to non-linked actors with their base actor no longer in the world actors list

# 1.19.0

-   this is a system `6.6.0` release
-   `Persistent HUD`:
    -   allow the creation of skill action shortcuts with variants
        -   the variant popup now has an icon that can be dragged to create a shortcut with the current variants
-   `Sidebars`:
    -   add a green background to spontaneous signature spells
    -   add a toggle for signature spells from animist spellcasting entries generated by the `PF2e Dailies` module
        -   requires version `3.8.1` of the module
    -   fix prepared cantrips having the expended toggle
-   fix `Next Shortcuts Set` keybind label

# 1.18.1

-   add a few global css variables to `:root`
-   fix effects panel position when the persistent hud is not enabled

# 1.18.0

-   this is a system `6.5.0` update
-   `Combat Tracker`:
    -   reduce the max height of the tracker
    -   fix effects panel styling
        -   it will now only have one column and use scrollbar the way the system does

# 1.17.0

-   `Persistent HUD`:
    -   you can now drop foundry items (i.e. conditions, effects, equipment) on the portrait avatar
        -   works the same way you would drop them on a token or an actor sheet
    -   separate the rendering of shortcuts from the rest
        -   this is only an internal matter, the user should see no difference
    -   add support for multiple shortcuts sets
        -   you can switch between 3 sets
        -   keybinds have been added to go to the previous or next set
        -   you can setup automation for sets (except the first set)
            -   whenever an effect is present on the actor
            -   whenever a macro returns true
        -   the `Reset Shortcuts` only affects the current set
        -   the `Copy Owner Shortcuts` copies all sets from the owner and their automation
        -   auto-fill will fill up every set the same way
-   add a new `Persistent Shortcuts` section in the settings
    -   it is placed right after the `Persistent HUD` section
    -   all the settings are still part of the `Persistent HUD`, nothing is reset
    -   add new `Must Draw Consumable` setting (disabled by default)
        -   forces consumables to be carried before being able to use their shortcut
        -   this doesn't affect scrolls that were dragged from the spells, only actual consumable items from the inventory
-   `Sidebars`:
    -   add series of tooltips to skill actions

# 1.16.0

-   use `string#replace` instead of `string#replaceAll` for compatibility with older browsers
-   `Sidebars`:
    -   fix exploration actions which show up in the `skills` sidebar being excluded from the `actions` sidebar
-   `Token Tooltip`:
    -   add support for hazards without any "health" data

# 1.15.3

-   `Combat Tracker`
    -   no longer fade out when dragging anything on the page
-   skip manual dice roll input when rolling recall knowledge

# 1.15.2

-   `Popup`:
    -   fix not being able to drag inline links out of the popup
    -   fix property tags being too small

# 1.15.1

-   `Persistent HUD`:
    -   now fade out when placing a template on the scene (including the hotbar)
-   fix fade-out error when some HUDs are disabled on the client

# 1.15.0

-   `Combat Tracker`:
    -   now fade out when dragging anything in the page or when placing a template on the scene
    -   fix image overflow on the last combatant row when `Texture Scaling` is enabled
-   `Popup`:
    -   now fade out when placing a template on the scene
-   `Sidebars`:
    -   now close when placing a template on the scene
    -   you can now modify the `DC` value of skill actions that have a default one in the variant popup
-   `Token HUD`:
    -   now close when placing a template on the scene
-   `Token Tooltip`:
    -   add a new `Display Health Status` client setting
        -   users can now individually disable the showing of health state on the tooltip
        -   allows the health state to be shown on the extended version of the tooltip as well as the small one
    -   rename the `Health Status` setting into `Health Status Entries`

# 1.14.0

-   forcibly set the font of the different HUDs to avoid theming modules changing it and messing with the tight layouts
-   event modifiers (holding `Shift` or `Ctrl`) when using the variants window are now registered when you click on the `Confirm` button instead of when you open the variant window
-   `Combat Tracker`:
    -   you can now `[Right Click]` on the big initiative die to open the variants window and select which statistic to use when rolling

# 1.13.1

-   changes some template syntax to avoid potential conflicts with other modules helpers

# 1.13.0

-   this release comes with some attempt at improving the performance of the module
    -   thanks to [Codas](https://github.com/Codas) for his help locating the places that could be improved and his advice on how to
    -   those are not significant improvements but the goal is to avoid pilling on what already exists in foundry as much as possible
    -   please keep an eye on potential styling issues, the module has a lot of small parts and some may have slipped through the cracks during the transition
-   updated actions (and their shortcuts) to follow the coming changes of `PF2e Toolbelt` `Actionable`

# 1.12.0

-   add support for `Starfinder 2nd Edition Playtest for PF2e` skills and their respective actions
-   `Persistent HUD`:
    -   now save the avatar data on the world actor, sharing it between all unlinked actors
    -   shortcut of consumables not held will now indicate so by adding a subtitle and a hand icon
        -   using the shortcut will now "retrieve" it instead of using it right away
    -   add a subtitle to stance shortcuts when out of combat to indicate how to force its use
    -   fix shortcut icons being completely black making them almost impossible to distinguish
-   :
    -   now fade out when placing a template:
    -   popup now has its own section in the settings
    -   add `Font Size` setting to popup
    -   the popup related settings have been renamed and reset
-   `Sidebars`:
    -   sidebar settings are no longer split between the `Token HUD` and `Persistent HUD`
    -   sidebars now have their own section in the settings
    -   all sidebars related settings have been reset (some renamed)
    -   the `Max Height` setting is now always relative to the viewport
-   fix very rare occurrence of `Skills` sidebar not closing when rolling a skill action

# 1.11.1

-   fix `Earn Income` shortcut not working

# 1.11.0

-   this is a system `6.3.1` release
-   fix `Earn Income` skill action not working and move it to the `Extras` sidebar instead
-   fix :
    -   now fade out when placing a template application not having a vertical scrollbar when reaching the viewport's height
-   fix `Take Cover` action not removing the effect if it is currently present on the actor

# 1.10.1

-   `Combat Tracker`:
    -   fix showing of party members stats not respecting the system's metagame setting `Show Party-Member Stats`

# 1.10.0

-   this is a system `6.3.0` release
-   `Combat Tracker`:
    -   token image no longer overflows out of the tracker's bounds when `Texture Scaling` is enabled
        -   this was causing some issues when the tracker was reaching a height big enough to require scrolling
        -   downscaled token images now have gradient masks instead (stolen from [supe](https://github.com/CarlosFdez))
    -   fix non-breaking error when changing settings while the feature was disabled
-   `Persistent HUD`:
    -   fix portrait image not using the custom avatar until an actor update took place
-   `Token HUD`:
    -   fix hud not closing when disabling the feature and still on screen
    -   fix hud not showing for PCs/NPCs if the `Auto-Set Actor` was set to `On Token Selection` even when the `Persistent HUD` was disabled
-   fix debug stuff showing in console
-   fix `Party Alliance as Observed` description only mentioning the tooltip

# 1.9.0

-   the `Token HUD` no longer gets disabled when the `Auto-Set Actor` setting is set to `On Token Selection`
    -   the HUD will now show up whenever an actor isn't moved to the persistent HUD
        -   if the actor isn't a PC or NPC
        -   if the persistent HUD currently has a "locked" actor
    -   because of that new approach, few settings don't require a "reload" anymore
-   move `Party as Observed` (now `Party Alliance as Observed`) to be a global setting
    -   it is used by both the `Token Tooltip` and `Combat Tracker` HUDs
    -   the actor being part of a `Party` actor you can observe is now also taken into account
    -   the setting has been reset because of that change
-   add `Avoid Notice` as a skill action in the `Skills` sidebar under `Stealth`
-   `Persistent HUD`:
    -   stances shortcut now fade-out when out of combat
    -   the HUD is refreshed when the actor's combatant is added/removed from the active encounter
-   fix the initiative roll missing roll options in the `Extras` sidebar

# 1.8.0

-   add support for the `Identify` feature of `PF2e Toolbelt`
    -   you need to update toolbelt to `2.10.0` or expect some breakage
-   add the `Raise Shield` icon to NPC layouts
-   change the shield icon when the actor doesn't have a shield equipped and replace the `N/A` with `——`
-   expose `getNpcStrikeImage` function to the API
-   fix `Use` button showing on unidentified items

# 1.7.1

-   fixed custom stances not showing in the `Stances` section of the `Actions` sidebar

# 1.7.0

-   changed the `Stealth` icon from the slashed eye to the mask
-   `Combat Tracker`:
    -   added a new `Delay Turn` feature:
        -   this is a GM only feature
        -   it is activated by clicking on the initiative die and turns the icon into an hourglass
        -   clicking on the hourglass icon will change the initiative of the combatant to be just after the current one
-   `Persistent HUD`:
    -   changed the `Toggle Effects` icon to use the same as the actor sheet
    -   fixed `Toggle Effects` icon not being greyed out when disabled

# 1.6.1

-   added French localization (thanks to [Mose](https://github.com/mose))
-   `Combat Tracker`:
    -   releasing a combatant outside of the combat tracker will now revert its position in the initiative
        -   thanks to [Shemetz](https://github.com/shemetz)

# 1.6.0

-   added a new `Close Popup on Send-to-Chat` setting
-   `Persistent HUD`:
    -   a majority of NPC strikes will now have custom shortcut images
        -   the priority is given to images that were manually set
        -   if not, it will look for one of the module's custom image
        -   otherwise it will display a custom default image for the ranged attacks
        -   thanks to [Shemetz](https://github.com/shemetz) for compiling the list of images for us

# 1.5.2

-   filters for skills will now work both ways instead of from child to parent only
    -   the statistic will be passed down to all its children
    -   the action will be passed down to its variants
    -   which will allow highlighting of related sections instead of just the found match
-   `Persistent HUD`:
    -   fixed alternate strike shortcuts not working for strikes with a single variant

# 1.5.1

-   `Persistent HUD`:
    -   changed the portrait style to be less opaque and accentuated the whole HUD icons/texts
    -   changed the left menu icons color to be the same as the one in the rest of the HUD
    -   added a `Reset` button to the `Edit Avatar` menu
    -   fixed shortcuts of the slot 0 of a prepared spellcasting entry not showing as expended

# 1.5.0

-   now provides the item as argument to the `Use Action` macro scope
-   changed the HUDs icons color to demark them slightly from their associated value
-   added a new `Alliance Button` setting to the `Token HUD` and `Persistent HUD`
    -   it shows the alliance/disposition button on the HUD when enabled (instead of always)
-   exposed `rollRecallKnowledge` and `useResolve` actions to the API
-   `Persistent HUD`:
    -   the `Enabled` setting now requires a reload when changed
    -   `Auto-Fill` settings are now available to players
    -   added the `Auto-Fill Shortcuts` and `Reset Shortcuts` buttons to the players HUD
    -   added a new alternate shortcut for attacks
        -   you need to hold `Ctrl` when creating the shortcut
        -   the shortcut will display the variant of the strike/blast by default
    -   added a way to customize the portrait shown in the HUD
        -   click on the portrait itself to open the menu
        -   this is global: all users who have ownership of the actor will share the same customization
    -   the portrait will now use a cover size instead of contain by default
        -   it will fix some portrait but probably mess up with some other
    -   fixed rare error with feat related skill action shortcuts that are missing the feat on the actor (e.g. removing the `Bon Mot` feat while having its action as a shortcut)
-   `Token HUD`:
    -   fixed the HUD not being enabled if the `On Token Selection` option of `Auto-Set Actor` was chosen even if the `Persistent HUD` was disabled
-   `Token Tooltip`:
    -   fixed tooltip still showing up when a click was registered during its render delay
-   fixed issue preventing the update of an actor's alliance when its default value was `Neutral`
    -   the module can no longer return an alliance to `Ownership Default`

# 1.4.0

-   the module no longer requires having `PF2e Toolbelt` installed/activated nor its `Stances` setting enabled to display and toggle the stances section in the `Actions` sidebar
-   `Persistent HUD`:
    -   fixed generic recall knowledge (from the `extras` sidebar) shortcut not doing anything
    -   fixed `Copy Owner Shortcuts` action not cleaning the current shortcuts first
    -   fixed the HUD not showing on load in the unlikely scenario where a user no longer has ownership of their assigned actor
-   `Token Tooltip`:
    -   now displays the level of the token actor
        -   the level will be colored for NPCs with adjustment (elite/weak)
    -   added a new `Party as Observed` world setting
        -   consider actors in the 'Party' alliance to be observed by players for the sake of extending the tooltip
        -   not to be confused with the 'Party' actor

# 1.3.1

-   `Persistent HUD`:
    -   action shortcuts that don't have a self-effect will now use their parent feat icon (if it isn't one of the default ones)
    -   no longer auto-fill ammunition consumables for NPCs (those aren't clickable shortcuts)
-   `Token Tooltip`:
    -   revert only ever showing the small version of the tooltip when a `Token HUD` is currently visible or the hovered token is the persistent actor's
-   fixed NPCs not being able to use the focus slider in the `Spells` sidebar

# 1.3.0

-   this is a system `6.1.2` release
-   added Polish localization (thanks to [Lioheart](https://github.com/Lioheart))
-   `Combat Tracker`:
    -   fixed token animated images not being displayed
-   `Persistent HUD`:
    -   fixed the attack shortcut popup styling
    -   fixed toggle shortcuts using the item name instead of the toggle label

# 1.2.0

-   `Persistent HUD`:
    -   prevent the display of strike auxiliaries containing a dropdown in strike shortcuts
    -   added a new `Keep Last Persistent` setting (enabled by default)
        -   when using `Auto-Set Actor`, should the last valid actor be kept as persistent instead of being unset
        -   it will still revert to your assigned actor if you have one and `On Token Selection` is chosen

# 1.1.1

-   the critical button for NPC strikes will no longer show the formula directly but only `Critical`
    -   NPC criticals are always double damage
    -   you can still hover over it to see the formula
-   `Persistent HUD`:
    -   fixed NPC strike shortcuts not showing the damage variant buttons

# 1.1.0

-   this is a system `6.1.1` release
-   `Persistent HUD`:
    -   added support for lore skill shortcuts
    -   added extra custom icons for skill actions & lore skills shortcuts
-   `Sidebars`:
    -   fixed focus slider style in `Spells` sidebar
-   `Token HUD`:
    -   no longer shows the sidebars icons row if all sidebars are disabled for that actor
-   fixed `Recovery Check` icon not doing anything
-   fixed `Close on Send-to-Chat` settings not doing anything
-   fixed some prompt dialogs having an `undefined` button label
-   fixed fps panel showing behind the hotbar when the `Persistent HUD` is enabled

# 1.0.0

-   this is a system `6.1.0` release
-   finalized the item description popup inline links functionalities and styling
-   changed the way HUD elements fade-out is handled to try to avoid some fringe browser issues
-   `Persistent HUD`:
    -   most skill actions now have a customized icon when dragged and turned into a shortcut
-   `Sidebars`:
    -   actions with `0` remaining uses will see their `Use` button replaced by a `Reset Uses` button
    -   all duplicate actions are removed from the `actions` sidebar
        -   actions that are in the `Stances` section
        -   `Element Blast` when `Channel Elements` is active
        -   skills actions present in the `skills` and `extras` sidebars
    -   now disables the `Extras` sidebar for non-creature actors
    -   implemented the `Recall Knowledge` action in the `Extras` sidebar
        -   it respects the `Show Secret Checks` system metagame setting
    -   added a new icon to show or hide stowed weapons in the `Attacks` header
    -   added lores to the `Skills` sidebar
    -   fixed skill actions in the `Extras` sidebar not working
    -   fixed not being able to drop items behind the sidebar even though it faded out
-   fixed breaking changes with skills

# 0.18.0

-   upped the foundry minimum version to `12.329`
-   HUD objects can now be directly accessed via the `globalThis` context `game.hud`
-   added an `Alliance` icon to NPC & Character HUDs (shift+click skips neutral)
-   `Persistent HUD`:
    -   switched the attack & damage icons for strikes/blasts shortcuts
    -   shortcuts are now saved on the world actor for unlinked actors and are shared between all tokens
    -   fixed persistent actor being unset when deleting a linked token (only unlinked ones should)
    -   fixed actor-less hud not showing any shortcut slot
    -   fixed the `Show Effects` icon not changing state
    -   fixed the players window context menu showing under the HUD
    -   fixed creating a new shortcut in an empty virtual slot (virtual = autofill or copied) not adding the shortcut
-   `Resources Tracker`:
    -   added an icon to the resource menu header that can be clicked to get the id of the resource
-   `Sidebars`:
    -   elemental blasts action cost toggle options are now directly embedded into the `Blasts` header
    -   fixed not being able to open the item description or send-to-chat for skill actions that are behind a feat (e.g. `Bon Mot`)
    -   fixed shortcuts for skill actions that are behind a feat not working
    -   fixed skill actions that require to be trained never showing when the `Hide Untrained` setting was enabled even if the character was trained
        -   also added support for `Untrained Improvisation`
-   `Token Tooltip`:
    -   now only ever shows the small version of the tooltip when a `Token HUD` is currently visible
    -   fixed health status not showing when hovering one of the persistent actor tokens
-   fixed hotbar being moved even when the `Persistent HUD` is disabled
-   fixed hotbar no being put back in the correct container element when disabling the `Persistent HUD`

# 0.17.2

-   `Persistent HUD`:
    -   some performance tweaks have been done
    -   fixed the HUD not occupying actual space in the left UI
        -   this was the cause for the scene navbar offset issue
        -   this was the cause for smalltime not being able to dock on the players window
        -   the players window is no longer removed from its original container anymore
-   `Token Toolip`:
    -   fixed tooltip position on hex-grid maps

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
-   added a new `Resources Tracker Tracker` HUD:

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

-   added a `Send-to-Chat` button to the item popup
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
-   the :
    -   now fade out when placing a template is now linked to its originating actor and will be re-rendered on update
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
-   :
    -   now fade out when placing a template:
    -   the popup can now be minimize and resized
    -   added a new `Popup on Cursor` setting to center the popup on the cursor when first rendered
    -   `@Damage` and `@Check` links aren't usable yet, the system has [plans](https://github.com/foundryvtt/pf2e/pull/15009) for those
-   `Sidebar`:
    -   sidebars are now planned to be shared between both the `Token HUD` and `Persistent HUD`
    -   implemented the `actions` sidebar (fully functional)

# 0.5.0

-   `Combat Tracker`
    -   prevent being able to drag & drop combatant when the tracker is collapsed
-   :
    -   now fade out when placing a template
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
-   :
    -   now fade out when placing a template
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
