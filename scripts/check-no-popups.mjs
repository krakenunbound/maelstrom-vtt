// No browser popups in the games: no confirm, alert or prompt boxes (Maelstrom asks in its own window: src/ui/Ask.tsx)
// and nothing that makes a browser ask for a permission (camera, microphone, notifications, location, clipboard
// reading, files and folders, MIDI, USB, serial, HID, persistent storage).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BANNED = [
  [/\bwindow\.(confirm|alert|prompt)\s*\(/, "a browser box (use askConfirm, tellUser or askText from src/ui/Ask.tsx)"],
  [/(^|[^.\w])(confirm|alert|prompt)\s*\(/, "a browser box (use askConfirm, tellUser or askText from src/ui/Ask.tsx)"],
  [/Notification\.requestPermission|new Notification\s*\(/, "a notifications permission"],
  [/getUserMedia|getDisplayMedia/, "a camera, microphone or screen permission"],
  [/navigator\.geolocation/, "a location permission"],
  [/navigator\.clipboard\.read/, "a clipboard permission"],
  [/show(Open|Save)FilePicker|showDirectoryPicker/, "a file system permission"],
  [/requestMIDIAccess|navigator\.(usb|serial|hid|bluetooth)/, "a device permission"],
  [/navigator\.storage\.persist\s*\(/, "a storage permission"],
];
const found = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|mjs|js)$/.test(entry.name)) {
      fs.readFileSync(full, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/^\s*(\/\/|\*)/.test(line)) return;
          for (const [pattern, what] of BANNED) if (pattern.test(line)) found.push(`${path.relative(ROOT, full)}:${index + 1}: ${what}`);
        });
    }
  }
};
for (const dir of ["src", "shared"]) walk(path.join(ROOT, dir));
if (found.length) {
  console.error(found.join("\n"));
  process.exit(1);
}
console.log("ok no popups: no browser boxes, no permission requests");
