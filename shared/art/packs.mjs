// Maelstrom's art packs: what each holds, its file, and where it downloads from (the art-packs release, kept apart from
// each version's release so a new version never uploads them again). The installer's Art packs page, the start
// screen's and kraken_art_packs offer these; scripts/build-art-packs.mjs makes them; electron/artPacks.cjs reads them.

export const ART_URL = "https://github.com/krakenunbound/maelstrom-vtt/releases/download/art-packs";

/** @type {{ id: string, file: string, title: string, blurb: string, mb: number }[]} */
export const ART_PACKS = [
  { id: "monsters", file: "Maelstrom-Art-Monsters.kpack", title: "Monsters", blurb: "A portrait and a token for each creature", mb: 378 },
  { id: "fantasy", file: "Maelstrom-Art-Fantasy-Characters.kpack", title: "Fantasy Characters", blurb: "Races and classes for fantasy games, and people's faces in any game", mb: 1074 },
  { id: "scifi", file: "Maelstrom-Art-Scifi-Characters.kpack", title: "Sci-fi Characters", blurb: "Races and classes for science fiction games", mb: 135 },
  { id: "horror", file: "Maelstrom-Art-Horror-Modern-Characters.kpack", title: "Horror & Modern Characters", blurb: "For horror and modern games", mb: 31 },
];
