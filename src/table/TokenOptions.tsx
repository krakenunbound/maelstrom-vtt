import type { Session } from "../session/useSession";
import { SettingRow, SettingsSection, Toggle } from "../ui/SettingsParts";

// The GM's token and measuring options (FG's token options), for every seat:
// what players see of health and names on tokens, and how a diagonal counts.
// The host sends players only what these let them see (mapState.cjs publicToken).
const HEALTH = [
  ["bar", "Bar"],
  ["barhover", "Bar on hover"],
  ["dot", "Dot"],
  ["dothover", "Dot on hover"],
  ["numbers", "Numbers (the tracker's hit points; a bar on tokens)"],
  ["off", "Off"],
] as const;
const EFFECTS = [
  ["on", "Icons"],
  ["hover", "Icons on hover"],
  ["mark", "One mark"],
  ["markhover", "One mark on hover"],
  ["off", "Off"],
] as const;

export function TokenOptionsSection({ session }: { session: Session }) {
  const options = session.options as { healthNpc?: string; healthPc?: string; healthGm?: string; names?: string; diagonal?: string; effectsGm?: string; effectsNpc?: string; effectsPc?: string; facingIndicator?: boolean; tokenFill?: string; initIndicator?: string };
  const set = (patch: Record<string, string | boolean>) => session.setTableOptions(patch as never);
  const effects = (key: "effectsGm" | "effectsNpc" | "effectsPc", label: string, hint: string) => (
    <SettingRow label={label} hint={hint}>
      <select value={options[key] ?? "on"} onChange={(event) => set({ [key]: event.target.value })} aria-label={label} data-setting={key}>
        {EFFECTS.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </SettingRow>
  );
  return (
    <SettingsSection title="Tokens and measuring" setting="tokens">
      <SettingRow label="Creatures' health" hint="What players see of the health of your creatures (NPCs), on their tokens and in the combat tracker: a dot is its status words, a bar the share left, numbers its hit points. You always see it.">
        <select value={options.healthNpc ?? "dot"} onChange={(event) => set({ healthNpc: event.target.value })} aria-label="Creatures' health" data-setting="health-npc">
          {HEALTH.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="Characters' health" hint="What players see of the characters' health on their tokens.">
        <select value={options.healthPc ?? "dot"} onChange={(event) => set({ healthPc: event.target.value })} aria-label="Characters' health" data-setting="health-pc">
          {HEALTH.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="Health you see" hint="What you see of health on tokens. The combat tracker always shows you everything.">
        <select value={options.healthGm ?? "dot"} onChange={(event) => set({ healthGm: event.target.value })} aria-label="Health you see" data-setting="health-gm">
          {HEALTH.filter(([value]) => value !== "numbers").map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </SettingRow>
      {effects("effectsNpc", "Creatures' effects", "What players see of your creatures' effects on their tokens: an icon each, one mark with the number, on hover, or nothing. Flames, frost and glows stay visible.")}
      {effects("effectsPc", "Characters' effects", "What players see of the characters' effects on their tokens.")}
      {effects("effectsGm", "Effects you see", "How you see effects on every token.")}
      <SettingRow label="Token size" hint="How much of its squares a token's picture fills.">
        <select value={options.tokenFill ?? "80"} onChange={(event) => set({ tokenFill: event.target.value })} aria-label="Token size" data-setting="token-fill">
          <option value="80">80%</option>
          <option value="100">Whole squares</option>
        </select>
      </SettingRow>
      <SettingRow label="Whose turn it is, on the map" hint="The token whose turn it is wears a glow, a turning ring, or nothing.">
        <select value={options.initIndicator ?? "glow"} onChange={(event) => set({ initIndicator: event.target.value })} aria-label="Whose turn it is, on the map" data-setting="init-indicator">
          <option value="glow">Glow</option>
          <option value="ring">Turning ring</option>
          <option value="off">Nothing</option>
        </select>
      </SettingRow>
      <Toggle label="Party vision and movement" hint="Every player sees what all the characters' tokens see, and may move any of them." checked={Boolean((options as { partyVision?: boolean }).partyVision)} onChange={(on) => set({ partyVision: on })} setting="party-vision" />
      <Toggle label="Facing arrows" hint="A small arrow on the rim of a token that faces a way (its picture turns either way)." checked={options.facingIndicator !== false} onChange={(on) => set({ facingIndicator: on })} setting="facing-indicator" />
      <SettingRow label="Token names" hint="Off: players see no names but their own. A token's unidentified name (its menu) is shown instead of its real one.">
        <select value={options.names ?? "hover"} onChange={(event) => set({ names: event.target.value })} aria-label="Token names" data-setting="token-names">
          <option value="hover">On hover</option>
          <option value="always">Always</option>
          <option value="off">Off</option>
        </select>
      </SettingRow>
      <SettingRow label="Diagonals" hint="How a diagonal square counts on the ruler and when dragging. A scene may set its own (the map's Scene settings).">
        <select value={options.diagonal ?? "1"} onChange={(event) => set({ diagonal: event.target.value })} aria-label="Diagonals" data-setting="diagonal">
          <option value="1">Every square counts one</option>
          <option value="1.5">5-10-5 (every second diagonal counts double)</option>
          <option value="raw">Straight line</option>
        </select>
      </SettingRow>
    </SettingsSection>
  );
}
