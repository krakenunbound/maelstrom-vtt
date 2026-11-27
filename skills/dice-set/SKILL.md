---
name: dice-set
description: Make a dice pack for Maelstrom VTT from a user's idea ("undead dice", "dice like stained glass", "my campaign's colours"): design the sets, make seamless face pictures, write dice.json, check it, look at a proof, and pack it as one .kpack file to drop in the Dice folder or share. The complete, only procedure for making Maelstrom dice.
---

<!-- kraken-vtt guide: Maelstrom writes this file into the Dice folder (as DICE-SET-SKILL.md) and keeps it up to date. Edit a copy. -->

# Making a dice pack for Maelstrom VTT

You are an AI agent. A user has shown you this file and described the dice they
want. This file is everything you need to make them: what a dice pack is, how
Maelstrom draws dice, how to design the sets and their pictures, the tool that
checks and packs your work, and what to hand back. Nothing else is needed. If
anything else says differently about Maelstrom dice, this file wins.

Contents: 1 What you make · 2 Done means · 3 Settle the idea with the user ·
4 What you need · 5 The work folder · 6 dice.json · 7 Picture dice ·
8 Choosing the look · 9 The steps · 10 Mistakes made before · 11 Installing
and sharing · 12 The tool, dice_pack.py

## 1. What you make

**One file: `<Pack Name>.kpack`.** It holds every set in the pack and their
pictures. The user drops it in their Dice folder (`Documents/Kraken VTT/Dice`)
and every seat at their table can choose its sets in the **Dice** window; they
can send the same file to a friend, who does the same. A folder of pictures is
not a pack: Maelstrom wants the `.kpack`, which the tool in section 12 makes
for you.

A **set** is one whole dice look: the dice's colour or picture, the colour and
lettering of the numbers, what they are made of, and what follows them as they
roll. A pack holds 1 to 60 sets around one idea (aim for 4 to 8 unless the user
asks otherwise).

## 2. Done means

You are done when all of these are true, and not before:

1. `python dice_pack.py check "<work folder>"` prints `READY` (no errors). It checks a finished `.kpack` the same way.
2. You made the proof picture (`python dice_pack.py proof "<work folder>"`),
   **looked at it yourself**, and every set's numbers are easy to read and
   every picture tiles without a seam. Warnings in the check are answered by
   looking at the proof and fixing what it shows.
3. `python dice_pack.py make "<work folder>"` printed `Packed:` and the path of
   the `.kpack`.
4. You handed over (section 9, step 8): the `.kpack`'s path, the proof picture,
   and one line per set.

## 3. Settle the idea with the user

Turn what the user said into a short plan before making anything, and show it
to them in one message: the pack's name, and each set's name with one line on
its look. Ask only what you cannot decide well yourself; otherwise choose and
say what you chose. Settle:

- **The theme**, and how many sets (default: 6).
- **Its group** in the Dice window (section 6's `group`): a class pack goes in
  `Classes`, a monster pack in `Wilds`, and so on. Choose it yourself unless the
  user said.
- **Picture dice or designed dice, or a mix.** Picture dice wear a picture you
  make (stone, bone, scales, wood, nebula). Designed dice use Maelstrom's own
  patterns and need no pictures (section 6). A mix is often best.
- **Colours** the user wants, or a palette you propose.
- Anything special: pips on the d6, no gold flare on natural 20s, a glow.

If the user said "just make it", choose everything and go without waiting:
the plan then goes in your hand-over instead.

## 4. What you need

- **Python 3.9 or newer with Pillow**: `pip install pillow`.
- **`dice_pack.py`**: it sits beside this file (in the Dice folder, or in
  `skills/dice-set/` of the Maelstrom repository). If it is missing, save the
  script in section 12 as `dice_pack.py`.
- **A way to make pictures**, for picture dice: an image model you can call,
  pictures drawn by a script (Python and Pillow can draw scales, suckers,
  cracks, rings; section 7 says how to keep them seamless), or pictures the user
  gives you. With none of these, make designed sets only (section 6), and say so.
- Optional: if Maelstrom is running and you have its MCP tools,
  `kraken_dice_packs` (`list`, `check` with `path`) shows what Maelstrom makes
  of a pack, and `kraken_dice_settings` with a set's name then `kraken_roll`
  rolls it on the table.

## 5. The work folder

Make a folder for the work, named for the pack, **outside** the Dice folder (a
half-made pack in the Dice folder would show at the table). Into it go
`dice.json` and the pictures it names:

```text
Undeath/
  dice.json
  bone.webp            a set's texture
  bone-glow.webp       its glow (optional)
  rib-cage.webp
  proof.png            made by dice_pack.py proof (not packed)
```

Only the pictures `dice.json` names go into the pack.

## 6. dice.json

```json
{
  "kraken": "dice-pack",
  "version": 1,
  "name": "Undeath",
  "author": "<the user's name, if they gave it; otherwise leave author out>",
  "description": "Grim dice: yellowed bone, crypt stone, grave light.",
  "group": "Wilds",
  "sets": [
    { "name": "Yellowed Bone", "texture": "bone.webp", "body": "#8a7a5c", "ink": "#1a120c", "material": "stone", "effect": "wisp", "font": "engrave" },
    { "name": "Grave Light", "texture": "crypt.webp", "glow": "crypt-glow.webp", "body": "#1c1e1c", "ink": "#d8f0c8", "material": "stone", "effect": "shadow", "font": "runic" },
    { "name": "Ossuary", "theme": "undead", "body": "#141210", "accent": "#4a3a28", "ink": "#d0c0a0", "material": "design", "effect": "shadow", "font": "engrave" },
    { "name": "Bone Dust", "theme": "bone", "body": "#6e6250", "accent": "#2a2218", "ink": "#f4ecd8", "material": "stone", "font": "engrave", "pips": true }
  ]
}
```

The pack:

| field | needed | what it is |
|---|---|---|
| `kraken` | yes | always `"dice-pack"` |
| `version` | yes | always `1` |
| `name` | yes | the pack's name (up to 80 characters): its group in the Dice window, and the `.kpack`'s file name |
| `author`, `description` | no | who made it; what it is |
| `group` | no | the Dice window group its sets join. Maelstrom's groups: `Cores` (gems, crystal, glass), `Relics` (holy, gilded, ornate), `Wilds` (monsters, beasts, nature, the undead), `Classes` (a character class or calling: paladin, rogue, druid), `Worlds` (a setting, an era, science fiction), `Maelstrom` (the sea, storms, the app's own). Any other name makes a group of its own; without `group`, the pack is a group named for itself |
| `sets` | yes | 1 to 60 sets |

A set:

| field | needed | values |
|---|---|---|
| `name` | yes | up to 60 characters, unique in the pack |
| `texture` | one of `texture` or `theme` | a picture in the work folder, laid on the dice's faces (section 7) |
| `glow` | no | a second picture, same size as the texture: black where nothing glows, bright where the dice shine in the dark. Needs `texture` |
| `theme` | one of `texture` or `theme` | a pattern Maelstrom paints. Painted patterns: `classic` (solid), `marble`, `swirl`, `speckle`, `stripes`, `wood`, `runes`, `dragonhide`, `starfall`, `bone`, `magma`, `leviathan`. Crafted designs, each with its own finish (use them with `"material": "design"`): `aether`, `reliquary`, `rosewindow`, `gilded`, `emerald`, `frost`, `obsidian`, `bloodstone`, `arcane`, `void`, `hero`, `monster`, `wyrm`, `undead`, `ghost`, `wizard`, `bard`, `necromancer`, `goblin`, `traveller`, `mythos` |
| `body` | yes | the dice's colour, `#rrggbb` (with a texture: the colour shown while the picture loads; pick the picture's own main colour) |
| `ink` | yes | the numbers' colour, `#rrggbb`; it must stand out from the body or picture (contrast 3:1 or more; the check measures it) |
| `accent` | no | the second colour of two-colour patterns (marble veins, swirl, speckles, stripes, wood grain, runes), `#rrggbb` |
| `material` | no | how the dice take the light: `plastic` (default), `glass`, `metal`, `pearl`, `stone`, `wood`, `design` (a crafted design's own finish) |
| `effect` | no | what trails the dice as they roll: `none`, `sparkles`, `fire`, `frost`, `arcane`, `shadow`, `glow`, `aura`, `spark`, `embers`, `wisp`, `holy`, `charge`, `notes`, `ion` |
| `font` | no | the numbers' lettering: `classic`, `bold`, `runic`, `script`, `glow`, `metal`, `engrave` |
| `pips` | no | `true`: a d6 shows dots instead of numbers |
| `crit` | no | `false`: no gold flare on a natural 20 nor red one on a 1 (on by default) |

Any other field, or a value not in these lists, is ignored by Maelstrom; the
check reports it as an error so you notice.

## 7. Picture dice

**How Maelstrom lays a picture on a die.** The picture is laid flat on each
face at one size, repeating across faces: a d6 face shows about three quarters
of the picture, a d20 face about a third, a d4 or d8 face about a half. The
numbers are written on top in the set's `ink` and `font`. So:

- **Make a pattern, not a scene.** Skulls packed together, scales, cracked
  stone, wood grain, a nebula, a lattice: something that reads in any third of
  the picture. One big skull in the middle shows on one face and is cut up on
  the rest.
- **Size the motif**: 3 to 6 motifs across the picture, so a d20 face shows one
  or two whole ones and a d6 face several.
- **Seamless (tileable)**: the right edge continues into the left, the bottom
  into the top. The check measures it, and the proof shows the picture
  repeated 2 by 2: any seam shows as a cross. Ask the image model for a
  "seamless tileable texture"; if a seam remains, fix it (offset the picture
  by half its width and height, blend or paint over the cross that appears in
  the middle, offset it back). **Drawing a picture with a script**: draw every
  shape that crosses an edge again on the other side, and make any blur or filter
  wrap too (most do not: tile the picture 3 by 3, filter that, cut the middle
  one out), or the edges will not meet.
- **No text, numbers or letters** in the picture: Maelstrom writes the numbers.
- **Readable numbers**: keep the picture's tone fairly even, with no strong
  detail crowding the middle, and pick an `ink` far from the picture's main
  tone (light ink on a dark picture, dark on a light one). A busy, high-contrast
  pattern (a dark lattice with bright bones) swallows any ink: calm it (lower
  its contrast, blur it slightly, darken or lighten it) until the numbers in
  the proof read at a glance.
- **Lit evenly from above**, with no strong shadows or highlights baked in:
  Maelstrom lights the dice itself, and uses the picture's dark lines as a
  light relief, so they look carved in.
- **Square, 512 or 1024 pixels; PNG, WebP or JPEG; under 8 MB.** WebP at
  quality 85 is a good choice.

A prompt that works (adapt the subject):
*"seamless tileable texture of yellowed carved bone with small skulls packed
together, top-down, flat even lighting, no shadows, muted colours, fine detail,
no text, no numbers"*.

**Glow pictures** (optional) make parts of the dice shine in the dark: veins of
grave light, glowing runes, embers in cracks. Make the glow from the texture
itself: the same size, black everywhere except the parts that should shine,
which are bright (white or coloured). One way: take the texture, keep only its
brightest or chosen parts, set the rest to black. A glow that is all black, or
mostly bright, is wrong (the check catches both). Leave `glow` out unless the
set should shine.

## 8. Choosing the look

- **Ink against body**: dark body, light ink (bone, parchment, gold, pale
  green); light body, dark ink. Middle tones need care: check the proof.
- **Font**: `engrave` and `runic` for stone, bone, old and grim; `metal` for
  gilt numbers; `glow` for magic, neon and ghosts; `script` for elegant;
  `bold` for loud and modern; `classic` when unsure.
- **Material**: `stone` (matte; bone, rock, earth), `wood`, `metal` (shines;
  armour, coins, machines), `glass` (light comes through; gems, ice, potions),
  `pearl` (shimmer; shells, the fey), `plastic` (resin dice). Crafted designs
  use `design`.
- **Effect**: `shadow`, `wisp` for undead and horror; `fire`, `embers` for
  flame; `frost` for ice; `arcane`, `aura`, `glow` for magic; `holy` for the
  divine; `sparkles` for the fey and festive; `spark`, `charge`, `ion` for
  lightning and science fiction; `notes` for bards; `wisp`, `aura`, `frost` for
  water and the sea; `none` for plain.
- **Variety in a pack**: vary the sets' tones (a light set, a dark set, one that
  glows) so players can tell their dice apart at the table.

## 9. The steps

1. **Plan** with the user (section 3).
2. **Make the work folder** (section 5).
3. **Make the pictures** for picture sets (section 7): WebP, PNG or JPEG, 1024
   pixels square.
4. **Write `dice.json`** (section 6).
5. **Check**, and repeat until `READY`:
   `python dice_pack.py check "<work folder>"`. Fix every `ERROR`.
6. **Proof**: `python dice_pack.py proof "<work folder>"` writes
   `proof.png` in the work folder: for each set, a d6 face and a d20 face as
   Maelstrom lays the picture and the numbers on them (cut from the picture's
   middle), the picture repeated 2 by 2, and its glow on black. **Look at it.**
   For each picture set: can you read the 6 and the 20 at a glance? Does the 2
   by 2 picture show a seam? Is the motif recognisable on the faces? Does the
   glow light only what should shine? For each designed set (shown flat: its
   pattern appears only in Maelstrom), judge the numbers against the colour.
   Does the pack as a whole look like what the user asked for? Fix what is wrong
   (back to 3 or 4), check and proof again. A proof made while the check has
   errors says `NOT READY`.
7. **Pack**: `python dice_pack.py make "<work folder>"`. It checks again,
   refuses while errors remain, and writes `<Pack Name>.kpack` into the Dice
   folder when it finds it (`Documents/Kraken VTT/Dice`, or `KRAKEN_HOME/Dice`),
   else into the current folder; `--out "<folder>"` chooses.
8. **Hand over**: the `.kpack`'s path; the proof picture (show it); one line per
   set (its name and look); any warning you chose to keep and why; and how to
   use it (section 11). If you have Maelstrom's MCP tools, also run
   `kraken_dice_packs` `list` and confirm the pack shows with no problems.

## 10. Mistakes made before

- **A folder handed over instead of a `.kpack`.** Always finish with `make`.
- **Glow pictures that are all black** (nothing glows: leave `glow` out) or
  mostly bright (the whole die glows).
- **A busy picture under the numbers** (a high-contrast lattice): numbers
  unreadable. The proof shows it; calm the picture.
- **Scenes instead of patterns**: one big motif cut up across faces.
- **Ink close to the body or picture tone**: the numbers vanish.
- **A picture that does not tile**: a hard line across faces.
- **Fields Maelstrom does not have** (`"shine"`, `"pattern"`), or values not in
  section 6's lists: silently ignored by Maelstrom.

## 11. Installing and sharing

- **Install**: put the `.kpack` in `Documents/Kraken VTT/Dice` (in Maelstrom:
  the **Dice packs folder** button in the Dice window opens it). Maelstrom reads
  the folder when a table is hosted: leave the table and host it again to see a
  new pack. Its sets appear in the Dice window as a group named for the pack,
  for the GM and every player.
- **Share**: send the `.kpack` file; your friend drops it in their Dice folder.
- **Change it later**: edit the work folder, then `make` again; the new `.kpack`
  replaces the old one.

## 12. The tool, dice_pack.py

If `dice_pack.py` is not beside this file, save everything between the two
marker lines below as `dice_pack.py`, exactly as it is.

<!-- dice_pack.py begins -->
```python
# <!-- kraken-vtt guide: Maelstrom writes this file into the Dice folder and keeps it up to date. Edit a copy. -->
"""Maelstrom dice packs: check a dice set's work folder, draw a proof picture of its sets, and pack it as a .kpack.

    python dice_pack.py check <work folder or .kpack>
    python dice_pack.py proof <work folder> [proof.png]
    python dice_pack.py make  <work folder> [--out <folder>]

Needs Python 3.9+ and Pillow (pip install pillow). The work folder holds dice.json and the pictures its sets name.
check exits 1 while any ERROR is left; make refuses to pack until check passes. It belongs to the dice-set skill (DICE-SET-SKILL.md beside it in
the Dice folder; skills/dice-set/SKILL.md in the Maelstrom repository), which holds the same script at its end.
"""
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat
except ImportError:
    sys.exit("Pillow is needed: pip install pillow")

# Maelstrom's own lists (the table's dice-look rules). A value not listed is dropped by Maelstrom.
THEMES = ["classic", "marble", "swirl", "speckle", "stripes", "wood", "runes", "dragonhide", "starfall", "bone", "magma", "leviathan"]
DESIGNS = ["aether", "reliquary", "rosewindow", "gilded", "emerald", "frost", "obsidian", "bloodstone", "arcane", "void", "hero", "monster", "wyrm", "undead", "ghost", "wizard", "bard", "necromancer", "goblin", "traveller", "mythos"]
MATERIALS = ["plastic", "glass", "metal", "pearl", "stone", "wood", "design"]
EFFECTS = ["none", "sparkles", "fire", "frost", "arcane", "shadow", "glow", "aura", "spark", "embers", "wisp", "holy", "charge", "notes", "ion"]
FONTS = ["classic", "bold", "runic", "script", "glow", "metal", "engrave"]
# The Dice window's own groups; a pack's "group" naming one of them joins it, any other name is a group of its own.
GROUPS = ["Cores", "Relics", "Wilds", "Classes", "Worlds", "Maelstrom"]
PICTURE_TYPES = {".png", ".webp", ".jpg", ".jpeg"}
MAX_PICTURE = 8 * 1024 * 1024
# How much of a picture one face shows (Maelstrom lays a picture flat on each face, 0.8 of the picture per unit).
D6_SHOWS = 0.74
D20_SHOWS = 0.36

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def luminance(rgb):
    def channel(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def rgb(hex_colour):
    return tuple(int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))


def seam_score(picture):
    """How much more the picture jumps across its wrap (last column to first, last row to first) than between any two
    neighbouring pixels inside it. A seamless texture scores about 1 to 2.5; one that does not tile, 4 and more."""
    grey = picture.convert("L")
    w, h = grey.size
    data = grey.tobytes()

    def at(x, y):
        return data[y * w + x]

    inside_x = ImageStat.Stat(ImageChops.difference(grey, ImageChops.offset(grey, 1, 0))).mean[0]
    inside_y = ImageStat.Stat(ImageChops.difference(grey, ImageChops.offset(grey, 0, 1))).mean[0]
    wrap_x = sum(abs(at(0, y) - at(w - 1, y)) for y in range(h)) / h
    wrap_y = sum(abs(at(x, 0) - at(x, h - 1)) for x in range(w)) / w
    return max(wrap_x / max(inside_x, 0.5), wrap_y / max(inside_y, 0.5))


def check(folder):
    """Returns (errors, warnings, json, pictures used)."""
    folder = Path(folder)
    errors, warnings = [], []
    path = folder / "dice.json"
    if not path.is_file():
        return [f"No dice.json in {folder}."], [], None, set()
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except ValueError as error:
        return [f"dice.json is not valid JSON: {error}"], [], None, set()
    if data.get("kraken") != "dice-pack":
        errors.append('dice.json: "kraken" must be "dice-pack".')
    if data.get("version") != 1:
        errors.append('dice.json: "version" must be 1.')
    if not isinstance(data.get("name"), str) or not data["name"].strip():
        errors.append('dice.json: "name" (the pack\'s name) is missing.')
    elif len(data["name"]) > 80:
        errors.append('dice.json: "name" is longer than 80 characters.')
    for key in data:
        if key not in ("kraken", "version", "name", "author", "description", "group", "sets"):
            errors.append(f"dice.json: \"{key}\" is not a pack field (Maelstrom ignores it).")
    if "group" in data:
        group = data["group"]
        if not isinstance(group, str) or not group.strip() or len(group) > 40:
            errors.append('dice.json: "group" must be a name of up to 40 characters.')
        elif group not in GROUPS:
            warnings.append(f"dice.json: the group \"{group}\" is not one of Maelstrom's ({', '.join(GROUPS)}); it becomes a group of its own.")
    sets = data.get("sets")
    if not isinstance(sets, list) or not sets:
        errors.append('dice.json: "sets" must be a list of 1 to 60 sets.')
        sets = []
    if len(sets) > 60:
        errors.append(f"dice.json: {len(sets)} sets; at most 60.")
    used = set()
    names = set()
    sizes = {}

    def picture(set_name, key, value):
        if not isinstance(value, str) or not value:
            errors.append(f"{set_name}: {key} must be a picture's file name.")
            return None
        file = folder / value
        if ".." in Path(value).parts or not file.is_file():
            errors.append(f"{set_name}: its {key} \"{value}\" is not in the work folder.")
            return None
        if file.suffix.lower() not in PICTURE_TYPES:
            errors.append(f"{set_name}: its {key} \"{value}\" is not PNG, WebP or JPEG.")
            return None
        if file.stat().st_size > MAX_PICTURE:
            errors.append(f"{set_name}: its {key} \"{value}\" is over 8 MB.")
        used.add(value)
        with Image.open(file) as image:
            image.load()
            sizes[value] = image.size
            return image.convert("RGB")

    for index, item in enumerate(sets):
        if not isinstance(item, dict):
            errors.append(f"Set {index + 1} is not an object.")
            continue
        name = item.get("name")
        label = name if isinstance(name, str) and name.strip() else f"Set {index + 1}"
        if not isinstance(name, str) or not name.strip():
            errors.append(f"{label}: needs a \"name\".")
        elif len(name) > 60:
            errors.append(f"{label}: its name is longer than 60 characters.")
        elif name in names:
            errors.append(f"{label}: two sets have this name.")
        names.add(name)
        for key in ("body", "ink"):
            if not HEX.match(str(item.get(key, ""))):
                errors.append(f"{label}: \"{key}\" must be a colour #rrggbb.")
        if "accent" in item and not HEX.match(str(item["accent"])):
            errors.append(f"{label}: \"accent\" must be a colour #rrggbb.")
        for key, allowed in (("material", MATERIALS), ("effect", EFFECTS), ("font", FONTS)):
            if key in item and item[key] not in allowed:
                errors.append(f"{label}: \"{key}\" \"{item[key]}\" is not one of {', '.join(allowed)}.")
        for key in ("pips", "crit"):
            if key in item and not isinstance(item[key], bool):
                errors.append(f"{label}: \"{key}\" must be true or false.")
        known = {"name", "theme", "body", "ink", "accent", "material", "effect", "font", "pips", "crit", "texture", "glow"}
        for key in item:
            if key not in known:
                errors.append(f"{label}: \"{key}\" is not a set field (Maelstrom ignores it).")
        ink_ok = HEX.match(str(item.get("ink", "")))
        if "texture" in item:
            if "theme" in item:
                errors.append(f"{label}: give a \"texture\" or a \"theme\", not both.")
            texture = picture(label, "texture", item["texture"])
            if texture is not None:
                width, height = texture.size
                if width != height or width not in (512, 1024):
                    errors.append(f"{label}: its texture is {width}x{height}; it must be square, 512 or 1024 pixels.")
                seam = seam_score(texture)
                if seam > 3.5:
                    errors.append(f"{label}: its texture does not tile (its edges jump {seam:.1f} times more than its pixels do anywhere else); make it seamless.")
                w, h = texture.size
                if ink_ok:
                    centre = texture.crop((w // 4, h // 4, w * 3 // 4, h * 3 // 4))
                    stat = ImageStat.Stat(centre)
                    mean = tuple(int(v) for v in stat.mean)
                    ratio = contrast(rgb(item["ink"]), mean)
                    if ratio < 3:
                        errors.append(f"{label}: its ink {item['ink']} is too close to its picture ({ratio:.1f}:1, needs 3:1); the numbers cannot be read.")
                    spread = ImageStat.Stat(centre.convert("L")).stddev[0]
                    if spread > 55:
                        warnings.append(f"{label}: its picture is busy in the middle (spread {spread:.0f}); look at the proof: if the numbers are hard to read, calm the picture.")
            if "glow" in item:
                glow = picture(label, "glow", item["glow"])
                if glow is not None and texture is not None:
                    if glow.size != texture.size:
                        errors.append(f"{label}: its glow is {glow.size[0]}x{glow.size[1]}, its texture {texture.size[0]}x{texture.size[1]}; they must be the same size.")
                    level = ImageStat.Stat(glow.convert("L")).mean[0]
                    if level > 90:
                        errors.append(f"{label}: its glow is mostly bright ({level:.0f}/255); it must be black except where the dice shine.")
                    if ImageStat.Stat(glow.convert("L")).extrema[0][1] < 60:
                        warnings.append(f"{label}: its glow has nothing bright in it; leave \"glow\" out instead.")
        else:
            if "glow" in item:
                errors.append(f"{label}: a \"glow\" needs a \"texture\".")
            theme = item.get("theme")
            if theme not in THEMES and theme not in DESIGNS:
                errors.append(f"{label}: \"theme\" \"{theme}\" is not one of Maelstrom's designs (or give a \"texture\").")
            if theme in DESIGNS and item.get("material") != "design":
                warnings.append(f"{label}: the {theme} design looks as made with \"material\": \"design\".")
            if ink_ok and HEX.match(str(item.get("body", ""))):
                ratio = contrast(rgb(item["ink"]), rgb(item["body"]))
                if ratio < 3:
                    errors.append(f"{label}: its ink and body are too alike ({ratio:.1f}:1, needs 3:1); the numbers cannot be read.")
    return errors, warnings, data, used


def font(size):
    for name in ("georgiab.ttf", "Georgia Bold.ttf", "DejaVuSerif-Bold.ttf", "LiberationSerif-Bold.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def proof(folder, out):
    """One picture: for each set, a d6 face and a d20 face as Maelstrom lays the picture on them, with numbers, and
    the texture repeated 2 by 2 (a seam shows as a cross through it), and its glow on black (what shines in the dark).
    Faces are cut from the picture's middle, where the check measures how busy it is."""
    folder = Path(folder)
    errors, warnings, data, _ = check(folder)
    if data is None:
        sys.exit("\n".join(errors))
    sets = [item for item in data.get("sets", []) if isinstance(item, dict)]
    cell, pad = 220, 16
    sheet = Image.new("RGB", (pad + 4 * (cell + pad) + 440, pad + len(sets) * (cell + pad)), (24, 26, 30))
    draw = ImageDraw.Draw(sheet)
    for row, item in enumerate(sets):
        top = pad + row * (cell + pad)
        body = rgb(item["body"]) if HEX.match(str(item.get("body", ""))) else (60, 60, 60)
        ink = rgb(item["ink"]) if HEX.match(str(item.get("ink", ""))) else (255, 255, 255)
        texture = None
        if isinstance(item.get("texture"), str) and (folder / item["texture"]).is_file():
            texture = Image.open(folder / item["texture"]).convert("RGB")
        for column, (shows, number, shape) in enumerate(((D6_SHOWS, "6", "square"), (D20_SHOWS, "20", "triangle"))):
            left = pad + column * (cell + pad)
            if texture is not None:
                size = int(texture.size[0] * shows)
                start = (texture.size[0] - size) // 2
                face = texture.crop((start, start, start + size, start + size)).resize((cell, cell))
            else:
                face = Image.new("RGB", (cell, cell), body)
            mask = Image.new("L", (cell, cell), 0)
            if shape == "square":
                ImageDraw.Draw(mask).rounded_rectangle((4, 4, cell - 4, cell - 4), radius=22, fill=255)
            else:
                ImageDraw.Draw(mask).polygon([(cell / 2, 6), (cell - 6, cell - 18), (6, cell - 18)], fill=255)
            sheet.paste(face, (left, top), mask)
            text_font = font(int(cell * (0.42 if number == "6" else 0.3)))
            box = draw.textbbox((0, 0), number, font=text_font)
            centre_y = top + (cell / 2 if shape == "square" else cell * 0.62)
            draw.text((left + cell / 2 - (box[2] - box[0]) / 2, centre_y - (box[3] - box[1]) / 2 - box[1]), number, fill=ink, font=text_font)
        if texture is not None:
            half = cell // 2
            small = texture.resize((half, half))
            tiled = Image.new("RGB", (cell, cell))
            for x in (0, half):
                for y in (0, half):
                    tiled.paste(small, (x, y))
            sheet.paste(tiled, (pad + 2 * (cell + pad), top))
        if texture is not None and isinstance(item.get("glow"), str) and (folder / item["glow"]).is_file():
            sheet.paste(Image.open(folder / item["glow"]).convert("RGB").resize((cell, cell)), (pad + 3 * (cell + pad), top))
        words = [item.get("name", "?"), f"texture: {item['texture']}" if texture is not None else f"design: {item.get('theme', '?')} (its pattern shows in Maelstrom)", f"{item.get('material', 'plastic')} / {item.get('effect', 'none')} / {item.get('font', 'classic')}", "left: a d6 face, a d20 face" + ("; the picture tiled 2x2" if texture is not None else "") + ("; its glow" if item.get("glow") else ""), "designed sets show flat here: see their pattern in Maelstrom" if texture is None else ""]
        for line, text in enumerate(words):
            draw.text((pad + 4 * (cell + pad), top + 10 + line * 24), str(text), fill=(230, 226, 214) if line == 0 else (170, 170, 170), font=font(18 if line == 0 else 14))
    sheet.save(out)
    print(f"Proof: {Path(out).resolve()}")
    if errors:
        print("NOT READY: the check has errors (below); fix them, then check and proof again.")
    for line in errors:
        print(f"ERROR: {line}")
    for line in warnings:
        print(f"WARNING: {line}")


def make(folder, out_dir):
    folder = Path(folder)
    errors, warnings, data, used = check(folder)
    if errors:
        for line in errors:
            print(f"ERROR: {line}")
        sys.exit("Not packed: fix the errors, then make it again.")
    name = data["name"].strip()
    manifest = {
        "format": "kraken-pack",
        "version": 3,
        "kind": "dice-pack",
        "name": name,
        "title": name,
        "author": data.get("author", ""),
        "description": data.get("description", ""),
        "sets": len(data["sets"]),
        "made": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / (re.sub(r'[<>:"/\\|?*]', "_", name) + ".kpack")
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_STORED) as pack:
        pack.writestr("kraken-pack.json", json.dumps(manifest, indent=1))
        pack.write(folder / "dice.json", "dice.json")
        for picture in sorted(used):
            pack.write(folder / picture, picture.replace("\\", "/"))
    for line in warnings:
        print(f"WARNING: {line}")
    print(f"Packed: {target.resolve()} ({len(data['sets'])} sets, {len(used)} pictures, {target.stat().st_size // 1024} KB)")


def dice_folder():
    home = Path(os.environ.get("KRAKEN_HOME") or Path.home() / "Documents" / "Kraken VTT")
    return home / "Dice"


def main():
    args = sys.argv[1:]
    if len(args) < 2 or args[0] not in ("check", "proof", "make"):
        sys.exit(__doc__)
    command, folder = args[0], args[1]
    if command == "check":
        if folder.lower().endswith(".kpack"):
            # A finished pack: unpacked to a scratch folder and checked the same way, its kraken-pack.json too.
            import tempfile
            with tempfile.TemporaryDirectory() as scratch:
                with zipfile.ZipFile(folder) as pack:
                    pack.extractall(scratch)
                    names = pack.namelist()
                errors, warnings, data, _ = check(scratch)
                manifest = Path(scratch) / "kraken-pack.json"
                if "kraken-pack.json" not in names:
                    errors.append("No kraken-pack.json in the pack.")
                elif json.loads(manifest.read_text(encoding="utf-8-sig")).get("kind") != "dice-pack":
                    errors.append('kraken-pack.json: "kind" must be "dice-pack".')
        else:
            errors, warnings, data, _ = check(folder)
        for line in errors:
            print(f"ERROR: {line}")
        for line in warnings:
            print(f"WARNING: {line}")
        sets = len(data.get("sets", [])) if isinstance(data, dict) and isinstance(data.get("sets"), list) else 0
        print(f"{'NOT READY' if errors else 'READY'}: {sets} sets, {len(errors)} errors, {len(warnings)} warnings.")
        sys.exit(1 if errors else 0)
    if command == "proof":
        proof(folder, args[2] if len(args) > 2 else str(Path(folder) / "proof.png"))
        return
    out = args[args.index("--out") + 1] if "--out" in args else str(dice_folder() if dice_folder().is_dir() else Path.cwd())
    make(folder, out)


if __name__ == "__main__":
    main()
```
<!-- dice_pack.py ends -->
