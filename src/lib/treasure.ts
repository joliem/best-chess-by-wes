import { key, type Color, type Sq } from "./chess";

export type CoinKind = "gold" | "silver";

/** how many coins of each kind sit on a square */
export type CoinPile = { gold: number; silver: number };

export type CoinMap = Record<string, CoinPile>;

export type Chest = Record<Color, CoinPile>;

export const emptyChest = (): Chest => ({
  w: { gold: 0, silver: 0 },
  b: { gold: 0, silver: 0 },
});

/** The 4 middle ranks: board rows 2,3,4,5 (ranks 6,5,4,3). */
export const MIDDLE_ROWS = [2, 3, 4, 5];

/**
 * Drop 3 gold + 3 silver on random middle-rank squares. Squares can stack
 * several coins, so we simply pick a random square per coin.
 */
export function scatterCoins(): CoinMap {
  const map: CoinMap = {};
  const drop = (kind: CoinKind) => {
    const r = MIDDLE_ROWS[Math.floor(Math.random() * MIDDLE_ROWS.length)]!;
    const c = Math.floor(Math.random() * 8);
    const k = key({ r, c });
    const pile = map[k] ?? { gold: 0, silver: 0 };
    pile[kind] += 1;
    map[k] = pile;
  };
  for (let i = 0; i < 3; i++) drop("gold");
  for (let i = 0; i < 3; i++) drop("silver");
  return map;
}

export const pileTotal = (p?: CoinPile) => (p ? p.gold + p.silver : 0);

/** true when a piece may not be captured this turn */
export type Shield = { id: string; color: Color; movesLeft: number };

/** queen powers that expire after the opposing player's move */
export type GoldPower = { id: string; color: Color; movesLeft: number };

export const COIN_GLYPH: Record<CoinKind, string> = { gold: "🪙", silver: "⚪" };

export const COIN_HELP: Record<CoinKind, string> = {
  gold: "Give one of your pieces (not the king) Queen powers through your opponent's next move.",
  silver: "Make one of your pieces (not the king) invincible through your opponent's next move.",
};

export function sqIsKnownEmpty(known: Set<string>, sq: Sq) {
  return known.has(key(sq));
}
