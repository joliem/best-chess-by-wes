const KEY = "wesley-chess-player-token";
const NAME_KEY = "wesley-chess-player-name";

/** A per-device secret that identifies a guest player. Browser-only. */
export function getPlayerToken(): string {
  if (typeof window === "undefined") return "";
  let token = window.localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    window.localStorage.setItem(KEY, token);
  }
  return token;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setPlayerName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name.slice(0, 24));
}
