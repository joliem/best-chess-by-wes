import { type Board, type Color, type PieceType } from "@/lib/chess";

/** How many of each piece each side starts with. */
const START: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER: PieceType[] = ["q", "r", "b", "n", "p", "k"];

/** Pieces each color has lost, keyed by the color that lost them. */
export type Lost = Record<Color, PieceType[]>;

export const emptyLost = (): Lost => ({ w: [], b: [] });

export function sortLost(pieces: PieceType[]): PieceType[] {
  return [...pieces].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

/** Work out captured material by comparing a full board with the starting set. */
export function lostFromBoard(board: Board): Lost {
  const out = emptyLost();
  for (const color of ["w", "b"] as Color[]) {
    const counts: Record<string, number> = {};
    for (const row of board) {
      for (const piece of row) {
        if (piece && piece.color === color) counts[piece.type] = (counts[piece.type] ?? 0) + 1;
      }
    }
    for (const type of Object.keys(START) as PieceType[]) {
      const missing = Math.max(0, START[type] - (counts[type] ?? 0));
      for (let i = 0; i < missing; i++) out[color].push(type);
    }
    out[color] = sortLost(out[color]);
  }
  return out;
}

export function materialScore(pieces: PieceType[]): number {
  return pieces.reduce((sum, t) => sum + PIECE_VALUE[t], 0);
}
