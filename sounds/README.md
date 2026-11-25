# Maelstrom's own sounds

The table's own sounds, shipped with the app: a critical hit, a fumble, rolling initiative, a saving throw, a
level gained, your turn coming, and surprise (empty until its sounds are made). The dice make their own clatter
(src/dice/sound.ts).

Everything else (weapons, armour impacts, spells, creatures, bodies, traps and effects, ambience, music, voices)
comes from sound packs in `Documents/Kraken VTT/Sound Packs`: `docs/sound-folders.md` lists every folder the app
listens for, and `scripts/build-sound-packs.mjs` makes a pack from a folder laid out that way. The first test set
is `sound-packs/Placeholder` (made with ElevenLabs and YuE2; not shipped).

A GM's own sounds go in their app data (`assets/sounds`); a file there with the same path wins over a pack's and
the app's.
