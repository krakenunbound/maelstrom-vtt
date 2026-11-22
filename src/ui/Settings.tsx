import { tellUser } from "./Ask";
import type { StudioSettings } from "../kraken";
import { pickerPreview, usePreviewed, type PreviewKey } from "./pickerPreview";
import { diceStore } from "../dice/diceStore";
import { PALETTE } from "../dice/DiceWindow";
import { TOWER_LOOKS, TowerArt, towerLook } from "./TowerArt";
import { useEffect, useMemo, useState, useSyncExternalStore, type DragEvent, useRef } from "react";
import { cardsStore } from "../cards/cardsStore";
import type { DecalItem, PictureKind, Session, WallpaperFit } from "../session/useSession";
import { Emblem } from "./Emblem";
import { useWindows } from "./Windows";
import { getUiScale, setUiScale } from "./chatCommands";
import { SettingRow, SettingsSection, Toggle } from "./SettingsParts";
import { manifestOf, PANELS } from "../rulesets";
import { TokenOptionsSection } from "../table/TokenOptions";
import { BookkeepingSettings } from "../bookkeeping/BookkeepingSettings";
import { rulesetFor } from "../../shared/rulesets/registry.mjs";
import { gameLanguages } from "../../shared/text/languages.mjs";
import { GM } from "./gmTitle";

// Settings, as FG's settings cog: a button for each thing to set. Everyone
// sets their own dice; the GM also sets what the whole table sees.
// You at the table (every seat): your colour (your token's ring, your pings,
// your drawings on the map, for everyone) and what happens when your turn
// comes round. Kept with your name by the GM's app, so they follow you.
// How big everything on this screen is (also /scaleui): smaller fits more on it.
function UiScaleRow() {
  const [scale, setScale] = useState(() => Math.round(getUiScale() * 100));
  const apply = (value: number) => setUiScale(Math.min(200, Math.max(50, value)) / 100);
  return (
    <SettingRow label="UI scale" hint="How big everything is: windows, text and pictures. Smaller fits more on the screen. It follows your account, like your window layout: the app or any browser you sit down at." className="settings-ui-scale">
      <input type="range" min={50} max={150} step={5} value={Math.min(150, scale)} aria-label="UI scale (slider)" data-setting="ui-scale-slider" onChange={(event) => setScale(Number(event.target.value))} onPointerUp={() => apply(scale)} onKeyUp={() => apply(scale)} />
      <input type="number" className="set-number" min={50} max={200} step={5} value={scale} aria-label="UI scale (percent)" data-setting="ui-scale" onChange={(event) => setScale(Number(event.target.value))} onBlur={() => apply(scale)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) apply(scale); }} />
      <span className="set-unit">%</span>
    </SettingRow>
  );
}

function YouAtTheTable() {
  const settings = useSyncExternalStore(diceStore.subscribe, diceStore.settings);
  return (
    <SettingsSection title="You at the table" setting="you">
      <div className="set-row set-colours">
        <span className="set-text">
          <span className="set-label">Your colour</span>
          <span className="set-hint">Rings your tokens and colours your pings and drawings, so everyone knows who is who.</span>
        </span>
        <div className="you-colours" role="radiogroup" aria-label="Your colour">
          <button type="button" role="radio" aria-checked={settings.color === null} className={settings.color === null ? "swatch mine on" : "swatch mine"} title="The table's colour for your name" data-you-color="default" onClick={() => diceStore.update({ color: null })}>
            Auto
          </button>
          {PALETTE.map((color) => (
            <button key={color} type="button" role="radio" aria-checked={settings.color === color} aria-label={`Colour ${color}`} className={settings.color === color ? "swatch on" : "swatch"} style={{ background: color }} data-you-color={color} onClick={() => diceStore.update({ color })} />
          ))}
          <label className="you-other" title="Pick any colour">
            <input type="color" aria-label="Pick your colour" value={settings.color ?? "#e8c46a"} onChange={(event) => diceStore.update({ color: event.target.value })} />
          </label>
        </div>
      </div>
      <UiScaleRow />
      <Toggle label="Chime on your turn" hint="A soft chime when your turn comes round in combat." setting="turn-sound" checked={settings.turnSound !== false} onChange={(on) => diceStore.update({ turnSound: on })} />
      <Toggle label="Chime on a whisper" hint="A soft chime when someone whispers to you." setting="whisper-sound" checked={settings.whisperSound !== false} onChange={(on) => diceStore.update({ whisperSound: on })} />
      <Toggle label="Type in my own dice" hint="Roll your own dice at the table: a roll from the dice tray, the chat, a character sheet or the combat tracker asks for the faces they show." setting="manual-dice" checked={Boolean(settings.manualDice)} onChange={(on) => diceStore.update({ manualDice: on })} />
      <Toggle label="Read aloud on screen" hint={GM("The GM's read-aloud text also pops up over the map in a bubble (it is always in the chat).")} setting="read-aloud-popup" checked={settings.readAloud !== false} onChange={(on) => diceStore.update({ readAloud: on })} />
      <Toggle label="Banner on your turn" hint="Your name across the screen when it is your turn." setting="turn-banner" checked={settings.turnBanner !== false} onChange={(on) => diceStore.update({ turnBanner: on })} />
      <Toggle label="Whose turn it is" hint="The portrait of whoever acts next, and the round as it begins, for a moment on every turn." setting="turn-card" checked={settings.turnCard !== false} onChange={(on) => diceStore.update({ turnCard: on })} />
      <SettingRow label="At your turn, the map" hint="When your turn comes round the map moves to your token, or moves to it and selects it, or stays where it is.">
        <select value={settings.turnFocus ?? "on"} onChange={(event) => diceStore.update({ turnFocus: event.target.value as "on" })} aria-label="At your turn, the map" data-setting="turn-focus">
          <option value="on">Centres on your token</option>
          <option value="select">Centres on it and selects it</option>
          <option value="off">Stays where it is</option>
        </select>
      </SettingRow>
      <Toggle label="Damage and healing over tokens" hint="The numbers float up from a token as it is hurt or healed." setting="token-floats" checked={settings.tokenFloats !== false} onChange={(on) => diceStore.update({ tokenFloats: on })} />
      <Toggle label="Speech over tokens" hint="What a character or creature says shows in a bubble over its token as well as in the chat." setting="speech-bubbles" checked={settings.speechBubbles !== false} onChange={(on) => diceStore.update({ speechBubbles: on })} />
      <Toggle label="Use the Alt key" hint="Alt at the table: a token dragged without snapping, Alt+Enter for out of character. Off when another program uses Alt (a voice chat's overlay)." setting="use-alt" checked={settings.useAlt !== false} onChange={(on) => diceStore.update({ useAlt: on })} />
      <Toggle label="Short effect summary" hint="On the combat tracker: each effect as its first part (* when there is more), its time and [T] when it is targeted. Off: the whole effect." setting="effects-short" checked={settings.effectsShort !== false} onChange={(on) => diceStore.update({ effectsShort: on })} />
      <Toggle label="Reopen my windows" hint="The windows you had open when you left open again when you come back to this table." setting="reopen-windows" checked={settings.reopenWindows !== false} onChange={(on) => diceStore.update({ reopenWindows: on })} />
      <SettingRow label="Combat toasts" hint="A note in the corner for attacks, damage and effects, for so many seconds.">
        <select value={settings.toastCombat ?? 5} onChange={(event) => diceStore.update({ toastCombat: Number(event.target.value) })} aria-label="Combat toasts" data-setting="toast-combat">
          <option value={0}>None</option>
          <option value={3}>3 seconds</option>
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
        </select>
      </SettingRow>
      <SettingRow label="Record toasts" hint="A note in the corner when a record is added or deleted, for so many seconds.">
        <select value={settings.toastInterface ?? 3} onChange={(event) => diceStore.update({ toastInterface: Number(event.target.value) })} aria-label="Record toasts" data-setting="toast-interface">
          <option value={0}>None</option>
          <option value={3}>3 seconds</option>
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
        </select>
      </SettingRow>
      <SettingRow label="Combat list" hint="During a fight, the creatures to come in turn order along the top of the table (the round's end marked).">
        <select value={settings.combatList ?? 6} onChange={(event) => diceStore.update({ combatList: Number(event.target.value) })} aria-label="Combat list" data-setting="combat-list">
          <option value={0}>None</option>
          <option value={6}>6</option>
          <option value={8}>8</option>
          <option value={10}>10</option>
          <option value={12}>12</option>
        </select>
      </SettingRow>
      <SettingRow label="Speech bubble time" hint="How long a bubble stays over a token.">
        <select value={settings.speechSeconds ?? 0} onChange={(event) => diceStore.update({ speechSeconds: Number(event.target.value) })} aria-label="Speech bubble time" data-setting="speech-seconds">
          <option value={0}>As long as it takes to read</option>
          <option value={3}>3 seconds</option>
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
          <option value={20}>20 seconds</option>
        </select>
      </SettingRow>
    </SettingsSection>
  );
}

export function SettingsWindow({ session }: { session: Session }) {
  const windows = useWindows();
  const gm = session.role === "dm";
  return (
    <div className="settings-window">
      <div className="settings-grid" role="group" aria-label="Look and feel">
        <button type="button" className="settings-button" data-setting="dice" onClick={() => windows.toggle("dice", "Dice", undefined, "settings")}>
          Dice
        </button>
        {gm ? (
          <>
            <button type="button" className="settings-button" data-setting="decal" onClick={() => windows.toggle("decals", "Background Decal", undefined, "settings")}>
              Background Decal
            </button>
            <button type="button" className="settings-button" data-setting="wallpaper" onClick={() => windows.toggle("wallpapers", "Desktop Wallpaper", undefined, "settings")}>
              Desktop Wallpaper
            </button>
            <button type="button" className="settings-button" data-setting="gmicon" onClick={() => windows.toggle("gmicons", GM("GM Icon"), undefined, "settings")}>
              {GM("GM Icon")}
            </button>
            <button type="button" className="settings-button" data-setting="tower-look" title="The dice tower's look: six drawn towers, painted ones, or a picture of your own" onClick={() => windows.toggle("towers", "Dice Tower", undefined, "settings")}>
              Dice Tower
            </button>
            <button type="button" className="settings-button" data-setting="krits" onClick={() => windows.toggle("krits", "Critical Hits & Fumbles", undefined, "settings")}>
              Critical Hits &amp; Fumbles
            </button>
            <button type="button" className="settings-button" data-setting="death-markers" onClick={() => windows.toggle("deathmarkers", "Death Markers", undefined, "settings")}>
              Death Markers
            </button>
            {window.kraken?.openKrakenFolder ? (
              <button type="button" className="settings-button" data-setting="kraken-folder" title={GM("Documents/Kraken VTT: a folder for each kind of thing you add (books, dice packs, dice towers, GM icons, decals, wallpapers), each with a README on what goes in it and how to make one")} onClick={() => void window.kraken?.openKrakenFolder?.("")}>
                Your Maelstrom folder
              </button>
            ) : null}
            {/* FG's Export and Import Campaign Options: the table's settings (house rules, combat, tokens, chat) as a file. */}
            <button
              type="button"
              className="settings-button"
              data-setting="settings-export"
              title="Save the table's settings (house rules, combat, tokens, chat, look) as a file, to load into another campaign"
              onClick={() => {
                const { paused: _paused, ...kept } = session.options as Record<string, unknown>;
                const file = new Blob([JSON.stringify({ maelstromSettings: 1, options: kept }, null, 2)], { type: "application/json" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(file);
                link.download = "maelstrom-settings.json";
                link.click();
                URL.revokeObjectURL(link.href);
              }}
            >
              Export settings
            </button>
            <label className="settings-button" data-setting="settings-import" title="Load a settings file saved by Export settings (it replaces these settings)">
              Import settings
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void file.text().then((words) => {
                    try {
                      const loaded = JSON.parse(words) as { maelstromSettings?: number; options?: Record<string, unknown> };
                      if (loaded.maelstromSettings !== 1 || !loaded.options || typeof loaded.options !== "object") throw new Error("not a settings file");
                      const { paused: _paused, ...options } = loaded.options;
                      session.setTableOptions(options as never);
                    } catch {
                      void tellUser("That is not a Maelstrom settings file.");
                    }
                  });
                }}
              />
            </label>
            {window.kraken?.openLogs ? (
              <button type="button" className="settings-button" data-setting="open-logs" title="Maelstrom's logs: what went wrong in the table server and in this window (the newest three files of each), for a bug report" onClick={() => void window.kraken?.openLogs?.()}>
                Open logs
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <YouAtTheTable />
      <CardsSetting />
      {gm ? <ThemeSetting session={session} /> : null}
      {gm ? (
        <SettingsSection title="Dice and the dice tower" setting="dice-table">
          <Toggle label="Players see their own tower rolls" hint="Off: only you see what goes into the dice tower." checked={Boolean(session.options.towerReveal)} onChange={(on) => session.setTableOptions({ towerReveal: on })} setting="tower-reveal" />
          <Toggle
            label="Dice tower on the table"
            hint="It stands apart from the chat, for everyone; each person places it where they like (right-click to lock it). Off: it sits in the chat."
            setting="tower-external"
            checked={Boolean(session.options.towerExternal)}
            onChange={(on) => session.setTableOptions({ towerExternal: on })}
          />
          <DiceHoldSetting session={session} />
          {/* FG's dice and chat options. */}
          <Toggle label="Dice roll in the chat only" hint="No dice across the table: every roll's result goes straight to the chat." setting="dice-in-chat" checked={Boolean((session.options as { diceInChat?: boolean }).diceInChat)} onChange={(on) => session.setTableOptions({ diceInChat: on } as never)} />
          <Toggle label="Players see your rolls" hint="Off: your rolls, and your creatures' attacks, damage and saves, are yours alone." setting="reveal-gm-rolls" checked={(session.options as { revealGmRolls?: boolean }).revealGmRolls !== false} onChange={(on) => session.setTableOptions({ revealGmRolls: on } as never)} />
          <SettingRow label="Players see results" hint="Whether an attack hit, a save succeeded: always, when an ally is involved, only between allies, or never. You always see them; a hidden target's are never shown.">
            <select value={(session.options as { resultsToPlayers?: string }).resultsToPlayers ?? "on"} onChange={(event) => session.setTableOptions({ resultsToPlayers: event.target.value } as never)} aria-label="Players see results" data-setting="results-to-players">
              <option value="on">Always</option>
              <option value="pc">When an ally is involved</option>
              <option value="pconly">Only between allies</option>
              <option value="off">Never</option>
            </select>
          </SettingRow>
          <Toggle label="See players' whispers to each other" hint="Off: a whisper between players is theirs alone (one to or from you, you always see)." setting="gm-sees-whispers" checked={Boolean((session.options as { gmSeesWhispers?: boolean }).gmSeesWhispers)} onChange={(on) => session.setTableOptions({ gmSeesWhispers: on } as never)} />
          <Toggle label="Speak as the creature whose turn it is" hint="Your chat speaks as the active creature on its turn, and as you again on a character's turn." setting="gm-voice-active" checked={Boolean((session.options as { gmVoiceActive?: boolean }).gmVoiceActive)} onChange={(on) => session.setTableOptions({ gmVoiceActive: on } as never)} />
        </SettingsSection>
      ) : null}
      {gm ? (
        <SettingsSection title="Combat" setting="combat">
          <SettingRow label="Clear targets" hint="When a creature's targets are cleared on the combat tracker.">
            <select value={(session.options as { clearTargets?: string }).clearTargets ?? "never"} onChange={(event) => session.setTableOptions({ clearTargets: event.target.value } as never)} aria-label="Clear targets" data-setting="clear-targets">
              <option value="never">Never</option>
              <option value="action">After a spell or an attack's damage</option>
              <option value="turn">At the end of the creature's turn</option>
            </select>
          </SettingRow>
          <Toggle label="Dice by type" hint="Damage dice in their damage type's colours (fire red, cold blue, necrotic black...), a creature's dice in its type's (undead, fiends, celestials...), over each person's own set." setting="typed-dice" checked={(session.options as { typedDice?: boolean }).typedDice !== false} onChange={(on) => session.setTableOptions({ typedDice: on } as never)} />
          <SettingRow label="Fog of war" hint="What the players' tokens have seen stays on their map, dim; or they see only what is in sight now.">
            <select value={(session.options as { tokenFog?: string }).tokenFog ?? "pc"} onChange={(event) => session.setTableOptions({ tokenFog: event.target.value } as never)} aria-label="Fog of war" data-setting="token-fog">
              <option value="pc">Remember what they saw</option>
              <option value="off">Only what is in sight</option>
            </select>
          </SettingRow>
          <SettingRow label="Remove on miss" hint="After an attack, the targets it missed come off the attacker's targets: never, always, or only when it had several targets.">
            <select value={(session.options as { removeOnMiss?: string }).removeOnMiss ?? "multi"} onChange={(event) => session.setTableOptions({ removeOnMiss: event.target.value } as never)} aria-label="Remove on miss" data-setting="remove-on-miss">
              <option value="multi">With several targets</option>
              <option value="on">Always</option>
              <option value="off">Never</option>
            </select>
          </SettingRow>
          <SettingRow label="Initiative" hint="Each creature rolls its own, one roll for each kind of creature (all the goblins together), or one plain roll a side (the party and their friends, then their foes; a tie goes to the party).">
            <select value={(session.options as { initGroup?: string }).initGroup ?? "each"} onChange={(event) => session.setTableOptions({ initGroup: event.target.value } as never)} aria-label="Initiative" data-setting="init-group">
              <option value="each">Each creature</option>
              <option value="kind">By kind of creature</option>
              <option value="sides">One roll a side (the party, their foes)</option>
            </select>
          </SettingRow>
          <SettingRow label="Creatures' hit points" hint="When a creature joins the tracker: the book's listed hit points, its hit dice rolled each time (no two goblins alike), or the most they can be.">
            <select value={(session.options as { npcHp?: string }).npcHp ?? "listed"} onChange={(event) => session.setTableOptions({ npcHp: event.target.value } as never)} aria-label="Creatures' hit points" data-setting="npc-hp">
              <option value="listed">As listed</option>
              <option value="roll">Rolled</option>
              <option value="max">Maximum</option>
            </select>
          </SettingRow>
          <Toggle label="Players see the party's details" hint="On the party sheet: every member's abilities, health, AC and senses (off: names and portraits only)." checked={session.options.partyDetails !== false} onChange={(on) => session.setTableOptions({ partyDetails: on } as never)} setting="party-details" />
          <Toggle label="Players see what the party carries" hint="On the party sheet: everyone's items and coins (off: the loot and the stash only)." checked={session.options.partyCarried !== false} onChange={(on) => session.setTableOptions({ partyCarried: on } as never)} setting="party-carried" />
          <Toggle label="Party portraits in initiative order" hint="During a fight the portraits along the top of every screen re-arrange into turn order, the first to act on the left. Off: they keep the party's order." checked={Boolean((session.options as { partyByInitiative?: boolean }).partyByInitiative)} onChange={(on) => session.setTableOptions({ partyByInitiative: on } as never)} setting="party-by-initiative" />
          <SettingRow label="Characters along the top" hint="Every character's portrait, or only those whose players are at the table.">
            <select value={session.options.partyShown ?? "all"} onChange={(event) => session.setTableOptions({ partyShown: event.target.value } as never)} aria-label="Characters along the top" data-setting="party-shown">
              <option value="all">All</option>
              <option value="active">Players at the table</option>
            </select>
          </SettingRow>
          <SettingRow label="Background decal" hint="A decal picture in the middle of the table, covering it, or as large as fits. Maelstrom's own emblem stays in the middle.">
            <select value={session.options.decalFit ?? "center"} onChange={(event) => session.setTableOptions({ decalFit: event.target.value } as never)} aria-label="Background decal" data-setting="decal-fit">
              <option value="center">In the middle</option>
              <option value="fill">Covering the table</option>
              <option value="fit">As large as fits</option>
            </select>
          </SettingRow>
          <Toggle label="Roll initiative every round" hint="A house rule: at each new round everyone rolls initiative again and the order changes." checked={Boolean((session.options as { initEachRound?: boolean }).initEachRound)} onChange={(on) => session.setTableOptions({ initEachRound: on } as never)} setting="init-each-round" />
          <Toggle label="Stop at the start of each round" hint="A new round waits for your next click before anyone acts, so you can handle what happens at the top of the round." checked={Boolean((session.options as { roundStop?: boolean }).roundStop)} onChange={(on) => session.setTableOptions({ roundStop: on } as never)} setting="round-stop" />
          <SettingRow label="Skip turns" hint="Whose turns the tracker passes over: dead and unconscious creatures, characters too, or no one.">
            <select value={(session.options as { skipDead?: string }).skipDead ?? "enemies"} onChange={(event) => session.setTableOptions({ skipDead: event.target.value } as never)} aria-label="Skip turns" data-setting="skip-dead">
              <option value="enemies">The dead and unconscious creatures</option>
              <option value="all">Characters too</option>
              <option value="off">No one</option>
            </select>
          </SettingRow>
          <SettingRow label="NPC numbering" hint="The same creature added again: numbered in order (Goblin 1, Goblin 2), with a random number (Goblin 14), or left as it is.">
            <select value={(session.options as { npcNumbering?: string }).npcNumbering ?? "append"} onChange={(event) => session.setTableOptions({ npcNumbering: event.target.value } as never)} aria-label="NPC numbering" data-setting="npc-numbering">
              <option value="append">In order</option>
              <option value="random">Random</option>
              <option value="off">Off</option>
            </select>
          </SettingRow>
          {/* FG's combat display options: what players see on the tracker, the turn notice, wound categories. */}
          {(() => {
            const o = session.options as { ctHealthPc?: string; ctHealthNpc?: string; turnOrder?: string; skipHidden?: boolean; woundCategories?: string; healthColors?: string; turnEffects?: string };
            const pick = (key: string, label: string, hint: string, value: string, options: [string, string][]) => (
              <SettingRow key={key} label={label} hint={hint}>
                <select value={value} onChange={(event) => session.setTableOptions({ [key]: event.target.value } as never)} aria-label={label} data-setting={key}>
                  {options.map(([id, text]) => (
                    <option key={id} value={id}>
                      {text}
                    </option>
                  ))}
                </select>
              </SettingRow>
            );
            return (
              <>
                {pick("turnOrder", "Players see the turn order", "Everyone's initiative, the allies' alone, or none (the tracker then lists allies first, by name).", o.turnOrder ?? "on", [["on", "Everyone"], ["friend", "Allies only"], ["off", "None"]])}
                {pick("ctHealthPc", "Players see allies' health", "On the tracker: the hit points, the status words, or nothing.", o.ctHealthPc ?? "detailed", [["detailed", "Hit points"], ["status", "Status"], ["off", "Nothing"]])}
                {pick("ctHealthNpc", "Players see enemies' health", "On the tracker: the hit points, the status words, or nothing.", o.ctHealthNpc ?? "status", [["detailed", "Hit points"], ["status", "Status"], ["off", "Nothing"]])}
                {pick("woundCategories", "Wound categories", "Simple: Wounded and Heavy. Detailed: Light, Moderate, Heavy and Critical, a quarter of the hit points each.", o.woundCategories ?? "simple", [["simple", "Simple"], ["detailed", "Detailed"]])}
                {pick("healthColors", "Health colours", "A smooth fade from green to red, or one colour for each wound category.", o.healthColors ?? "gradient", [["gradient", "Gradient"], ["tiered", "Tiered"]])}
                {pick("turnEffects", "Effects on the turn notice", "The creature's effects with its turn in the chat: all of them, its conditions, or none. Players see an ally's, never the GM's own.", o.turnEffects ?? "conditions", [["all", "All"], ["conditions", "Conditions"], ["off", "None"]])}
                <Toggle label="Skip hidden creatures" hint="A creature hidden from the players has no turn of its own." checked={Boolean(o.skipHidden)} onChange={(on) => session.setTableOptions({ skipHidden: on } as never)} setting="skip-hidden" />
              </>
            );
          })()}
          <SettingRow label="Token effects" hint="Conditions and effects on tokens (Zzz, flames, frost, a buff's glow): animated, icons only, or not drawn. Everyone's screen; motion stops anyway where the computer asks for reduced motion.">
            <select value={session.options.tokenEffects ?? "full"} onChange={(event) => session.setTableOptions({ tokenEffects: event.target.value as "full" })} aria-label="Token effects" data-setting="token-effects">
              <option value="full">Animated</option>
              <option value="icons">Icons only</option>
              <option value="off">Off</option>
            </select>
          </SettingRow>
          <SettingRow label="Apply damage" hint="Damage and healing land as the roll does, or wait on the chat card's buttons. Either way the card's buttons change what a creature took.">
            <select value={session.options.autoApply === false ? "card" : "auto"} onChange={(event) => session.setTableOptions({ autoApply: event.target.value === "auto" })} aria-label="Apply damage" data-setting="auto-apply">
              <option value="auto">At once</option>
              <option value="card">From the chat card</option>
            </select>
          </SettingRow>
        </SettingsSection>
      ) : null}
      {gm ? <LanguagesSetting session={session} /> : null}
      {gm ? <CurrencySetting session={session} /> : null}
      {gm ? <ModifierPresetsSetting session={session} /> : null}
      {gm ? <BookkeepingSettings session={session} /> : null}
      {gm ? <TokenOptionsSection session={session} /> : null}
      {gm ? <HouseRulesSetting session={session} /> : null}
      {/* The rows the game adds (its manifest's settings), only in that game. */}
      {(manifestOf(session.ruleset).settings ?? []).map((item) => {
        const ref = "component" in item && (!item.gm || gm) ? item.component : "";
        const Part = ref ? PANELS[ref] : null;
        return Part ? <Part key={ref} session={session} /> : null;
      })}
      {gm ? <StudioFoldersSetting /> : null}
    </div>
  );
}

// The game's house rules (its manifest's settings with a key): each a switch or a choice, grouped; the GM's
// choice is kept with the campaign (table options rules) and the host's rules read it.
function HouseRulesSetting({ session }: { session: Session }) {
  const rules = (manifestOf(session.ruleset).settings ?? []).filter((item): item is Extract<typeof item, { key: string }> => "key" in item);
  if (!rules.length) return null;
  const chosen = session.options.rules ?? {};
  // Only the rule changed: the host merges it with the others.
  const set = (key: string, value: string | boolean) => session.setTableOptions({ rules: { [key]: value } });
  const groups = [...new Set(rules.map((item) => item.group ?? ""))];
  return (
    <SettingsSection title="House rules" setting="house-rules">
      {groups.map((group) => (
        <div key={group || "rules"} className="house-rule-group">
          {group ? <h4>{group}</h4> : null}
          {rules
            .filter((item) => (item.group ?? "") === group)
            .map((item) => {
              const value = chosen[item.key] ?? item.default;
              if (item.kind === "toggle") return <Toggle key={item.key} label={item.label} hint={item.hint} checked={Boolean(value)} setting={`rule-${item.key}`} attrs={{ "data-house-rule": item.key }} onChange={(on) => set(item.key, on)} />;
              return (
                <SettingRow key={item.key} label={item.label} hint={item.hint}>
                  <select data-house-rule={item.key} value={String(value)} onChange={(event) => set(item.key, event.target.value)}>
                    {(item.options ?? []).map((option) => {
                      const { value: id, label } = typeof option === "string" ? { value: option, label: option } : option;
                      return <option key={id} value={id}>{label}</option>;
                    })}
                  </select>
                </SettingRow>
              );
            })}
        </div>
      ))}
    </SettingsSection>
  );
}

// The table's theme (the GM's, every screen, live): Kraken's brass, or the sea, the ember, the violet, steel.
const THEMES = [
  { id: "", label: "Maelstrom", accent: "#d2a15a", panel: "#171a20" },
  { id: "abyss", label: "Abyss", accent: "#4fd1c5", panel: "#0f1c23" },
  { id: "ember", label: "Ember", accent: "#f08a3a", panel: "#1c1310" },
  { id: "arcane", label: "Arcane", accent: "#b58cf5", panel: "#17121f" },
  { id: "iron", label: "Iron", accent: "#c9d1d9", panel: "#16191c" },
];
function ThemeSetting({ session }: { session: Session }) {
  const now = session.options.theme ?? "";
  return (
    <SettingsSection title="Look" setting="theme">
      <SettingRow className="set-row-wide" label="Theme" hint="The table's colours on every screen, changed at once (the wallpaper and decal stay as they are).">
        <div className="theme-swatches" role="radiogroup" aria-label="Theme">
          {THEMES.map((theme) => (
            <button key={theme.id || "kraken"} type="button" role="radio" aria-checked={now === theme.id} className="theme-swatch" data-theme-pick={theme.id || "kraken"} style={{ "--swatch-accent": theme.accent, "--swatch-panel": theme.panel } as React.CSSProperties} onClick={() => session.setTableOptions({ theme: theme.id })}>
              <i aria-hidden="true" />
              {theme.label}
            </button>
          ))}
        </div>
      </SettingRow>
    </SettingsSection>
  );
}

// The GM's own modifiers (FG's Modifiers window, which the GM may add to): one a line, "Higher ground +1".
function ModifierPresetsSetting({ session }: { session: Session }) {
  const saved = (session.options.modifierPresets ?? []).map((item) => `${item.label} ${item.value >= 0 ? "+" : ""}${item.value}`).join("\n");
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const send = (value: string) => {
    const list = value
      .split("\n")
      .map((line) => /^(.*?)\s*([+-]?\d+)\s*$/.exec(line.trim()))
      .filter((match): match is RegExpExecArray => Boolean(match && match[1].trim()))
      .map((match) => ({ label: match[1].trim(), value: Number(match[2]) }));
    if (JSON.stringify(list) !== JSON.stringify(session.options.modifierPresets ?? [])) session.setTableOptions({ modifierPresets: list });
  };
  return (
    <SettingsSection title="Modifiers" setting="modifier-presets">
      <SettingRow className="set-row-wide" label="Your modifiers" hint="Named numbers beside every player's modifier box, one a line: a click puts it in the box for the next roll. Higher ground +1, Bless +2, Fog -2.">
        <textarea className="set-textarea" rows={3} value={draft} placeholder={"Higher ground +1\nPartial cover +2"} aria-label="Your modifiers" data-setting="modifier-presets" onChange={(event) => setDraft(event.target.value)} onBlur={(event) => send(event.target.value)} />
      </SettingRow>
    </SettingsSection>
  );
}

// The GM's own coins (FG's Currency list): the party sheet's and parcels' coins instead of the game's.
function CurrencySetting({ session }: { session: Session }) {
  const game = (manifestOf(session.ruleset).party?.currency ?? []).join(", ");
  const saved = (session.options.currencies ?? []).join(", ");
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const send = (value: string) => {
    const list = value.split(",").map((name) => name.trim()).filter(Boolean);
    if (list.join(", ") !== saved) session.setTableOptions({ currencies: list });
  };
  return (
    <SettingsSection title="Currency" setting="currency">
      <SettingRow className="set-row-wide" label="Your coins" hint={`The money of your world, most valuable first, comma between: the party sheet's and treasure parcels' coins. Empty: the game's own (${game || "none"}).`}>
        <input className="set-textarea" value={draft} placeholder={game || "Crowns, Shields, Pennies"} aria-label="Your coins" data-setting="currency-list" onChange={(event) => setDraft(event.target.value)} onBlur={(event) => send(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && send((event.target as HTMLInputElement).value)} />
      </SettingRow>
      <CoinDetails session={session} coins={(session.options.currencies?.length ? session.options.currencies : manifestOf(session.ruleset).party?.currency) ?? []} />
    </SettingsSection>
  );
}

// FG's currency weight and value: each coin's weight (the game's unit, one coin) and value (in the first coin). A
// weight counts toward a character's load in place of the game's coins to the pound; values give the coins' worth.
function CoinDetails({ session, coins }: { session: Session; coins: string[] }) {
  const info = session.options.currencyInfo ?? {};
  const set = (coin: string, field: "weight" | "value", text: string) => {
    const value = text.trim() === "" ? undefined : Number(text);
    if (value !== undefined && !Number.isFinite(value)) return;
    const next = { ...info, [coin]: { ...info[coin], [field]: value } };
    if (value === undefined) delete next[coin][field];
    if (JSON.stringify(next) !== JSON.stringify(info)) session.setTableOptions({ currencyInfo: next });
  };
  if (!coins.length) return null;
  return (
    <SettingRow className="set-row-wide" label="Weight and value" hint={`Each coin's weight (one coin, in the game's unit; empty: the game's own) and its value in ${coins[0]} (empty: no worth shown).`}>
      <table className="coin-details" data-setting="currency-details">
        <thead>
          <tr>
            <th scope="col">Coin</th>
            <th scope="col">Weight</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin) => (
            <tr key={coin}>
              <th scope="row">{coin}</th>
              <td>
                <input key={`w-${coin}-${info[coin]?.weight ?? ""}`} type="number" min={0} step="any" defaultValue={info[coin]?.weight ?? ""} placeholder="game's" aria-label={`${coin} weight`} onBlur={(event) => set(coin, "weight", event.target.value)} />
              </td>
              <td>
                <input key={`v-${coin}-${info[coin]?.value ?? ""}`} type="number" min={0} step="any" defaultValue={info[coin]?.value ?? ""} placeholder="-" aria-label={`${coin} value`} onBlur={(event) => set(coin, "value", event.target.value)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SettingRow>
  );
}

// The GM's own chat languages (FG's Languages list): offered in the chat's language menu beside the
// game's own and those its characters know. One per line or comma between.
function LanguagesSetting({ session }: { session: Session }) {
  const saved = (session.options.languages ?? []).join(", ");
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const send = (value: string) => {
    const list = value.split(/[,\n]/).map((name) => name.trim()).filter(Boolean);
    if (list.join(", ") !== saved) session.setTableOptions({ languages: list });
  };
  return (
    <SettingsSection title="Chat languages" setting="languages">
      <SettingRow className="set-row-wide" label="Your languages" hint={`Spoken in chat from the language menu: those whose characters know one read the words, the others hear only its sounds, and you see who understood. The game's own (${gameLanguages(rulesetFor(session.ruleset ?? "").id).slice(0, 6).join(", ") || "none"}...) and the characters' are offered anyway.`}>
        <textarea className="set-textarea" rows={2} value={draft} placeholder="Thieves' Cant, Old Imperial" aria-label="Your languages" data-setting="languages-list" onChange={(event) => setDraft(event.target.value)} onBlur={(event) => send(event.target.value)} />
      </SettingRow>
    </SettingsSection>
  );
}

// Map Studio's asset packs (the GM's): the folders of Dungeondraft packs and
// of art packs (.mod) it reads. Nothing is assumed: each GM points at their
// own (Fantasy Grounds' modules folder is read anyway). Changed, Map Studio's
// library is read again.
function StudioFoldersSetting() {
  const kraken = window.kraken;
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void kraken?.studioSettings?.().then(setSettings).catch((reason: Error) => setError(reason.message));
  }, []);
  if (!kraken?.studioSettings) return null;
  const save = (patch: { dungeondraftFolders?: string[]; packFolders?: string[] }) =>
    void kraken.studioSettings?.(patch).then(setSettings).catch((reason: Error) => setError(reason.message));
  const lists: [keyof Pick<StudioSettings, "dungeondraftFolders" | "packFolders">, "dd" | "pack", string, string][] = [
    ["dungeondraftFolders", "dd", "Dungeondraft packs", "Folders holding .dungeondraft_pack files"],
    ["packFolders", "pack", "Art packs", "Folders holding art packs (.mod)"],
  ];
  return (
    <SettingsSection title="Map Studio art" setting="studio-folders">
      {error ? <p className="error">{error}</p> : null}
      {lists.map(([key, kind, label, hint]) => (
        <div key={key} className="studio-folder-list" data-studio-folders={key}>
          <span className="set-text">
            <span className="set-label">{label}</span>
            <span className="set-hint">{hint}.</span>
          </span>
          <div className="studio-folder-items">
          {(settings?.[key] ?? []).length === 0 ? <span className="set-hint">None yet.</span> : null}
          {(settings?.[key] ?? []).map((folder) => (
            <span key={folder} className={settings?.found[folder] === false ? "studio-folder missing" : "studio-folder"} data-folder={folder} title={settings?.found[folder] === false ? "This folder is not there" : folder}>
              {folder}
              <button type="button" aria-label={`Stop reading ${folder}`} onClick={() => save({ [key]: (settings?.[key] ?? []).filter((item) => item !== folder) })}>
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            data-action={`studio-add-${kind}`}
            title={hint}
            onClick={() => {
              void kraken.studioPickFolder?.(kind).then((folder) => {
                if (folder) save({ [key]: [...(settings?.[key] ?? []), folder] });
              });
            }}
          >
            Add a folder…
          </button>
          </div>
        </div>
      ))}
    </SettingsSection>
  );
}

// How long landed dice stay on the table before they fade, for every seat:
// the GM's to set (a slider and the seconds), sent when the slider is let go.
function DiceHoldSetting({ session }: { session: Session }) {
  const saved = session.options.diceHold ?? 2.6;
  const [seconds, setSeconds] = useState(saved);
  useEffect(() => setSeconds(saved), [saved]);
  const send = (value: number) => {
    const clean = Math.round(Math.min(60, Math.max(0.5, value)) * 10) / 10;
    setSeconds(clean);
    if (clean !== saved) session.setTableOptions({ diceHold: clean } as never);
  };
  return (
    <SettingRow label="Dice stay on the table" hint="Seconds the landed dice stay before they fade, for everyone." className="settings-dice-hold">
      <input type="range" min={0.5} max={15} step={0.1} value={Math.min(15, seconds)} aria-label="Dice on the table (slider)" data-setting="dice-hold-slider" onChange={(event) => setSeconds(Number(event.target.value))} onPointerUp={() => send(seconds)} onKeyUp={() => send(seconds)} onBlur={() => send(seconds)} />
      <input type="number" className="set-number" min={0.5} max={60} step={0.1} value={seconds} aria-label="Dice on the table (seconds)" data-setting="dice-hold" onChange={(event) => setSeconds(Number(event.target.value))} onBlur={(event) => send(Number(event.target.value))} onKeyDown={(event) => event.key === "Enter" && send(Number((event.target as HTMLInputElement).value))} />
      <span className="set-unit">s</span>
    </SettingRow>
  );
}

// Ability cards: off unless this player wants them (kept in this browser).
function CardsSetting() {
  const cards = useSyncExternalStore(cardsStore.subscribe, cardsStore.settings);
  return (
    <SettingsSection title="Ability cards" setting="cards-section">
      <Toggle label="Spells and weapons as cards" hint="Your character's spells and weapons as painted cards, on a Cards tab of the character sheet (Undock puts them in a window of their own, anywhere on the table or out of the app) and the Cards button in the sidebar. They roll the same as the sheet. Off unless you want them." setting="cards" checked={cards.on} onChange={(on) => cardsStore.set({ on })} />
      {cards.on ? <Toggle label="Card effects" hint="Flips, foil and sparks." setting="card-effects" checked={cards.effects} onChange={(on) => cardsStore.set({ effects: on })} /> : null}
    </SettingsSection>
  );
}

// The picture on the table's background, for every seat: FG's desktop decal.
export function TableDecal({ session }: { session: Session }) {
  const id = usePreviewed("decal", session.options.decal);
  if (id === "") return null;
  if (id === "kraken") return <Emblem />;
  const url = session.decalUrl(id);
  // FG's DECALPOS: in the middle, covering the table, or as large as fits (Maelstrom's emblem stays in the middle).
  return url ? <img key={id} className="emblem decal" data-fit={session.options.decalFit ?? "center"} src={url} alt="" draggable={false} /> : <Emblem />;
}

const KRAKEN: DecalItem = { id: "kraken", name: "Kraken", group: "Maelstrom" };
const cleanError = (error: unknown) => (error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Could not add that picture.");

// The game this campaign is played with (Kraken's own pictures come in a set for each).
function useCampaignRuleset(session: Session) {
  const [ruleset, setRuleset] = useState("");
  const campaignId = session.hostInfo?.campaignId ?? "";
  useEffect(() => {
    let live = true;
    void window.kraken
      ?.campaigns()
      .then((list) => live && setRuleset(list.find((item) => item.id === campaignId)?.ruleset ?? ""))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [campaignId]);
  return ruleset;
}

// Choose the background decal, as FG's Select Decal, or the desktop's
// wallpaper (FG's desktop theme): pictures by name, a set for each game
// (this campaign's first), a search, none at all. Better than FG: Browse picks
// a picture from anywhere on this computer (or drop one here); it is copied
// into Kraken's assets folder, so every campaign can use it from then on.
export function DecalPicker({ session, kind = "decal", onClose }: { session: Session; kind?: PictureKind; onClose: () => void }) {
  const wallpaper = kind === "wallpaper";
  const gmIcon = kind === "gmicon";
  // The dice tower: Kraken's drawn looks first, then the GM's own tower pictures.
  const tower = kind === "tower";
  const current = wallpaper ? session.options.wallpaper : gmIcon ? session.options.gmIcon : tower ? session.options.towerStyle || "stone" : session.options.decal;
  const [items, setItems] = useState<DecalItem[] | null>(null);
  const [failed, setFailed] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [chosen, setChosen] = useState(current);
  const [dropping, setDropping] = useState(false);
  // Tried on this screen as it is clicked (pickerPreview); OK makes it the table's, Cancel or closing puts back what was.
  const previewKey: PreviewKey = wallpaper ? "wallpaper" : gmIcon ? "gmIcon" : tower ? "towerStyle" : "decal";
  const kept = useRef(false);
  // The wallpaper's position (as Windows'), tried at once like the pictures.
  const [fit, setFit] = useState<WallpaperFit>(session.options.wallpaperFit ?? "tile");
  const choose = (id: string) => {
    setChosen(id);
    pickerPreview.set(previewKey, tower ? id || "stone" : id);
  };
  useEffect(
    () => () => {
      // Kept: the preview stays until the table's own setting has come back, so nothing flickers to the old one.
      const clear = () => {
        pickerPreview.clear(previewKey);
        pickerPreview.clear("wallpaperFit");
      };
      if (kept.current) window.setTimeout(clear, 1500);
      else clear();
    },
    [previewKey],
  );
  const kraken = window.kraken;
  const ruleset = useCampaignRuleset(session);

  useEffect(() => {
    let live = true;
    session
      .decalList(kind)
      .then((list) => live && setItems(list))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [session.decalList, kind]);

  const all = useMemo(
    () => [...(tower ? TOWER_LOOKS.map((look): DecalItem => ({ id: look.id, name: look.name, group: "Maelstrom" })) : wallpaper || gmIcon ? [] : [KRAKEN]), ...(items ?? [])],
    [items, wallpaper, gmIcon, tower],
  );
  // A chip for each set: this campaign's game first, then Kraken's, then the rest.
  const sets = useMemo(() => {
    const names = [...new Set(all.map((item) => item.ruleset ?? item.group))];
    return names.sort((a, b) => Number(b === ruleset) - Number(a === ruleset) || Number(b === "Maelstrom") - Number(a === "Maelstrom"));
  }, [all, ruleset]);
  const shown = useMemo(() => {
    const wanted = search.trim().toLowerCase();
    const mine = (item: DecalItem) => Number(!!ruleset && item.ruleset === ruleset);
    return all
      .filter((item) => !group || (item.ruleset ?? item.group) === group)
      .filter((item) => !wanted || `${item.group} ${item.name} ${item.ruleset ?? ""}`.toLowerCase().includes(wanted))
      .sort((a, b) => mine(b) - mine(a));
  }, [all, group, search, ruleset]);

  function apply(id: string) {
    pickerPreview.set(previewKey, tower ? id || "stone" : id);
    kept.current = true;
    session.setTableOptions(wallpaper ? { wallpaper: id, wallpaperFit: fit } : gmIcon ? { gmIcon: id } : tower ? { towerStyle: id || "stone" } : { decal: id });
    onClose();
  }

  function added(item: DecalItem) {
    setItems((list) => [item, ...(list ?? []).filter((other) => other.id !== item.id)]);
    choose(item.id);
    setSearch("");
    setGroup("");
  }

  async function browse() {
    setFailed("");
    try {
      const item = await kraken?.pickDecal(kind);
      if (item) added(item);
    } catch (error) {
      setFailed(cleanError(error));
    }
  }

  async function drop(event: DragEvent) {
    event.preventDefault();
    setDropping(false);
    const file = event.dataTransfer.files[0];
    if (!file || !kraken) return;
    setFailed("");
    try {
      added(await kraken.addDecal(file.name, new Uint8Array(await file.arrayBuffer()), kind));
    } catch (error) {
      setFailed(cleanError(error));
    }
  }

  return (
    <div
      className={dropping ? "decal-picker dropping" : "decal-picker"}
      data-kind={kind}
      onDragOver={(event) => {
        if ([...event.dataTransfer.types].includes("Files")) {
          event.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(event) => void drop(event)}
    >
      {sets.length > 1 ? (
        <div className="decal-sets" role="tablist" aria-label="Sets">
          <button type="button" role="tab" aria-selected={group === ""} className={group === "" ? "decal-set on" : "decal-set"} onClick={() => setGroup("")}>
            All
          </button>
          {sets.map((name) => (
            <button key={name} type="button" role="tab" aria-selected={group === name} className={group === name ? "decal-set on" : "decal-set"} data-set={name} onClick={() => setGroup(name)}>
              {name}
              {name === ruleset ? <span className="decal-set-mark">this campaign</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className={wallpaper ? "decal-grid walls" : "decal-grid"} role="listbox" aria-label={wallpaper ? "Wallpapers" : "Decals"}>
        {shown.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={chosen === item.id}
            className={chosen === item.id ? "decal-tile on" : "decal-tile"}
            data-decal={item.id}
            title={`${item.group}\n${item.name}`}
            onClick={() => choose(item.id)}
            onDoubleClick={() => apply(item.id)}
          >
            {wallpaper ? (
              <span className="decal-thumb wall" style={{ backgroundImage: `url("${session.decalUrl(item.id, "wallpaper")}")` }} />
            ) : (
              <span className={gmIcon ? "decal-thumb icon" : tower ? "decal-thumb tower" : "decal-thumb"}>
                {tower && towerLook(item.id) ? <TowerArt on={chosen === item.id} style={item.id} size={52} /> : item.id === "kraken" ? <Emblem className="decal-image" /> : <img className="decal-image" src={session.decalUrl(item.id, kind)} alt="" loading="lazy" draggable={false} />}
              </span>
            )}
            <span className="decal-name">{item.name}</span>
            {group === "" && item.group !== "Maelstrom" && item.group !== item.name ? <span className="decal-group">{item.group}</span> : null}
          </button>
        ))}
        {items === null ? <p className="hint">Gathering pictures…</p> : null}
        {items !== null && shown.length === 0 ? <p className="hint decal-empty">Nothing by that name.</p> : null}
      </div>
      <div className="decal-search">
        <input type="search" placeholder={wallpaper ? "Search wallpapers" : gmIcon ? "Search icons" : tower ? "Search towers" : "Search decals"} aria-label="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
        {kraken ? (
          <button type="button" className="ghost" title="Open the folder Maelstrom keeps these in" onClick={() => void kraken.openDecalFolder(kind)}>
            Assets folder
          </button>
        ) : null}
      </div>
      {tower ? <p className="hint">How the dice tower looks on the table, for everyone. Browse or drop a picture of your own (a PNG with a clear background stands best); it is kept in your assets folder for every campaign.</p> : null}
      {gmIcon ? <p className="hint">Your picture beside everything you say in chat, for the whole table. It follows you into every new campaign.</p> : null}
      {wallpaper ? <p className="hint">A wallpaper repeats across the desktop, so a picture that tiles works best. A picture you add is kept in your assets folder for every campaign.</p> : null}
      {failed ? (
        <p className="error" role="alert">
          {failed}
        </p>
      ) : null}
      <div className="decal-actions">
        {kraken ? (
          <button type="button" data-action="decal-browse" onClick={() => void browse()}>
            Browse…
          </button>
        ) : null}
        {wallpaper ? (
          <label className="wallpaper-fit" title="How the picture meets the screen, as Windows' desktop background">
            Position{" "}
            <select
              data-setting="wallpaper-fit"
              value={fit}
              onChange={(event) => {
                const next = event.target.value as WallpaperFit;
                setFit(next);
                pickerPreview.set("wallpaperFit", next);
              }}
            >
              <option value="fill">Fill</option>
              <option value="fit">Fit</option>
              <option value="stretch">Stretch</option>
              <option value="tile">Tile</option>
              <option value="center">Centre</option>
            </select>
          </label>
        ) : null}
        {tower ? null : (
          <button type="button" data-action="decal-empty" onClick={() => apply("")}>
            {wallpaper ? "Plain Desktop" : gmIcon ? "Name Only" : "Use Empty Decal"}
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="primary" data-action="decal-ok" onClick={() => apply(chosen)}>
          OK
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
