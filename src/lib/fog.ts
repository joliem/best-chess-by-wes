import { isLight, type Board, type Color, type Piece, type Sq } from "./chess";

/** Stable key for a square, used to track permanently scouted squares. */
export const skey = (s: Sq) => `${s.r}-${s.c}`;

/**
 * The kingside bishop is the only camouflaged piece. It starts on f1/f8 and
 * stays hidden from the opponent until they correctly guess its square.
 */
export function isShroudSquare(sq: Sq, viewer: Color): boolean {
  return isLight(sq) !== (viewer === "w");
}

export function isCamoBishop(piece: Piece): boolean {
  return piece.type === "b" && (piece.id === "w-b-5" || piece.id === "b-b-5");
}

export function isScouted(revealed: readonly string[], sq: Sq): boolean {
  return revealed.includes(skey(sq));
}

/** Can `viewer` see whatever stands on `sq`? */
export function canSee(board: Board, sq: Sq, viewer: Color, revealed: readonly string[]): boolean {
  const piece = board[sq.r]?.[sq.c];
  if (!piece) return true;
  if (piece.color === viewer) return true;
  return !isCamoBishop(piece) || piece.revealed;
}

/** Can `actor` still scout this square? */
export function canScout(sq: Sq, actor: Color, revealed: readonly string[]): boolean {
  return isShroudSquare(sq, actor) && !isScouted(revealed, sq);
}

export const CAMO_RULES: Array<{ name: string; blurb: string }> = [
  {
    name: "Camouflage",
    blurb:
      "Only your opponent's kingside bishop is camouflaged. White's is always on light squares; Black's is always on dark squares.",
  },
  {
    name: "One Guess per Move",
    blurb:
      "Every time the hidden bishop moves, you immediately get one guess at its light or dark square. Guess correctly and it is revealed for the rest of the game; miss and it remains hidden until it moves again.",
  },
];
