import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import type { Session } from "../session/useSession";
import { dicePacks } from "./dicePacks";
import type { DiceKind } from "./models";
import { characterDice, DESIGNS, DICE_LOOK_DRAG, diceStore, EFFECTS, FONTS, MATERIALS, PRESETS, SET_GROUPS, type DiceLook, type DiceSet } from "./diceStore";
import { SettingRow, Toggle } from "../ui/SettingsParts";

// The preview's three.js loads with the window.
const DicePreview = lazy(() => import("./DicePreview"));

const FONT_STYLE: Record<DiceLook["font"], React.CSSProperties> = {
  classic: { fontFamily: "Georgia, serif", fontWeight: 700 },
  bold: { fontFamily: '"Arial Black", "Segoe UI Black", Impact, sans-serif', fontWeight: 900 },
  runic: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 700 },
  script: { fontFamily: '"Palatino Linotype", Palatino, serif', fontStyle: "italic", fontWeight: 700 },
  glow: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 700, textShadow: "0 0 6px currentColor" },
  metal: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 700, color: "#e8c46a" },
  engrave: { fontFamily: "Cinzel, Georgia, serif", fontWeight: 700, opacity: 0.8 },
};
const TRAY_DICE = [20, 12, 10, 8, 6, 4, 100];

// A preset is the whole look: pips only where it has them (not left over from the set before).
// (and its picture only where it has one).
const lookOf = ({ name: _name, family: _family, ...look }: { name: string; family?: string } & DiceLook): DiceLook => ({ ...look, pips: Boolean(look.pips), texture: look.texture, glowTexture: look.glowTexture });
function sameLook(a: DiceLook, b: DiceLook) {
  return (["theme", "body", "ink", "accent", "material", "effect", "font", "texture", "glowTexture"] as const).every((key) => a[key] === b[key]) && Boolean(a.pips) === Boolean(b.pips);
}
// Kraken's sets, then each dice pack's (a group of its own).
type Shown = { name: string; family?: string } & DiceLook;
const nameIn = (all: Shown[], look: DiceLook) => all.find((preset) => sameLook(look, preset))?.name ?? null;

// 3D pictures of dice (the tray's renderer), drawn when the window opens.
function usePictures<T>(load: () => Promise<T>, key: string, empty: T) {
  const [pictures, setPictures] = useState<T>(empty);
  useEffect(() => {
    let live = true;
    void load()
      .then((result) => live && setPictures(result))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return pictures;
}

function Chips<T extends string>({ label, items, value, onPick, styleOf }: { label: string; items: { id: T; name: string }[]; value: T; onPick: (id: T) => void; styleOf?: (id: T) => React.CSSProperties }) {
  return (
    <div className="dice-field">
      <span className="dice-settings-head">{label}</span>
      <div className="dice-chips" role="radiogroup" aria-label={label}>
        {items.map((item) => (
          <button key={item.id} type="button" role="radio" aria-checked={value === item.id} className={value === item.id ? "dice-chip on" : "dice-chip"} data-choice={item.id} style={styleOf?.(item.id)} onClick={() => onPick(item.id)}>
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stepper({ label, value, onChange, low, high }: { label: string; value: number; onChange: (value: number) => void; low: number; high: number }) {
  const step = (by: number) => onChange(Math.min(high, Math.max(low, Math.round((value + by) * 10) / 10)));
  return (
    <span className="dice-stepper">
      <b>{label}</b>
      <button type="button" aria-label={`Smaller ${label.toLowerCase()} dice`} onClick={() => step(-0.1)} disabled={value <= low}>
        −
      </button>
      <span>{Math.round(value * 100)}%</span>
      <button type="button" aria-label={`Bigger ${label.toLowerCase()} dice`} onClick={() => step(0.1)} disabled={value >= high}>
        +
      </button>
    </span>
  );
}

// This seat's dice, laid out as FG's Dice window: the active set (live, with
// its colours), the dice as they show in the tray with the Tray and Roll
// sizes, every set to choose from, and the parts to make a set of your own.
// Everyone at the table sees your dice as you set them here.
// Two tiers: your own (the user tier: your dice and your colour, kept for you
// by the GM's app under your name) and each of your characters' (kept on the
// character: every roll made as that character uses them).
export const PALETTE = ["#e8c46a", "#ff5a5a", "#ff9f43", "#ffe066", "#6ee7a0", "#4fd6d0", "#5aa9ff", "#a78bfa", "#ff7ad9", "#f4f1ea"];
export function DiceWindow({ session }: { session: Session }) {
  const settings = useSyncExternalStore(diceStore.subscribe, diceStore.settings);
  // Whose dice: "" mine, else one of my characters (its record id).
  const me = session.players.find((seat) => seat.id === session.selfId)?.name ?? "";
  const characters = session.role === "dm" ? [] : Object.values(session.records).filter((record) => record.type === "character" && record.owner === me).sort((a, b) => a.name.localeCompare(b.name));
  const [whose, setWhose] = useState("");
  const character = whose ? (characters.find((record) => record.id === whose) ?? null) : null;
  const theirs = characterDice(character);
  // FG's dice sets: my dice; the GM's NPC dice; damage dice. A set left "as my dice" follows mine.
  const [chosen, setEditing] = useState<DiceSet>("look");
  const editing: DiceSet = character && chosen === "npc" ? "look" : chosen;
  const charSet = editing === "damage" ? "damage" : "look";
  const mineFor = editing === "damage" ? (settings.damage ?? settings.look) : settings.look;
  const own = character ? (charSet === "look" ? (theirs?.look ?? null) : (theirs?.damage ?? null)) : editing === "look" ? null : settings[editing];
  const look = own ?? (character ? (charSet === "damage" ? (theirs?.look ?? mineFor) : mineFor) : settings.look);
  const saveCharacter = (dice: Record<string, unknown>) => {
    if (character) void session.op({ op: "update", id: character.id, patch: { data: { dice } } }).catch(() => undefined);
  };
  const setLook = (patch: Partial<DiceLook>) => (character ? saveCharacter({ [charSet]: { ...look, ...patch } }) : diceStore.update({ [editing]: patch }));
  const following = character ? own === null : editing !== "look" && own === null;
  const followLabel = character ? `${character.name} uses ${charSet === "damage" ? "my damage dice" : "my dice"}` : editing === "npc" ? "NPC dice are my dice" : "Damage dice are my dice";
  const setFollowing = (on: boolean) => (character ? saveCharacter({ [charSet]: on ? null : { ...look } }) : diceStore.update({ [editing]: on ? null : { ...settings.look } }));
  const packs = useSyncExternalStore(dicePacks.subscribe, dicePacks.list);
  const all: Shown[] = [...PRESETS, ...packs.flatMap((pack) => pack.sets)];
  // Each set's group: Kraken's by name, a pack's by the pack (two packs may share a set's name).
  // A pack's sets join the group it names (Maelstrom's own, such as Classes, or one of its own), else one named for it.
  const packGroup = (pack: (typeof packs)[number]) => pack.group || pack.name;
  const groupOf = [...PRESETS.map((preset) => SET_GROUPS.find((item) => item.sets.includes(preset.name))?.name ?? ""), ...packs.flatMap((pack) => pack.sets.map(() => packGroup(pack)))];
  const groups: { name: string; sets: string[] }[] = SET_GROUPS.map((item) => ({ ...item, sets: [...item.sets] }));
  for (const pack of packs) {
    const found = groups.find((item) => item.name === packGroup(pack));
    if (found) found.sets.push(...pack.sets.map((set) => set.name));
    else groups.push({ name: packGroup(pack), sets: pack.sets.map((set) => set.name) });
  }
  const nameOf = (shown: DiceLook) => nameIn(all, shown);
  // The die the live preview shows: a d20 until one is picked under Dice display.
  const [previewKind, setPreviewKind] = useState<DiceKind>("d20");
  // The family (class) whose choices show in the area under the tiles: the one the dice are in, from the start.
  const [openFamily, setOpenFamily] = useState<string | null>(() => {
    const current = ([...PRESETS, ...packs.flatMap((pack) => pack.sets)] as Shown[]).find((preset) => sameLook(look, preset));
    return current ? current.family || current.name : null;
  });
  const [group, setGroup] = useState(groups.find((item) => item.sets.includes(nameOf(look) ?? ""))?.name ?? "All");
  const tray = usePictures(() => import("./trayArt").then(({ renderTray }) => renderTray(look)), JSON.stringify(look), {} as Record<number, string>);
  const sets = usePictures(() => import("./trayArt").then(({ renderSets }) => renderSets(all.map(lookOf))), `sets|${packs.map((pack) => `${pack.id}:${pack.sets.length}`).join(",")}`, [] as string[]);
  const name = nameOf(look);
  const shown = all.map((preset, index) => ({ preset, picture: sets[index], index })).filter(({ index }) => group === "All" || groupOf[index] === group);
  // Sets of one family (a pack's "family": a class such as Paladin) gather under one tile; a set without one is its own.
  type Item = (typeof shown)[number];
  const families: { name: string; items: Item[] }[] = [];
  for (const item of shown) {
    const name = item.preset.family || item.preset.name;
    const found = families.find((family) => family.name === name);
    if (found) found.items.push(item);
    else families.push({ name, items: [item] });
  }
  const glowOf = (preset: Shown) => (preset.effect === "none" ? preset.accent : preset.effect === "fire" ? "#ff8a2a" : preset.effect === "frost" ? "#bfe8ff" : preset.effect === "shadow" ? "#7a3cff" : preset.accent);
  const setButton = ({ preset, picture, index }: Item) => (
    <button
      key={`${index}-${preset.name}`}
      type="button"
      className={sameLook(look, preset) ? "dice-set on" : "dice-set"}
      title={preset.name}
      aria-label={preset.name}
      aria-pressed={sameLook(look, preset)}
      data-preset={preset.name}
      style={{ ["--set-glow" as string]: glowOf(preset) }}
      onClick={() => setLook(lookOf(preset))}
      // FG's dice skin: dragged onto the chat, it becomes the dropper's own dice.
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DICE_LOOK_DRAG, JSON.stringify(lookOf(preset)));
        event.dataTransfer.setData("text/plain", preset.name);
        event.dataTransfer.effectAllowed = "copy";
      }}
    >
      {picture ? <img src={picture} alt="" draggable={false} /> : <span className="dice-set-blank" style={{ background: preset.body, color: preset.ink, ...FONT_STYLE[preset.font] }}>20</span>}
      <span>{preset.name}</span>
    </button>
  );

  return (
    <div className="dice-window">
      {characters.length > 0 ? (
        <div className="dice-groups dice-whose" role="tablist" aria-label="Whose dice">
          {[{ id: "", name: "Mine", tip: "Your own dice: every roll you make as yourself, and your characters' until they have their own" }, ...characters.map((record) => ({ id: record.id, name: record.name, tip: `${record.name}'s dice: every roll made as ${record.name}` }))].map((item) => (
            <button key={item.id || "mine"} type="button" role="tab" aria-selected={whose === item.id} className={whose === item.id ? "dice-chip on" : "dice-chip"} title={item.tip} data-dice-whose={item.id || "mine"} onClick={() => setWhose(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="dice-groups dice-which" role="tablist" aria-label="Which dice">
        {(
          [
            ["look", "My dice", "Your rolls"],
            ...(session.role === "dm" && !character ? ([["npc", "NPC dice", "Your rolls for the creatures: their attacks, saves and checks from the tracker"]] as const) : []),
            ["damage", "Damage dice", "Every damage roll you make"],
          ] as const
        ).map(([id, label, tip]) => (
          <button key={id} type="button" role="tab" aria-selected={editing === id} className={editing === id ? "dice-chip on" : "dice-chip"} title={tip} data-dice-set={id} onClick={() => setEditing(id)}>
            {label}
          </button>
        ))}
      </div>
      {editing !== "look" || character ? (
        <Toggle className="dice-follow" label={followLabel} hint="Off: they get a set of their own." attrs={{ "data-dice-follow": "" }} checked={following} onChange={setFollowing} />
      ) : null}
      <section className="dice-panel active-set" data-editing={editing}>
        <h3>{character ? `${character.name}'s ${charSet === "damage" ? "damage dice" : "dice"}` : editing === "npc" ? "NPC dice" : editing === "damage" ? "Damage dice" : "Active dice set"}</h3>
        <div className="active-body">
          <Suspense fallback={<div className="dice-preview" />}>
            <DicePreview look={look} kind={previewKind} />
          </Suspense>
          <div className="active-words">
            <strong data-active-set={name ?? "custom"}>{name ?? "Your own set"}</strong>
            <span>
              {DESIGNS.find((item) => item.id === look.theme)?.name} · {MATERIALS.find((item) => item.id === look.material)?.name}
              {look.effect !== "none" ? ` · ${EFFECTS.find((item) => item.id === look.effect)?.name}` : ""}
            </span>
            <div className="dice-colors">
              <label>
                <input type="color" value={look.body.slice(0, 7)} onChange={(event) => setLook({ body: event.target.value })} />
                Dice
              </label>
              <label>
                <input type="color" value={(look.accent ?? "#d8b46a").slice(0, 7)} onChange={(event) => setLook({ accent: event.target.value })} />
                Accent
              </label>
              <label>
                <input type="color" value={look.ink.slice(0, 7)} onChange={(event) => setLook({ ink: event.target.value })} />
                Numbers
              </label>
            </div>
            <p className="hint">{character ? `Every roll made as ${character.name} uses these; they stay with ${character.name}.` : editing === "npc" ? "The table sees the creatures' rolls in these." : editing === "damage" ? "The table sees your damage rolls in these." : "Everyone at the table sees your dice like this."}</p>
          </div>
        </div>
      </section>

      <section className="dice-panel">
        <h3>Dice display</h3>
        <div className="dice-display" style={{ ["--tray-glow" as string]: look.accent ?? look.body }}>
          {TRAY_DICE.map((sides) => {
            const kind = `d${sides}` as DiceKind;
            return (
              <button key={sides} type="button" className={previewKind === kind ? "dice-display-die on" : "dice-display-die"} title={`Show the ${kind} above`} aria-label={`Show the ${kind} above`} aria-pressed={previewKind === kind} data-preview-die={kind} onClick={() => setPreviewKind(kind)}>
                {tray[sides] ? <img src={tray[sides]} alt="" draggable={false} /> : null}
              </button>
            );
          })}
        </div>
        <div className="dice-sizes">
          <Stepper label="Tray" value={settings.tray ?? 1} low={0.6} high={1.6} onChange={(tray) => diceStore.update({ tray })} />
          <Stepper label="Roll" value={settings.roll ?? 1} low={0.5} high={2.5} onChange={(roll) => diceStore.update({ roll })} />
        </div>
      </section>

      <section className="dice-panel">
        <h3>
          Dice sets
          {session.role === "dm" && window.kraken?.openKrakenFolder ? (
            <button type="button" className="ghost dice-packs-folder" data-action="dice-packs-folder" title="Dice packs: a .kpack file dropped here adds its sets for everyone at the table. To make one, show an AI agent DICE-SET-SKILL.md in that folder." onClick={() => void window.kraken?.openKrakenFolder?.("dice")}>
              Dice packs folder
            </button>
          ) : null}
        </h3>
        <div className="dice-groups" role="tablist" aria-label="Groups">
          {["All", ...groups.map((item) => item.name)].map((item) => (
            <button key={item} type="button" role="tab" aria-selected={group === item} className={group === item ? "dice-chip on" : "dice-chip"} onClick={() => setGroup(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="dice-sets">
          {families.map((family) => {
            // Each family (a class: Paladin, Wizard) is one tile; picking it shows its choices in the area below.
            const open = openFamily === family.name;
            const current = family.items.find(({ preset }) => sameLook(look, preset)) ?? null;
            const face = current ?? family.items[0];
            return (
              <button
                key={`family-${family.name}`}
                type="button"
                className={["dice-set", "dice-family", current ? "on" : "", open ? "open" : ""].filter(Boolean).join(" ")}
                title={family.items.length > 1 ? `${family.name}: ${family.items.length} choices` : family.name}
                aria-expanded={open}
                aria-controls="dice-family-choices"
                data-family={family.name}
                style={{ ["--set-glow" as string]: glowOf(face.preset) }}
                onClick={() => setOpenFamily(family.name)}
              >
                {face.picture ? <img src={face.picture} alt="" draggable={false} /> : <span className="dice-set-blank" style={{ background: face.preset.body, color: face.preset.ink, ...FONT_STYLE[face.preset.font] }}>20</span>}
                <span>{family.name}</span>
                {family.items.length > 1 ? <b className="dice-family-count" aria-hidden="true">{family.items.length}</b> : null}
              </button>
            );
          })}
        </div>
        {(() => {
          // The picked class's choices (one, or many): choosing one sets the dice.
          const family = families.find((item) => item.name === openFamily);
          return family ? (
            <div className="dice-family-choices" id="dice-family-choices" role="group" aria-label={`${family.name} choices`} data-family-choices={family.name}>
              <span className="dice-family-head">{family.name}</span>
              <div className="dice-family-row">{family.items.map(setButton)}</div>
            </div>
          ) : null;
        })()}
      </section>

      <section className="dice-panel">
        <h3>Make your own</h3>
        <Chips label="Design" items={DESIGNS} value={look.theme} onPick={(theme) => setLook({ theme })} />
        <Chips label="Made of" items={MATERIALS} value={look.material} onPick={(material) => setLook({ material })} />
        <Chips label="Numbers" items={FONTS} value={look.font} onPick={(font) => setLook({ font })} styleOf={(font) => FONT_STYLE[font]} />
        <Chips label="Effect" items={EFFECTS} value={look.effect} onPick={(effect) => setLook({ effect })} />
        <Toggle label="Natural 20s and 1s" hint="A 20 flares gold to a fanfare, a 1 red to a sad trombone (with dice sounds on)." checked={look.crit !== false} onChange={(on) => setLook({ crit: on })} attrs={{ "data-dice": "crit" }} />
        <Toggle label="Pips on the d6" hint="Dots instead of numbers." checked={Boolean(look.pips)} onChange={(on) => setLook({ pips: on })} attrs={{ "data-dice": "pips" }} />
      </section>

      <section className="dice-panel your-colour">
        <h3>Your colour</h3>
        <p className="hint">Your pings and your ink on the map, for everyone at the table. Kept with your name.</p>
        <div className="dice-colors" role="radiogroup" aria-label="Your colour">
          <button type="button" role="radio" aria-checked={settings.color === null} className={settings.color === null ? "swatch mine on" : "swatch mine"} title="The table's colour for your name" data-ping-color="default" onClick={() => diceStore.update({ color: null })}>
            Auto
          </button>
          {PALETTE.map((color) => (
            <button key={color} type="button" role="radio" aria-checked={settings.color === color} aria-label={`Colour ${color}`} className={settings.color === color ? "swatch on" : "swatch"} style={{ background: color }} data-ping-color={color} onClick={() => diceStore.update({ color })} />
          ))}
          <label>
            <input type="color" aria-label="Pick your colour" value={settings.color ?? "#e8c46a"} onChange={(event) => diceStore.update({ color: event.target.value })} />
            Other
          </label>
        </div>
      </section>

      <section className="dice-panel">
        <h3>On this screen</h3>
        <Toggle label="3D dice" hint="Dice roll across the table on this screen." checked={settings.show} onChange={(on) => diceStore.update({ show: on })} attrs={{ "data-dice": "show" }} />
        <Toggle label="Dice sounds" hint="The rattle and the landing, here only." checked={settings.sound} onChange={(on) => diceStore.update({ sound: on })} attrs={{ "data-dice": "sound" }} />
        {settings.sound ? (
          <SettingRow label="Volume" className="dice-sound">
            <input type="range" min={0} max={1} step={0.05} value={settings.volume} aria-label="Dice volume" onChange={(event) => diceStore.update({ volume: Number(event.target.value) })} />
          </SettingRow>
        ) : null}
        {session.role === "dm" ? <Toggle label="Players see their own tower rolls" hint="Off: only you see what goes into the dice tower." checked={Boolean(session.options.towerReveal)} onChange={(on) => session.setTableOptions({ towerReveal: on })} setting="tower-reveal" /> : null}
      </section>
    </div>
  );
}
