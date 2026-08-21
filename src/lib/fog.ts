import { isLight, type Color, type Sq } from "./chess";

/** Stable key for a square. */
export const skey = (s: Sq) => `${s.r}-${s.c}`;

/** The one camouflaged piece per side: the kingside bishop. */
export const CAMO_START: Record<Color, Sq> = { w: { r: 7, c: 5 }, b: { r: 0, c: 5 } };

/**
 * White's kingside bishop lives on light squares, Black's on dark squares —
 * so a guess is always made on squares of that one shade.
 */
export const camoShade = (owner: Color): "light" | "dark" => (owner === "w" ? "light" : "dark");

/** Is this a square the camouflaged bishop of `owner` could possibly be on? */
export function canGuess(sq: Sq, owner: Color): boolean {
  return isLight(sq) === (camoShade(owner) === "light");
}

export const CAMO_RULES: Array<{ name: string; blurb: string }> = [
  {
    name: "Camouflage",
    blurb:
      "Only one piece per side is camouflaged: the kingside bishop. Your opponent cannot see it anywhere on the board (White's hides on light squares, Black's on dark squares). Everything else is normal chess.",
  },
  {
    name: "Battleship Guess",
    blurb:
      "The moment your opponent moves their camouflaged bishop — you'll be told, since nothing else moved that turn — you get one guess at the square it landed on. Guess right and the bishop loses its camouflage for the rest of the game.",
  },
];
