import {
  applyMove,
  findKing,
  inCheck,
  initialBoard,
  inside,
  other,
  safeMoves,
  same,
  type Board,
  type Color,
  type Piece,
  type Sq,
} from "@/lib/chess";

export type HiddenBishop = { piece: Piece; sq: Sq };
export type HiddenBishops = Record<Color, HiddenBishop | null>;

export function createBattleshipBoard(): { board: Board; hidden: HiddenBishops } {
  const board = initialBoard();
  const white = board[7]![5]!;
  const black = board[0]![5]!;
  board[7]![5] = null;
  board[0]![5] = null;
  return {
    board,
    hidden: {
      w: { piece: white, sq: { r: 7, c: 5 } },
      b: { piece: black, sq: { r: 0, c: 5 } },
    },
  };
}

/** Legal destinations for an ordinary piece. Every hidden bishop is intangible. */
export function battleshipPieceMoves(
  board: Board,
  hidden: HiddenBishops,
  from: Sq,
  epTarget: Sq | null,
  activeHiddenCheck: Color | null,
): Sq[] {
  const piece = board[from.r]?.[from.c];
  if (!piece) return [];
  return safeMoves(board, from, epTarget).filter((to) => {
    if (piece.type === "k" && Math.abs(to.c - from.c) === 2) {
      const step = to.c > from.c ? 1 : -1;
      const mid = applyMove(board, from, { r: from.r, c: from.c + step }, null).board;
      if (
        battleshipInCheck(board, hidden, piece.color, activeHiddenCheck) ||
        battleshipInCheck(mid, hidden, piece.color, activeHiddenCheck)
      ) {
        return false;
      }
    }
    const result = applyMove(board, from, to, epTarget);
    return !battleshipInCheck(result.board, hidden, piece.color, activeHiddenCheck);
  });
}

/** A hidden bishop moves like a bishop. Capturing reveals it; quiet moves keep it hidden. */
export function hiddenBishopMoves(
  board: Board,
  hidden: HiddenBishops,
  color: Color,
  activeHiddenCheck: Color | null,
): Sq[] {
  const bishop = hidden[color];
  if (!bishop) return [];
  const out: Sq[] = [];
  for (const [dr, dc] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    let r = bishop.sq.r + dr;
    let c = bishop.sq.c + dc;
    while (inside(r, c)) {
      const target = board[r]![c];
      if (target?.color === color) break;
      const to = { r, c };
      if (target?.type === "k") break;
      let nextBoard = board;
      let nextHidden: HiddenBishops;
      if (target) {
        nextBoard = board.map((row) => row.slice());
        nextBoard[r]![c] = { ...bishop.piece, moved: true, revealed: true };
        nextHidden = { ...hidden, [color]: null };
      } else {
        nextHidden = { ...hidden, [color]: { ...bishop, sq: to } };
      }
      if (!battleshipInCheck(nextBoard, nextHidden, color, activeHiddenCheck)) out.push(to);
      if (target) break;
      r += dr;
      c += dc;
    }
  }
  return out;
}

export function hiddenBishopAttacks(board: Board, bishop: HiddenBishop, target: Sq): boolean {
  const dr = target.r - bishop.sq.r;
  const dc = target.c - bishop.sq.c;
  if (Math.abs(dr) !== Math.abs(dc) || dr === 0) return false;
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  let r = bishop.sq.r + sr;
  let c = bishop.sq.c + sc;
  while (r !== target.r && c !== target.c) {
    if (board[r]![c]) return false;
    r += sr;
    c += sc;
  }
  return true;
}

export function battleshipInCheck(
  board: Board,
  hidden: HiddenBishops,
  color: Color,
  activeHiddenCheck: Color | null,
): boolean {
  if (inCheck(board, color)) return true;
  if (activeHiddenCheck !== other(color)) return false;
  const king = findKing(board, color);
  const enemy = hidden[other(color)];
  return !!king && !!enemy && hiddenBishopAttacks(board, enemy, king);
}

export function battleshipHasAnyMove(
  board: Board,
  hidden: HiddenBishops,
  color: Color,
  epTarget: Sq | null,
  activeHiddenCheck: Color | null,
): boolean {
  if (hiddenBishopMoves(board, hidden, color, activeHiddenCheck).length) return true;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (
        board[r]![c]?.color === color &&
        battleshipPieceMoves(board, hidden, { r, c }, epTarget, activeHiddenCheck).length
      ) {
        return true;
      }
    }
  }
  return false;
}

export function hiddenAt(hidden: HiddenBishops, sq: Sq): HiddenBishop | null {
  return Object.values(hidden).find((bishop) => bishop && same(bishop.sq, sq)) ?? null;
}
