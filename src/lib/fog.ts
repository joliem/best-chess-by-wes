import { isLight, type Board, type Color, type Sq } from "./chess";

/** Stable key for a square, used to track permanently scouted squares. */
export const skey = (s: Sq) => `${s.r}-${s.c}`;

/**
 * Squares of the viewer's own colour are always clear. The opposite-colour
 * squares are the ones shrouded in camouflage until they're scouted.
 */
export function isShroudSquare(sq: Sq, viewer: Color): boolean {
  return isLight(sq) !== (viewer === "w");
}

export function isScouted(revealed: readonly string[], sq: Sq): boolean {
  return revealed.includes(skey(sq));
}

/** Can `viewer` see whatever stands on `sq`? */
export function canSee(board: Board, sq: Sq, viewer: Color, revealed: readonly string[]): boolean {
  const piece = board[sq.r]?.[sq.c];
  if (!piece) return true;
  if (piece.color === viewer) return true;
  if (!isShroudSquare(sq, viewer)) return true;
  return isScouted(revealed, sq);
}

/** Can `actor` still scout this square? */
export function canScout(sq: Sq, actor: Color, revealed: readonly string[]): boolean {
  return isShroudSquare(sq, actor) && !isScouted(revealed, sq);
}

export const CAMO_RULES: Array<{ name: string; blurb: string }> = [
  {
    name: "Camouflage",
    blurb:
      "You only see enemy pieces standing on squares of your own colour. White is blind to the dark squares, Black to the light ones.",
  },
  {
    name: "Battleship Scouting",
    blurb:
      "After every move you pick one of your opponent's squares — dark squares if you're White, light squares if you're Black. That square loses its camouflage forever, so whatever stands there is visible from then on.",
  },
];
