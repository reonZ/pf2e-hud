import { imagePath } from "foundry-pf2e";

const DEFAULT_NPC_STRIKE_ICON = "systems/pf2e/icons/default-icons/melee.svg";

/**
 * thanks to https://github.com/shemetz for the compiled list
 */
const NPC_STRIKE_ICONS: Record<string, string> = {
    jaws: "icons/creatures/abilities/mouth-teeth-long-red.webp", // Jaws
    claw: "icons/creatures/claws/claw-curved-jagged-gray.webp", // Claw
    fist: "icons/skills/melee/unarmed-punch-fist.webp", // Fist
    dagger: "icons/weapons/daggers/dagger-straight-blue.webp", // Dagger
    tail: "icons/creatures/abilities/tail-swipe-green.webp", // Tail
    shortsword: "icons/weapons/swords/sword-guard-purple.webp", // Shortsword
    fangs: "icons/creatures/abilities/mouth-teeth-sharp.webp", // Fangs
    spear: "icons/weapons/polearms/spear-flared-steel.webp", // Spear
    staff: "icons/weapons/staves/staff-simple.webp", // Staff
    shortbow: "icons/weapons/bows/shortbow-leather.webp", // Shortbow
    beak: "icons/commodities/bones/beak-hooked-red.webp", // Beak
    tentacle: "icons/creatures/tentacles/tentacles-octopus-black-pink.webp", // Tentacle
    club: "icons/weapons/clubs/club-banded-brown.webp", // Club
    longsword: "icons/weapons/swords/sword-guard-blue.webp", // Longsword
    rock: "icons/commodities/stone/boulder-grey.webp", // Rock
    wing: "icons/commodities/biological/wing-lizard-pink-purple.webp", // Wing
    hoof: "icons/commodities/biological/foot-black-grey.webp", // Hoof
    "composite-shortbow": "icons/weapons/bows/shortbow-recurve-bone.webp", // Composite Shortbow
    talon: "icons/creatures/claws/claw-talons-glowing-orange.webp", // Talon
    "composite-longbow": "icons/weapons/bows/shortbow-recurve-bone.webp", // Composite Longbow
    javelin: "icons/weapons/polearms/javelin.webp", // Javelin
    foot: "icons/commodities/claws/claw-blue-grey.webp", // Foot
    rapier: "systems/pf2e/icons/equipment/weapons/rapier.webp", // Rapier
    hatchet: "icons/weapons/axes/axe-broad-black.webp", // Hatchet
    crossbow: "icons/weapons/crossbows/crossbow-purple.webp", // Crossbow
    horn: "icons/creatures/mammals/beast-horned-scaled-glowing-orange.webp", // Horn
    bite: "icons/creatures/abilities/mouth-teeth-crooked-blue.webp", // Bite
    scimitar: "icons/weapons/swords/scimitar-worn-blue.webp", // Scimitar
    "hand-crossbow": "icons/weapons/crossbows/handcrossbow-black.webp", // Hand Crossbow
    pseudopod: "icons/commodities/biological/tongue-violet.webp", // Pseudopod
    mandibles: "icons/commodities/biological/mouth-pincer-brown.webp", // Mandibles
    trident: "icons/weapons/polearms/trident-silver-blue.webp", // Trident
    greataxe: "icons/weapons/axes/axe-double-engraved.webp", // Greataxe
    stinger: "icons/creatures/abilities/stinger-poison-scorpion-brown.webp", // Stinger
    claws: "icons/creatures/claws/claw-curved-jagged-gray.webp", // Claws
    greatsword: "icons/weapons/swords/greatsword-crossguard-silver.webp", // Greatsword
    sling: "icons/weapons/slings/slingshot-wood.webp", // Sling
    tongue: "icons/commodities/biological/tongue-pink.webp", // Tongue
    horns: "icons/creatures/mammals/beast-horned-scaled-glowing-orange.webp", // Horns
    "light-hammer": "icons/weapons/hammers/shorthammer-embossed-white.webp", // Light Hammer
    kukri: "icons/weapons/daggers/dagger-bone-worn-black.webp", // Kukri
    sap: "icons/weapons/clubs/club-baton-brown.webp", // Sap
    warhammer: "icons/weapons/hammers/hammer-war-rounding.webp", // Warhammer
    sickle: "icons/tools/hand/sickle-steel-grey.webp", // Sickle
    "ghostly-hand": "icons/magic/death/hand-withered-gray.webp", // Ghostly Hand
    tendril: "icons/creatures/tentacles/tentacle-earth-green.webp", // Tendril
    longspear: "icons/weapons/polearms/spear-simple-engraved.webp", // Longspear
    "battle-axe": "icons/weapons/axes/axe-battle-black.webp", // Battle Axe
    branch: "icons/magic/nature/root-vine-leaves-green.webp", // Branch
    glaive: "icons/weapons/polearms/glaive-simple.webp", // Glaive
    "bastard-sword": "icons/weapons/swords/sword-guard.webp",
    dart: "systems/pf2e/icons/equipment/weapons/dart.webp",
    halberd: "systems/pf2e/icons/equipment/weapons/halberd.webp",
    falchion: "icons/weapons/swords/scimitar-guard-wood.webp",
    shuriken: "systems/pf2e/icons/equipment/weapons/shuriken.webp",
    greatclub: "systems/pf2e/icons/equipment/weapons/greatclub.webp",
    "bo-staff": "icons/weapons/staves/staff-simple-gold.webp",
    scythe: "systems/pf2e/icons/equipment/weapons/scythe.webp",
    "heavy-crossbow": "icons/weapons/crossbows/crossbow-simple-black.webp",
    whip: "systems/pf2e/icons/equipment/weapons/whip.webp",
    morningstar: "systems/pf2e/icons/equipment/weapons/morningstar.webp",
    longbow: "icons/weapons/bows/longbow-recurve-leather-brown.webp",
    maul: "icons/weapons/hammers/hammer-double-steel-embossed.webp",
    "aldori-dueling-sword": "icons/weapons/swords/sword-guard-gold-red.webp",
    "spiked-chain": "systems/pf2e/icons/equipment/weapons/spiked-chain.webp",
    mace: "icons/weapons/maces/mace-flanged-steel.webp",
    gauntlet: "icons/equipment/hand/gauntlet-tooled-steel.webp",
    blowgun: "systems/pf2e/icons/equipment/weapons/blowgun.webp",
    flail: "icons/weapons/maces/flail-ball-grey.webp",
    pick: "icons/weapons/axes/pickaxe-iron-green.webp",
    ranseur: "icons/weapons/polearms/trident-curved-steel.webp",
    lance: "systems/pf2e/icons/equipment/weapons/lance.webp",
    "light-mace": "icons/weapons/maces/mace-round-steel.webp",
    "alchemists-fire-lesser":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/alchemists-fire.webp",
    dogslicer: "systems/pf2e/icons/equipment/weapons/dogslicer.webp",
    aklys: "icons/weapons/maces/mace-studded-steel.webp",
    "war-razor": "systems/pf2e/icons/equipment/weapons/war-razor.webp",
    "alchemists-fire-moderate":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/alchemists-fire.webp",
    "spiked-gauntlet": "systems/pf2e/icons/equipment/weapons/spiked-gauntlet.webp",
    starknife: "systems/pf2e/icons/equipment/weapons/starknife.webp",
    greatpick: "systems/pf2e/icons/equipment/weapons/greatpick.webp",
    "acid-flask-moderate":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/acid-flask.webp",
    "flintlock-pistol": "icons/weapons/guns/gun-pistol-flintlock-metal.webp",
    "dueling-pistol": "systems/pf2e/icons/equipment/weapons/dueling-pistol.webp",
    "ogre-hook": "systems/pf2e/icons/equipment/weapons/ogre-hook.webp",
    "sawtooth-saber": "systems/pf2e/icons/equipment/weapons/sawtooth-saber.webp",
    "war-flail": "icons/weapons/maces/flail-studded-grey.webp",
    "shield-spikes": "systems/pf2e/icons/equipment/weapons/shield-spikes.webp",
    "main-gauche": "systems/pf2e/icons/equipment/weapons/main-gauche.webp",
    guisarme: "systems/pf2e/icons/equipment/weapons/guisarme.webp",
    bola: "icons/weapons/thrown/bolas-stone.webp",
    "orc-knuckle-dagger": "systems/pf2e/icons/equipment/weapons/orc-knuckle-dagger.webp",
    "elven-curve-blade": "systems/pf2e/icons/equipment/weapons/elven-curve-blade.webp",
    "rhoka-sword": "systems/pf2e/icons/equipment/weapons/rhoka-sword.webp",
    "shield-boss": "systems/pf2e/icons/equipment/weapons/shield-boss.webp",
    katana: "systems/pf2e/icons/equipment/weapons/katana.webp",
    "temple-sword": "systems/pf2e/icons/equipment/weapons/temple-sword.webp",
    bayonet: "systems/pf2e/icons/equipment/weapons/bayonet.webp",
    "light-pick": "systems/pf2e/icons/equipment/weapons/light-pick.webp",
    "halfling-sling-staff": "systems/pf2e/icons/equipment/weapons/halfling-sling-staff.webp",
    "clan-dagger": "systems/pf2e/icons/equipment/weapons/clan-dagger.webp",
    katar: "icons/weapons/fist/fist-katar-gold.webp",
    machete: "systems/pf2e/icons/equipment/weapons/machete.webp",
    "filchers-fork": "systems/pf2e/icons/equipment/weapons/filchers-fork.webp",
    "flintlock-musket": "systems/pf2e/icons/equipment/weapons/flintlock-musket.webp",
    "orc-necksplitter": "icons/weapons/axes/axe-battle-heavy-jagged.webp",
    "sword-cane": "systems/pf2e/icons/equipment/weapons/sword-cane.webp",
    "elven-branched-spear": "icons/weapons/polearms/spear-ornate-gold.webp",
    mambele: "systems/pf2e/icons/equipment/weapons/mambele.webp",
    "flying-talon": "systems/pf2e/icons/equipment/weapons/flying-talon.webp",
    "repeating-hand-crossbow": "systems/pf2e/icons/equipment/weapons/repeating-hand-crossbow.webp",
    gaff: "systems/pf2e/icons/equipment/weapons/gaff.webp",
    "tengu-gale-blade": "systems/pf2e/icons/equipment/weapons/tengu-gale-blade.webp",
    "acid-flask-lesser":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/acid-flask.webp",
    "frost-vial-moderate":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/frost-vial.webp",
    "tamchal-chakram": "systems/pf2e/icons/equipment/weapons/tamchal-chakram.webp",
    "soul-chain": "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/soul-chain.webp",
    "nightmare-cudgel":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/nightmare-cudgel.webp",
    khopesh: "systems/pf2e/icons/equipment/weapons/khopesh.webp",
    "dragon-mouth-pistol": "icons/weapons/guns/gun-pistol-wood.webp",
    naginata: "systems/pf2e/icons/equipment/weapons/naginata.webp",
    "hook-sword": "systems/pf2e/icons/equipment/weapons/hook-sword.webp",
    "fighting-fan": "icons/commodities/materials/material-feathers-violet.webp",
    sai: "systems/pf2e/icons/equipment/weapons/sai.webp",
    "butterfly-sword": "icons/weapons/swords/scimitar-guard.webp",
    icicle: "icons/magic/water/projectile-arrow-ice-gray-blue.webp",
    "little-love": "systems/pf2e/icons/equipment/weapons/dagger.webp",
    "devils-trident": "systems/pf2e/icons/equipment/weapons/trident.webp",
    "holy-water": "systems/pf2e/icons/equipment/consumables/other-consumables/holy-water.webp",
    "knuckle-duster": "icons/weapons/fist/fist-knuckles-brass.webp",
    jax: "systems/pf2e/icons/equipment/weapons/piercing-wind.webp",
    "dwarven-scattergun": "icons/weapons/guns/gun-blunderbuss-bronze.webp",
    jezail: "icons/weapons/guns/rifle-brown.webp",
    "cane-pistol": "systems/pf2e/icons/equipment/weapons/cane-pistol.webp",
    "mace-multipistol": "systems/pf2e/icons/equipment/weapons/mace-multipistol.webp",
    blackaxe: "systems/pf2e/icons/equipment/artifacts/blackaxe.webp",
    horsechopper: "systems/pf2e/icons/equipment/weapons/horsechopper.webp",
    "rope-dart": "icons/weapons/thrown/dagger-ringed-steel.webp",
    "bloodletting-kukri":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/bloodletting-kukri.webp",
    "retribution-axe":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/retribution-axe.webp",
    "wish-knife": "icons/weapons/daggers/dagger-curved-purple.webp",
    "double-barreled-pistol": "systems/pf2e/icons/equipment/weapons/double-barreled-pistol.webp",
    "boarding-pike": "icons/weapons/polearms/spear-hooked-spike.webp",
    "vexing-vapor-moderate":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/vexing-vapor.webp",
    chakri: "systems/pf2e/icons/equipment/weapons/chakri.webp",
    visap: "icons/weapons/daggers/dagger-double-black.webp",
    "gun-sword": "systems/pf2e/icons/equipment/weapons/gun-sword.webp",
    "alchemists-fire-greater":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/alchemists-fire.webp",
    "fiends-hunger": "icons/weapons/daggers/dagger-straight-blue.webp",
    "fighters-fork":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/fighters-fork.webp",
    "scorpion-whip": "systems/pf2e/icons/equipment/weapons/scorpion-whip.webp",
    "spike-launcher": "systems/pf2e/icons/default-icons/weapon.svg",
    "shauth-lash": "systems/pf2e/icons/equipment/weapons/shauth-lash.webp",
    "shauth-blade": "systems/pf2e/icons/equipment/weapons/shauth-blade.webp",
    "battle-lute": "icons/tools/instruments/lute-gold-brown.webp",
    "staff-of-fire": "systems/pf2e/icons/equipment/staves/staff-of-fire.webp",
    "verdant-staff": "icons/weapons/staves/staff-nature-spiral.webp",
    "cinderclaw-gauntlet": "icons/equipment/hand/gauntlet-cuffed-steel-blue.webp",
    "poisoners-staff": "systems/pf2e/icons/equipment/staves/poisoners-staff.webp",
    "blade-of-the-rabbit-prince":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/blade-of-the-rabbit-prince.webp",
    scourge: "systems/pf2e/icons/equipment/weapons/scourge.webp",
    "cane-of-the-maelstrom": "systems/pf2e/icons/equipment/staves/cane-of-the-maelstrom.webp",
    gearblade: "systems/pf2e/icons/equipment/weapons/greatclub.webp",
    "bladed-scarf": "systems/pf2e/icons/equipment/weapons/bladed-scarf.webp",
    "shadows-heart": "systems/pf2e/icons/equipment/weapons/kukri.webp",
    "double-barreled-musket": "icons/weapons/guns/gun-double-barrel.webp",
    boomerang: "systems/pf2e/icons/equipment/weapons/boomerang.webp",
    ankylostar: "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/ankylostar.webp",
    "stoneraiser-javelin":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/stoneraiser-javelin.webp",
    "whip-of-compliance":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/whip-of-compliance.webp",
    "alchemical-crossbow": "icons/weapons/crossbows/handcrossbow-green.webp",
    "feng-huo-lun": "systems/pf2e/icons/default-icons/weapon.svg",
    khakkhara: "systems/pf2e/icons/equipment/weapons/khakkhara.webp",
    harpoon: "icons/weapons/polearms/spear-simple-barbed.webp",
    "spore-sap": "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/spore-sap.webp",
    "staff-of-power": "systems/pf2e/icons/equipment/staves/staff-of-power.webp",
    "hex-blaster": "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/hex-blaster.webp",
    "redeemers-pistol":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/redeemers-pistol.webp",
    "reinforced-stock": "systems/pf2e/icons/equipment/weapons/reinforced-stock.webp",
    "clan-pistol": "systems/pf2e/icons/equipment/weapons/clan-pistol.webp",
    "slide-pistol": "systems/pf2e/icons/equipment/weapons/slide-pistol.webp",
    "coat-pistol": "icons/weapons/guns/gun-pistol-flintlock.webp",
    "repeating-crossbow": "systems/pf2e/icons/equipment/weapons/repeating-crossbow.webp",
    ovinrbaane: "icons/skills/melee/blade-tip-chipped-blood-red.webp",
    oathbow: "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/oathbow.webp",
    "rod-of-razors": "icons/weapons/polearms/spear-hooked-blue.webp",
    wakizashi: "systems/pf2e/icons/equipment/weapons/wakizashi.webp",
    "frying-pan": "systems/pf2e/icons/equipment/weapons/frying-pan.webp",
    tetsubo: "systems/pf2e/icons/equipment/weapons/aklys.webp",
    "bottled-lightning-lesser":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/bottled-lightning.webp",
    blunderbuss: "icons/weapons/guns/gun-blunderbuss-worn-brown.webp",
    "dread-ampoule-greater":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/dread-ampoule.webp",
    "glue-bomb-greater": "icons/containers/bags/sack-simple-leather-tan.webp",
    "mammoth-bow": "systems/pf2e/icons/equipment/weapons/composite-longbow.webp",
    kusarigama: "systems/pf2e/icons/equipment/weapons/kama.webp",
    urumi: "systems/pf2e/icons/equipment/weapons/urumi.webp",
    "buzzsaw-axe": "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/buzzsaw-axe.webp",
    "acid-flask-greater":
        "systems/pf2e/icons/equipment/alchemical-items/alchemical-bombs/acid-flask.webp",
    "staff-of-air-greater": "icons/weapons/staves/staff-simple.webp",
    "repeating-heavy-crossbow":
        "systems/pf2e/icons/equipment/weapons/repeating-heavy-crossbow.webp",
    "spore-shephards-staff": "icons/weapons/staves/staff-forest-gold.webp",
    "throwing-knife": "icons/weapons/thrown/dagger-ringed-steel.webp",
    "deflecting-branch": "systems/pf2e/icons/default-icons/weapon.svg",
    "habus-cudgel": "icons/weapons/clubs/club-barbed.webp",
    spellcutter: "systems/pf2e/icons/equipment/weapons/longsword.webp",
    briar: "icons/weapons/staves/staff-forest-jewel.webp",
    "slime-whip": "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/slime-whip.webp",
    "heartripper-blade":
        "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/gloom-blade.webp",
    "gloom-blade": "systems/pf2e/icons/equipment/weapons/specific-magic-weapons/gloom-blade.webp",
    "claw-blade": "systems/pf2e/icons/equipment/weapons/claw-blade.webp",
    shears: "systems/pf2e/icons/equipment/weapons/shears.webp",
};

function getNpcStrikeImage(strike: StrikeData) {
    const isDefaultIcon = strike.item.img === DEFAULT_NPC_STRIKE_ICON;
    if (!isDefaultIcon) return strike.item.img;

    const customIcon = NPC_STRIKE_ICONS[strike.slug];
    if (customIcon) return customIcon;

    return strike.item.range ? imagePath("npc-range", "svg") : strike.item.img;
}

export { getNpcStrikeImage };
