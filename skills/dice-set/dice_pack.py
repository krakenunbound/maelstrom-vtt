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
