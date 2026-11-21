// What the game calls the one who runs it: the GM in most games, the DM in AD&D (its manifest's gm). Words
// for people say GM in the code; GM(text) names them as this campaign's game does.
let title = "GM";

export function setGmTitle(next: string | undefined) {
  title = next || "GM";
}

export function gmTitle() {
  return title;
}

export function GM(text: string) {
  return title === "GM" ? text : text.replace(/\bGM\b/g, title);
}
