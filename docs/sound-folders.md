<!-- Made by scripts/sound-folders.mjs from electron/soundCatalog.cjs: edit those, then run it. -->
# Sound folders

The folders Maelstrom listens for. A sound pack (`Documents/Kraken VTT/Sound Packs`, see its README) holds
some of them; each folder plays one of its sounds at random, so five files in a folder are five variations.
**Make** is how many to aim for. A folder with nothing in it is silent and the next rule that fits plays
instead (an axe with no `Hit` sounds falls back to any melee hit). Make a pack with
`node scripts/build-sound-packs.mjs <folder> <out> --name "<Name>"`; ask the app what is still empty with
`kraken_sound` action `folders`.

319 folders (sound triggers version 3). Sounds: .mp3, .ogg, .wav, .m4a, .webm, .flac or .opus.
Weapon and impact sounds: 1 to 3 seconds, no voices. Loops (ambience): 20 seconds or more, seamless.

## Shipped with the app (the table's own)

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `sfx/Effects/Critical Hit` | a triumphant heavy impact with a bright ringing flourish, a perfect strike | attack (crit): Any critical hit | 5 |
| `sfx/Effects/Fumble` | a comic clatter and a deflating trombone wah-wah, a clumsy failure | attack (fumble): Any fumble | 5 |
| `sfx/Effects/Level Up` | a triumphant short fantasy fanfare of achievement | text: Level up | 5 |
| `sfx/Effects/Roll Initiative` | a dramatic orchestral hit and war drum, the start of a battle | init: Initiative | 5 |
| `sfx/Effects/Saving Throw` | magical wind chimes, a shimmering protective ward | save: Saving throw | 5 |
| `sfx/Effects/Surprise` | a sharp startled orchestral stab, caught off guard | text: Surprised | 5 |
| `sfx/Effects/Turn` | a soft chime when your turn comes (turn-chime; turn-console in science fiction games) | your turn | 2 |

## Weapons

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `sfx/Weapons/Axe/Attack` | a battle axe swung hard, a fast whoosh through the air | attack: Axe | 5 |
| `sfx/Weapons/Axe/Crit` | a devastating critical hit with a battle axe, a brutal crunching impact with a heavy ringing clang | attack (crit): Axe | 5 |
| `sfx/Weapons/Axe/Fumble` | a clumsy fumble with a battle axe, the weapon slipping from the hand and clattering onto stone | attack (fumble): Axe | 5 |
| `sfx/Weapons/Axe/Hit` | a battle axe striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Axe | 5 |
| `sfx/Weapons/Bite/Attack` | a beast's bite swung hard, a fast whoosh through the air | attack: Bite | 5 |
| `sfx/Weapons/Bite/Crit` | a devastating critical hit with a beast's bite, a brutal crunching impact with a heavy ringing clang | attack (crit): Bite | 5 |
| `sfx/Weapons/Bite/Fumble` | a clumsy fumble with a beast's bite, the weapon slipping from the hand and clattering onto stone | attack (fumble): Bite | 5 |
| `sfx/Weapons/Bite/Hit` | a beast's bite striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Bite | 5 |
| `sfx/Weapons/Bow/Attack` | a bow and arrow loosed, the string twanging and the shot whistling away | attack: Bow | 5 |
| `sfx/Weapons/Bow/Crit` | a bow and arrow loosed, a perfect shot punching deep into its target with a heavy thud | attack (crit): Bow | 5 |
| `sfx/Weapons/Bow/Fumble` | a bow and arrow misfired, the string snapping or the shot dropping to the ground | attack (fumble): Bow | 5 |
| `sfx/Weapons/Bow/Hit` | a bow and arrow thudding hard into its target | damage: Bow | 5 |
| `sfx/Weapons/Chain/Attack` | a whirling spiked chain swung hard, a fast whoosh through the air | attack: Chain | 5 |
| `sfx/Weapons/Chain/Crit` | a devastating critical hit with a whirling spiked chain, a brutal crunching impact with a heavy ringing clang | attack (crit): Chain | 5 |
| `sfx/Weapons/Chain/Fumble` | a clumsy fumble with a whirling spiked chain, the weapon slipping from the hand and clattering onto stone | attack (fumble): Chain | 5 |
| `sfx/Weapons/Chain/Hit` | a whirling spiked chain striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Chain | 5 |
| `sfx/Weapons/Claws/Attack` | a monster's claws swung hard, a fast whoosh through the air | attack: Claws | 5 |
| `sfx/Weapons/Claws/Crit` | a devastating critical hit with a monster's claws, a brutal crunching impact with a heavy ringing clang | attack (crit): Claws | 5 |
| `sfx/Weapons/Claws/Fumble` | a clumsy fumble with a monster's claws, the weapon slipping from the hand and clattering onto stone | attack (fumble): Claws | 5 |
| `sfx/Weapons/Claws/Hit` | a monster's claws striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Claws | 5 |
| `sfx/Weapons/Club/Attack` | a heavy wooden club swung hard, a fast whoosh through the air | attack: Club | 5 |
| `sfx/Weapons/Club/Crit` | a devastating critical hit with a heavy wooden club, a brutal crunching impact with a heavy ringing clang | attack (crit): Club | 5 |
| `sfx/Weapons/Club/Fumble` | a clumsy fumble with a heavy wooden club, the weapon slipping from the hand and clattering onto stone | attack (fumble): Club | 5 |
| `sfx/Weapons/Club/Hit` | a heavy wooden club striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Club | 5 |
| `sfx/Weapons/Crossbow/Attack` | a crossbow bolt loosed, the string twanging and the shot whistling away | attack: Crossbow | 5 |
| `sfx/Weapons/Crossbow/Crit` | a crossbow bolt loosed, a perfect shot punching deep into its target with a heavy thud | attack (crit): Crossbow | 5 |
| `sfx/Weapons/Crossbow/Fumble` | a crossbow bolt misfired, the string snapping or the shot dropping to the ground | attack (fumble): Crossbow | 5 |
| `sfx/Weapons/Crossbow/Hit` | a crossbow bolt thudding hard into its target | damage: Crossbow | 5 |
| `sfx/Weapons/Dagger/Attack` | a small dagger swung hard, a fast whoosh through the air | attack: Dagger | 5 |
| `sfx/Weapons/Dagger/Crit` | a devastating critical hit with a small dagger, a brutal crunching impact with a heavy ringing clang | attack (crit): Dagger | 5 |
| `sfx/Weapons/Dagger/Fumble` | a clumsy fumble with a small dagger, the weapon slipping from the hand and clattering onto stone | attack (fumble): Dagger | 5 |
| `sfx/Weapons/Dagger/Hit` | a small dagger striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Dagger | 5 |
| `sfx/Weapons/Flail/Attack` | a spiked chain flail swung hard, a fast whoosh through the air | attack: Flail | 5 |
| `sfx/Weapons/Flail/Crit` | a devastating critical hit with a spiked chain flail, a brutal crunching impact with a heavy ringing clang | attack (crit): Flail | 5 |
| `sfx/Weapons/Flail/Fumble` | a clumsy fumble with a spiked chain flail, the weapon slipping from the hand and clattering onto stone | attack (fumble): Flail | 5 |
| `sfx/Weapons/Flail/Hit` | a spiked chain flail striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Flail | 5 |
| `sfx/Weapons/Greatsword/Attack` | a huge two-handed greatsword swung hard, a fast whoosh through the air | attack: Greatsword | 5 |
| `sfx/Weapons/Greatsword/Crit` | a devastating critical hit with a huge two-handed greatsword, a brutal crunching impact with a heavy ringing clang | attack (crit): Greatsword | 5 |
| `sfx/Weapons/Greatsword/Fumble` | a clumsy fumble with a huge two-handed greatsword, the weapon slipping from the hand and clattering onto stone | attack (fumble): Greatsword | 5 |
| `sfx/Weapons/Greatsword/Hit` | a huge two-handed greatsword striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Greatsword | 5 |
| `sfx/Weapons/Mace/Attack` | a heavy iron mace swung hard, a fast whoosh through the air | attack: Mace | 5 |
| `sfx/Weapons/Mace/Crit` | a devastating critical hit with a heavy iron mace, a brutal crunching impact with a heavy ringing clang | attack (crit): Mace | 5 |
| `sfx/Weapons/Mace/Fumble` | a clumsy fumble with a heavy iron mace, the weapon slipping from the hand and clattering onto stone | attack (fumble): Mace | 5 |
| `sfx/Weapons/Mace/Hit` | a heavy iron mace striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Mace | 5 |
| `sfx/Weapons/Shield/Bash` | a shield bash slamming into an opponent | the GM, or a quick slot | 5 |
| `sfx/Weapons/Shield/Block` | a sword striking a raised wooden and steel shield, a heavy block | the GM, or a quick slot | 5 |
| `sfx/Weapons/Sling/Attack` | a sling stone loosed, the string twanging and the shot whistling away | attack: Sling | 5 |
| `sfx/Weapons/Sling/Crit` | a sling stone loosed, a perfect shot punching deep into its target with a heavy thud | attack (crit): Sling | 5 |
| `sfx/Weapons/Sling/Fumble` | a sling stone misfired, the string snapping or the shot dropping to the ground | attack (fumble): Sling | 5 |
| `sfx/Weapons/Sling/Hit` | a sling stone thudding hard into its target | damage: Sling | 5 |
| `sfx/Weapons/Spear/Attack` | a long spear swung hard, a fast whoosh through the air | attack: Spear | 5 |
| `sfx/Weapons/Spear/Crit` | a devastating critical hit with a long spear, a brutal crunching impact with a heavy ringing clang | attack (crit): Spear | 5 |
| `sfx/Weapons/Spear/Fumble` | a clumsy fumble with a long spear, the weapon slipping from the hand and clattering onto stone | attack (fumble): Spear | 5 |
| `sfx/Weapons/Spear/Hit` | a long spear striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Spear | 5 |
| `sfx/Weapons/Staff/Attack` | a wooden quarterstaff swung hard, a fast whoosh through the air | attack: Staff | 5 |
| `sfx/Weapons/Staff/Crit` | a devastating critical hit with a wooden quarterstaff, a brutal crunching impact with a heavy ringing clang | attack (crit): Staff | 5 |
| `sfx/Weapons/Staff/Fumble` | a clumsy fumble with a wooden quarterstaff, the weapon slipping from the hand and clattering onto stone | attack (fumble): Staff | 5 |
| `sfx/Weapons/Staff/Hit` | a wooden quarterstaff striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Staff | 5 |
| `sfx/Weapons/Sword/Attack` | a steel sword swung hard, a fast whoosh through the air | attack: Sword | 5 |
| `sfx/Weapons/Sword/Crit` | a devastating critical hit with a steel sword, a brutal crunching impact with a heavy ringing clang | attack (crit): Sword | 5 |
| `sfx/Weapons/Sword/Fumble` | a clumsy fumble with a steel sword, the weapon slipping from the hand and clattering onto stone | attack (fumble): Sword | 5 |
| `sfx/Weapons/Sword/Hit` | a steel sword striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Sword | 5 |
| `sfx/Weapons/Throwing Knife/Attack` | a thrown knife spinning through the air loosed, the string twanging and the shot whistling away | attack: Throwing Knife | 5 |
| `sfx/Weapons/Throwing Knife/Crit` | a thrown knife spinning through the air loosed, a perfect shot punching deep into its target with a heavy thud | attack (crit): Throwing Knife | 5 |
| `sfx/Weapons/Throwing Knife/Fumble` | a thrown knife spinning through the air misfired, the string snapping or the shot dropping to the ground | attack (fumble): Throwing Knife | 5 |
| `sfx/Weapons/Throwing Knife/Hit` | a thrown knife spinning through the air thudding hard into its target | damage: Throwing Knife | 5 |
| `sfx/Weapons/Thrown/Attack` | a thrown javelin loosed, the string twanging and the shot whistling away | attack: Thrown | 5 |
| `sfx/Weapons/Thrown/Crit` | a thrown javelin loosed, a perfect shot punching deep into its target with a heavy thud | attack (crit): Thrown | 5 |
| `sfx/Weapons/Thrown/Fumble` | a thrown javelin misfired, the string snapping or the shot dropping to the ground | attack (fumble): Thrown | 5 |
| `sfx/Weapons/Thrown/Hit` | a thrown javelin thudding hard into its target | damage: Thrown | 5 |
| `sfx/Weapons/Unarmed/Attack` | a bare-fisted punch swung hard, a fast whoosh through the air | attack: Unarmed | 5 |
| `sfx/Weapons/Unarmed/Crit` | a devastating critical hit with a bare-fisted punch, a brutal crunching impact with a heavy ringing clang | attack (crit): Unarmed | 5 |
| `sfx/Weapons/Unarmed/Fumble` | a clumsy fumble with a bare-fisted punch, the weapon slipping from the hand and clattering onto stone | attack (fumble): Unarmed | 5 |
| `sfx/Weapons/Unarmed/Hit` | a bare-fisted punch striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Unarmed | 5 |
| `sfx/Weapons/Warhammer/Attack` | a warhammer swung hard, a fast whoosh through the air | attack: Warhammer | 5 |
| `sfx/Weapons/Warhammer/Crit` | a devastating critical hit with a warhammer, a brutal crunching impact with a heavy ringing clang | attack (crit): Warhammer | 5 |
| `sfx/Weapons/Warhammer/Fumble` | a clumsy fumble with a warhammer, the weapon slipping from the hand and clattering onto stone | attack (fumble): Warhammer | 5 |
| `sfx/Weapons/Warhammer/Hit` | a warhammer striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Warhammer | 5 |
| `sfx/Weapons/Whip/Attack` | a leather whip swung hard, a fast whoosh through the air | attack: Whip | 5 |
| `sfx/Weapons/Whip/Crit` | a devastating critical hit with a leather whip, a brutal crunching impact with a heavy ringing clang | attack (crit): Whip | 5 |
| `sfx/Weapons/Whip/Fumble` | a clumsy fumble with a leather whip, the weapon slipping from the hand and clattering onto stone | attack (fumble): Whip | 5 |
| `sfx/Weapons/Whip/Hit` | a leather whip striking an armoured opponent, a solid impact of steel on armour and flesh | damage: Whip | 5 |

## Armour and hide: where a blow lands

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `sfx/Impacts/Chain` | a weapon striking chain mail, a jangling crunch of metal rings | a weapon's blow landing on that armour | 5 |
| `sfx/Impacts/Cloth` | a weapon striking cloth robes and the body beneath, a soft thump | a weapon's blow landing on that armour | 5 |
| `sfx/Impacts/Flesh` | a weapon striking a creature's hide and flesh, a meaty thwack | a weapon's blow landing on that armour | 5 |
| `sfx/Impacts/Leather` | a weapon striking leather armour, a dull leathery thud | a weapon's blow landing on that armour | 5 |
| `sfx/Impacts/Plate` | a weapon striking plate armour, a loud metallic clang | a weapon's blow landing on that armour | 5 |

## Spells

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `sfx/Spells/Acid/Cast` | a wizard casting hissing acid magic, a rising magical charge | attack: Acid spell | 5 |
| `sfx/Spells/Acid/Crit` | hissing acid magic exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Acid/Fumble` | hissing acid magic backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Acid/Hit` | hissing acid magic striking its target with a powerful impact | damage: Acid spell | 5 |
| `sfx/Spells/Arcane/Cast` | a wizard casting shimmering arcane magic, a rising magical charge | cast: Arcane | 5 |
| `sfx/Spells/Arcane/Crit` | shimmering arcane magic exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Arcane/Fumble` | shimmering arcane magic backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Arcane/Hit` | shimmering arcane magic striking its target with a powerful impact | the GM, or a quick slot | 5 |
| `sfx/Spells/Fire/Cast` | a wizard casting roaring fire magic, a rising magical charge | attack: Fire spell | 5 |
| `sfx/Spells/Fire/Crit` | roaring fire magic exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Fire/Fumble` | roaring fire magic backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Fire/Hit` | roaring fire magic striking its target with a powerful impact | damage: Fire spell | 5 |
| `sfx/Spells/Force/Cast` | a wizard casting glowing arcane force bolts, a rising magical charge | attack: Force spell | 5 |
| `sfx/Spells/Force/Crit` | glowing arcane force bolts exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Force/Fumble` | glowing arcane force bolts backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Force/Hit` | glowing arcane force bolts striking its target with a powerful impact | damage: Force spell | 5 |
| `sfx/Spells/Holy/Cast` | a wizard casting radiant holy magic with a heavenly choir, a rising magical charge | attack: Holy spell | 5 |
| `sfx/Spells/Holy/Crit` | radiant holy magic with a heavenly choir exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Holy/Fumble` | radiant holy magic with a heavenly choir backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Holy/Hit` | radiant holy magic with a heavenly choir striking its target with a powerful impact | damage: Holy spell | 5 |
| `sfx/Spells/Ice/Cast` | a wizard casting freezing ice magic, a rising magical charge | attack: Ice spell | 5 |
| `sfx/Spells/Ice/Crit` | freezing ice magic exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Ice/Fumble` | freezing ice magic backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Ice/Hit` | freezing ice magic striking its target with a powerful impact | damage: Ice spell | 5 |
| `sfx/Spells/Lightning/Cast` | a wizard casting crackling lightning magic, a rising magical charge | attack: Lightning spell | 5 |
| `sfx/Spells/Lightning/Crit` | crackling lightning magic exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Lightning/Fumble` | crackling lightning magic backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Lightning/Hit` | crackling lightning magic striking its target with a powerful impact | damage: Lightning spell | 5 |
| `sfx/Spells/Nature/Cast` | a wizard casting rustling earthy nature magic, a rising magical charge | attack: Nature spell | 5 |
| `sfx/Spells/Nature/Crit` | rustling earthy nature magic exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Nature/Fumble` | rustling earthy nature magic backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Nature/Hit` | rustling earthy nature magic striking its target with a powerful impact | damage: Nature spell | 5 |
| `sfx/Spells/Necrotic/Cast` | a wizard casting dark necrotic magic with ghostly whispers, a rising magical charge | attack: Necrotic spell | 5 |
| `sfx/Spells/Necrotic/Crit` | dark necrotic magic with ghostly whispers exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Necrotic/Fumble` | dark necrotic magic with ghostly whispers backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Necrotic/Hit` | dark necrotic magic with ghostly whispers striking its target with a powerful impact | damage: Necrotic spell | 5 |
| `sfx/Spells/Poison/Cast` | a wizard casting bubbling poison magic, a rising magical charge | attack: Poison spell | 5 |
| `sfx/Spells/Poison/Crit` | bubbling poison magic exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Poison/Fumble` | bubbling poison magic backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Poison/Hit` | bubbling poison magic striking its target with a powerful impact | damage: Poison spell | 5 |
| `sfx/Spells/Psychic/Cast` | a wizard casting eerie psychic magic, a rising magical charge | attack: Psychic spell | 5 |
| `sfx/Spells/Psychic/Crit` | eerie psychic magic exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Psychic/Fumble` | eerie psychic magic backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Psychic/Hit` | eerie psychic magic striking its target with a powerful impact | damage: Psychic spell | 5 |
| `sfx/Spells/Thunder/Cast` | a wizard casting a booming thunderclap spell, a rising magical charge | attack: Thunder spell | 5 |
| `sfx/Spells/Thunder/Crit` | a booming thunderclap spell exploding with overwhelming force on its target | the GM, or a quick slot | 5 |
| `sfx/Spells/Thunder/Fumble` | a booming thunderclap spell backfiring and sputtering out with a sad fizzle | the GM, or a quick slot | 5 |
| `sfx/Spells/Thunder/Hit` | a booming thunderclap spell striking its target with a powerful impact | damage: Thunder spell | 5 |

## Creatures

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `sfx/Animals/Bat/Attack` | a giant bat attacking with a vicious roar | attack: Bat attacks | 5 |
| `sfx/Animals/Bat/Death` | a giant bat being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Bat/Hurt` | a giant bat getting hit and crying out in pain | damage: Bat hurt | 5 |
| `sfx/Animals/Bear/Attack` | a huge angry bear attacking with a vicious roar | attack: Bear attacks | 5 |
| `sfx/Animals/Bear/Death` | a huge angry bear being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Bear/Hurt` | a huge angry bear getting hit and crying out in pain | damage: Bear hurt | 5 |
| `sfx/Animals/Big Cat/Attack` | a big wild cat attacking with a vicious roar | attack: Big Cat attacks | 5 |
| `sfx/Animals/Big Cat/Death` | a big wild cat being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Big Cat/Hurt` | a big wild cat getting hit and crying out in pain | damage: Big Cat hurt | 5 |
| `sfx/Animals/Bird of Prey/Attack` | a screeching bird of prey attacking with a vicious roar | attack: Bird of Prey attacks | 5 |
| `sfx/Animals/Bird of Prey/Death` | a screeching bird of prey being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Bird of Prey/Hurt` | a screeching bird of prey getting hit and crying out in pain | damage: Bird of Prey hurt | 5 |
| `sfx/Animals/Boar/Attack` | a wild boar attacking with a vicious roar | attack: Boar attacks | 5 |
| `sfx/Animals/Boar/Death` | a wild boar being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Boar/Hurt` | a wild boar getting hit and crying out in pain | damage: Boar hurt | 5 |
| `sfx/Animals/Crocodile/Attack` | a crocodile attacking with a vicious roar | attack: Crocodile attacks | 5 |
| `sfx/Animals/Crocodile/Death` | a crocodile being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Crocodile/Hurt` | a crocodile getting hit and crying out in pain | damage: Crocodile hurt | 5 |
| `sfx/Animals/Horse/Attack` | a horse attacking with a vicious roar | attack: Horse attacks | 5 |
| `sfx/Animals/Horse/Death` | a horse being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Horse/Hurt` | a horse getting hit and crying out in pain | damage: Horse hurt | 5 |
| `sfx/Animals/Rat/Attack` | a giant rat attacking with a vicious roar | attack: Rat attacks | 5 |
| `sfx/Animals/Rat/Death` | a giant rat being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Rat/Hurt` | a giant rat getting hit and crying out in pain | damage: Rat hurt | 5 |
| `sfx/Animals/Snake/Attack` | a hissing giant snake attacking with a vicious roar | attack: Snake attacks | 5 |
| `sfx/Animals/Snake/Death` | a hissing giant snake being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Snake/Hurt` | a hissing giant snake getting hit and crying out in pain | damage: Snake hurt | 5 |
| `sfx/Animals/Spider/Attack` | a giant spider attacking with a vicious roar | attack: Spider attacks | 5 |
| `sfx/Animals/Spider/Death` | a giant spider being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Spider/Hurt` | a giant spider getting hit and crying out in pain | damage: Spider hurt | 5 |
| `sfx/Animals/Wolf/Attack` | a snarling wolf attacking with a vicious roar | attack: Wolf attacks | 5 |
| `sfx/Animals/Wolf/Death` | a snarling wolf being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Animals/Wolf/Hurt` | a snarling wolf getting hit and crying out in pain | damage: Wolf hurt | 5 |
| `sfx/Monsters/Demon/Attack` | a roaring demon attacking with a vicious roar | attack: Demon attacks | 5 |
| `sfx/Monsters/Demon/Death` | a roaring demon being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Demon/Hurt` | a roaring demon getting hit and crying out in pain | damage: Demon hurt | 5 |
| `sfx/Monsters/Dragon/Attack` | a colossal dragon attacking with a vicious roar | attack: Dragon attacks | 5 |
| `sfx/Monsters/Dragon/Death` | a colossal dragon being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Dragon/Hurt` | a colossal dragon getting hit and crying out in pain | damage: Dragon hurt | 5 |
| `sfx/Monsters/Elemental/Attack` | a rumbling elemental attacking with a vicious roar | attack: Elemental attacks | 5 |
| `sfx/Monsters/Elemental/Death` | a rumbling elemental being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Elemental/Hurt` | a rumbling elemental getting hit and crying out in pain | damage: Elemental hurt | 5 |
| `sfx/Monsters/Ghost/Attack` | a wailing ghost attacking with a vicious roar | attack: Ghost attacks | 5 |
| `sfx/Monsters/Ghost/Death` | a wailing ghost being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Ghost/Hurt` | a wailing ghost getting hit and crying out in pain | damage: Ghost hurt | 5 |
| `sfx/Monsters/Giant/Attack` | a towering giant attacking with a vicious roar | attack: Giant attacks | 5 |
| `sfx/Monsters/Giant/Death` | a towering giant being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Giant/Hurt` | a towering giant getting hit and crying out in pain | damage: Giant hurt | 5 |
| `sfx/Monsters/Goblin/Attack` | a small cackling goblin attacking with a vicious roar | attack: Goblin attacks | 5 |
| `sfx/Monsters/Goblin/Death` | a small cackling goblin being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Goblin/Hurt` | a small cackling goblin getting hit and crying out in pain | damage: Goblin hurt | 5 |
| `sfx/Monsters/Harpy/Attack` | a shrieking harpy attacking with a vicious roar | attack: Harpy attacks | 5 |
| `sfx/Monsters/Harpy/Death` | a shrieking harpy being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Harpy/Hurt` | a shrieking harpy getting hit and crying out in pain | damage: Harpy hurt | 5 |
| `sfx/Monsters/Insect Swarm/Attack` | a buzzing insect swarm attacking with a vicious roar | attack: Insect Swarm attacks | 5 |
| `sfx/Monsters/Insect Swarm/Death` | a buzzing insect swarm being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Insect Swarm/Hurt` | a buzzing insect swarm getting hit and crying out in pain | damage: Insect Swarm hurt | 5 |
| `sfx/Monsters/Minotaur/Attack` | a bellowing minotaur attacking with a vicious roar | attack: Minotaur attacks | 5 |
| `sfx/Monsters/Minotaur/Death` | a bellowing minotaur being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Minotaur/Hurt` | a bellowing minotaur getting hit and crying out in pain | damage: Minotaur hurt | 5 |
| `sfx/Monsters/Ogre/Attack` | a huge lumbering ogre attacking with a vicious roar | attack: Ogre attacks | 5 |
| `sfx/Monsters/Ogre/Death` | a huge lumbering ogre being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Ogre/Hurt` | a huge lumbering ogre getting hit and crying out in pain | damage: Ogre hurt | 5 |
| `sfx/Monsters/Ooze/Attack` | a gurgling slime attacking with a vicious roar | attack: Ooze attacks | 5 |
| `sfx/Monsters/Ooze/Death` | a gurgling slime being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Ooze/Hurt` | a gurgling slime getting hit and crying out in pain | damage: Ooze hurt | 5 |
| `sfx/Monsters/Orc/Attack` | a brutish orc warrior attacking with a vicious roar | attack: Orc attacks | 5 |
| `sfx/Monsters/Orc/Death` | a brutish orc warrior being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Orc/Hurt` | a brutish orc warrior getting hit and crying out in pain | damage: Orc hurt | 5 |
| `sfx/Monsters/Skeleton/Attack` | a rattling skeleton warrior attacking with a vicious roar | attack: Skeleton attacks | 5 |
| `sfx/Monsters/Skeleton/Death` | a rattling skeleton warrior being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Skeleton/Hurt` | a rattling skeleton warrior getting hit and crying out in pain | damage: Skeleton hurt | 5 |
| `sfx/Monsters/Vampire/Attack` | a sinister vampire lord attacking with a vicious roar | attack: Vampire attacks | 5 |
| `sfx/Monsters/Vampire/Death` | a sinister vampire lord being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Vampire/Hurt` | a sinister vampire lord getting hit and crying out in pain | damage: Vampire hurt | 5 |
| `sfx/Monsters/Werewolf/Attack` | a howling werewolf attacking with a vicious roar | attack: Werewolf attacks | 5 |
| `sfx/Monsters/Werewolf/Death` | a howling werewolf being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Werewolf/Hurt` | a howling werewolf getting hit and crying out in pain | damage: Werewolf hurt | 5 |
| `sfx/Monsters/Zombie/Attack` | a rotting zombie attacking with a vicious roar | attack: Zombie attacks | 5 |
| `sfx/Monsters/Zombie/Death` | a rotting zombie being killed, a final dying cry and collapse | the GM, or a quick slot | 5 |
| `sfx/Monsters/Zombie/Hurt` | a rotting zombie getting hit and crying out in pain | damage: Zombie hurt | 5 |

## Bodies: wounds, death, healing

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `sfx/Body/Badly Wounded` | a warrior badly wounded, a loud scream of pain | text: Badly wounded | 5 |
| `sfx/Body/Bandage` | cloth bandages being torn and wrapped tightly around a wound | text: Bandage | 5 |
| `sfx/Body/Death` | a warrior dying, a last breath and armour collapsing to the ground | text: Death | 5 |
| `sfx/Body/Dying` | a warrior collapsing, dying, a long anguished groan | text: Dying | 5 |
| `sfx/Body/Heal` | warm healing magic, a soft glowing chime and a relieved breath | heal: Healing | 5 |
| `sfx/Body/Potion` | uncorking a glass potion bottle, gulping it down and a satisfied sigh | text: Potion | 5 |
| `sfx/Body/Resurrect` | a divine resurrection, a rising heavenly choir and a sudden gasp of breath | text: Resurrection | 5 |
| `sfx/Body/Stabilised` | a dying person's breathing steadying, a calm sigh | text: Stabilised | 5 |
| `sfx/Body/Unconscious` | a person falling unconscious, a groan and a body slumping to the floor | text: Unconscious | 5 |
| `sfx/Body/Wounded` | a woman hurt in battle, a pained gasp | text: Wounded | 5 |

## Traps, doors, treasure and other effects

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `sfx/Effects/Bell` | a large church bell tolling once | the GM, or a quick slot | 5 |
| `sfx/Effects/Book` | turning the pages of an old book | the GM, or a quick slot | 5 |
| `sfx/Effects/Crowd/Cheer` | a tavern crowd cheering | the GM, or a quick slot | 5 |
| `sfx/Effects/Crowd/Gasp` | a crowd gasping in shock | the GM, or a quick slot | 5 |
| `sfx/Effects/Doors/Iron Door` | a heavy iron dungeon door grinding open | the GM, or a quick slot | 5 |
| `sfx/Effects/Doors/Locked` | rattling a locked door handle | the GM, or a quick slot | 5 |
| `sfx/Effects/Doors/Portcullis` | an iron portcullis being raised with chains | the GM, or a quick slot | 5 |
| `sfx/Effects/Doors/Slam` | a door slamming shut with a boom | the GM, or a quick slot | 5 |
| `sfx/Effects/Doors/Wooden Door` | a heavy wooden door creaking open slowly | the GM, or a quick slot | 5 |
| `sfx/Effects/Evil Laugh` | a villain's evil laugh echoing | the GM, or a quick slot | 5 |
| `sfx/Effects/Footsteps` | heavy footsteps approaching in a stone corridor | the GM, or a quick slot | 5 |
| `sfx/Effects/Glass Shatter` | a glass bottle shattering on stone | the GM, or a quick slot | 5 |
| `sfx/Effects/Lever` | pulling a heavy stone lever with a clunk | the GM, or a quick slot | 5 |
| `sfx/Effects/Magic/Explosion` | a huge magical explosion | the GM, or a quick slot | 5 |
| `sfx/Effects/Magic/Portal` | a magical portal swirling open | the GM, or a quick slot | 5 |
| `sfx/Effects/Magic/Teleport` | a magical teleport whoosh | the GM, or a quick slot | 5 |
| `sfx/Effects/Resist` | a magical shield flaring and repelling a spell | the GM, or a quick slot | 5 |
| `sfx/Effects/Scream` | a terrified scream in the distance | the GM, or a quick slot | 5 |
| `sfx/Effects/Secret Door` | a hidden stone wall sliding open with grinding | the GM, or a quick slot | 5 |
| `sfx/Effects/Torch` | lighting a torch, a whoosh of flame | the GM, or a quick slot | 5 |
| `sfx/Effects/Traps/Boulder` | a huge boulder rolling and rumbling down a corridor | a trap or pit sprung on the map | 5 |
| `sfx/Effects/Traps/Click` | a pressure plate clicking underfoot | a trap or pit sprung on the map | 5 |
| `sfx/Effects/Traps/Darts` | poison darts shooting from the wall | a trap or pit sprung on the map | 5 |
| `sfx/Effects/Traps/Pit` | the floor giving way and rocks falling into a pit | a trap or pit sprung on the map | 5 |
| `sfx/Effects/Traps/Spikes` | a spike trap springing out of the floor | a trap or pit sprung on the map | 5 |
| `sfx/Effects/Traps/Sprung` | a hidden trap springing with a sharp mechanical snap | a trap or pit sprung on the map | 5 |
| `sfx/Effects/Treasure/Chest` | a wooden treasure chest creaking open | the GM, or a quick slot | 5 |
| `sfx/Effects/Treasure/Coins` | a handful of gold coins jingling | the GM, or a quick slot | 5 |
| `sfx/Effects/Treasure/Gem` | a sparkling magical chime as a gem is found | the GM, or a quick slot | 5 |
| `sfx/Effects/War Horn` | a war horn blowing a call to battle | the GM, or a quick slot | 5 |
| `sfx/Effects/Weather/Thunder` | a loud crack of thunder | the GM, or a quick slot | 5 |

## Ambience (loops)

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `ambience/Battlefield` | a distant battle, clashing swords, shouts and war cries | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Blacksmith` | a blacksmith's forge, hammering metal and bellows | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Blizzard` | a fierce blizzard, howling icy wind | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Busy City` | a busy medieval city street, crowds, carts and merchants calling | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Campfire` | a crackling campfire at night with crickets | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Cave` | a damp cave, water dripping and a low echoing hum | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Crypt` | an ancient crypt, eerie wind and stone settling | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Desert` | hot desert wind blowing sand | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Docks` | a harbour dock, seagulls, creaking ropes and lapping water | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Dripping Water` | water dripping slowly in a dark stone cave, echoing drops | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Dungeon` | a dark stone dungeon, distant dripping, chains rattling and a faint moan | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Forest at Night` | a forest at night, crickets, an owl hooting and wind in the trees | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Forest by Day` | a forest in the daytime, birds, rustling leaves and a distant woodpecker | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Gentle Meadow` | a gentle summer meadow, birdsong, buzzing insects and a soft breeze | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Graveyard at Night` | a graveyard at night, wind, a crow and creaking branches | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Insects` | insects buzzing and chirping in the undergrowth | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Jungle` | a dense tropical jungle, exotic birds, monkeys and insects | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Lava Cavern` | a volcanic cavern, bubbling lava and hissing steam | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Market` | a medieval market square, haggling merchants and livestock | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Mountain Wind` | strong wind howling across a mountain peak | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Ocean Shore` | waves breaking gently on a beach with seagulls | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Rain` | steady rain falling on a forest | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Rats` | rats squeaking and scurrying in the walls and the straw | the GM (ambience, music, a map's sound) | 3 |
| `ambience/River` | a flowing river over rocks | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Rural Village` | a quiet rural village, chickens, a dog barking and villagers chatting | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Sewers` | city sewers, running water, rats squeaking and dripping | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Ship at Sea` | a wooden sailing ship at sea, creaking hull, flapping sails and waves | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Snow` | a quiet snowy landscape, soft wind and crunching snow | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Swamp` | a murky swamp, frogs croaking, bubbling water and buzzing flies | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Tavern` | a busy medieval tavern, chatter, laughter and clinking mugs | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Temple` | a quiet stone temple, soft chanting and echoes | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Throne Room` | a grand throne room, quiet murmuring courtiers and echoes | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Thunderstorm` | a heavy thunderstorm with rolling thunder | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Underdark` | a vast underground cavern, deep rumbles and distant echoes | the GM (ambience, music, a map's sound) | 3 |
| `ambience/Waterfall` | a roaring waterfall | the GM (ambience, music, a map's sound) | 3 |

## Music

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `music/Battle` | epic orchestral fantasy battle music, drums and brass, intense | the GM (ambience, music, a map's sound) | 3 |
| `music/Boss Battle` | dark epic boss battle music, choir and heavy percussion | the GM (ambience, music, a map's sound) | 3 |
| `music/Dungeon` | tense dark ambient dungeon music, low drones and sparse percussion | the GM (ambience, music, a map's sound) | 3 |
| `music/Exploration` | calm orchestral fantasy exploration music, strings and harp, peaceful adventure | the GM (ambience, music, a map's sound) | 3 |
| `music/Mystery` | mysterious magical fantasy music, celesta and soft strings | the GM (ambience, music, a map's sound) | 3 |
| `music/Sad` | a sad emotional fantasy piano and strings theme | the GM (ambience, music, a map's sound) | 3 |
| `music/Tavern` | lively medieval tavern music with lute, fiddle and drum | the GM (ambience, music, a map's sound) | 3 |
| `music/Victory` | a triumphant fantasy victory fanfare with brass | the GM (ambience, music, a map's sound) | 3 |

## Voices

| Folder | What goes in it | What plays it | Make |
|---|---|---|---|
| `oneshots/Barmaid` | a voice: "Mind your hands." | the GM, or a quick slot | 5 |
| `oneshots/Goblin` | a voice: "Mine! All mine!" | the GM, or a quick slot | 5 |
| `oneshots/Guard` | a voice: "Alright, you may pass." | the GM, or a quick slot | 5 |
| `oneshots/Innkeeper` | a voice: "Safe travels, friends." | the GM, or a quick slot | 5 |
| `oneshots/Merchant` | a voice: "You drive a hard bargain." | the GM, or a quick slot | 5 |
| `oneshots/Old Wizard` | a voice: "Leave me to my studies." | the GM, or a quick slot | 5 |
| `oneshots/Orc` | a voice: "Grrraagh!" | the GM, or a quick slot | 5 |
| `oneshots/Party` | a voice: "On my mark." | the GM, or a quick slot | 5 |
| `oneshots/Priest` | a voice: "Rest here, and be healed." | the GM, or a quick slot | 5 |
| `oneshots/Sorceress` | a voice: "Come closer, little ones." | the GM, or a quick slot | 5 |
| `oneshots/Townsfolk` | a voice: "Thank you, kind heroes." | the GM, or a quick slot | 5 |
| `oneshots/Villain` | a voice: "This isn't over!" | the GM, or a quick slot | 5 |
