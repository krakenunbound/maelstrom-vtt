# Placeholder sounds

The first test sounds, made to try the sound triggers out: sound effects, ambience and voices with ElevenLabs on
the project's own account (from the prompts in `electron/soundCatalog.cjs`; `generated.json` records the words each
was made from), music locally with YuE2 Studio (the YuE model, Apache-2.0). No Syrinscape or other licensed sounds.

They are not shipped with the app. Build them into a sound pack to play with them:

    node scripts/build-sound-packs.mjs sound-packs/Placeholder "<Documents>/Kraken VTT/Sound Packs" --name Placeholder

New packs replace them folder by folder (`docs/sound-folders.md` lists the folders).
