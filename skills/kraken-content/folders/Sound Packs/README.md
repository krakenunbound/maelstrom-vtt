<!-- kraken-vtt guide: Kraken writes this file and keeps it up to date. Edit a copy, not this one. -->
# Sound Packs

Sound effects, ambience and music for Maelstrom, as packs. Each pack is one
`.kpack` file, read where it is (nothing is unpacked). Put a pack here and its
sounds play: a weapon's swing and hit, armour taking the blow, spells, traps,
creatures, the ambience of a cave or a forest, music.

Maelstrom itself ships only the table's own sounds (crits, fumbles,
initiative, saving throws, surprise, a new turn, a level gained; the dice make
their own clatter). Everything else comes from packs, so you can swap a whole
set without touching the app.

## What a pack holds

Inside, folders by what they are for: `sfx/Weapons/Sword/Hit/`,
`sfx/Impacts/Plate/`, `ambience/Cave/`, `music/Battle/`. Each folder plays one of
its sounds at random, so five files in `sfx/Weapons/Axe/Hit/` give five
different axe hits. The full list of folders Maelstrom listens for is in
`docs/sound-folders.md` (with what each is for and how many it wants).

Make a pack from a folder laid out that way:

    node scripts/build-sound-packs.mjs "<your folder>" "<this folder>" --name "My Weapons" --id my-weapons

## Which sound wins

Your own loose sounds (**Sound > Open folder**) win over a pack's with the
same path, and a pack's win over the app's own. Two packs with the same path:
the one whose file name sorts last.

Maelstrom reads this folder when a campaign starts; a pack added while a
campaign is running shows after **Folders > Refresh**. Copy this folder to
another computer and the sounds come along.
