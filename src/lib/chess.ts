export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type Piece = {
  id: string;
  type: PieceType;
  color: Color;
  /** true once the opposing player has permanently uncovered it */
  revealed: boolean;
  /** has this piece ever moved? (castling rights) */
  moved?: boolean;
};

export type Sq = { r: number; c: number };
export type Board = (Piece | null)[][];

export const same = (a: Sq, b: Sq) => a.r === b.r && a.c === b.c;
export const key = (s: Sq) => `${s.r}-${s.c}`;
export const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
/** light square = "white" colored square */
export const isLight = (s: Sq) => (s.r + s.c) % 2 === 0;

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const sqName = (s: Sq) => `${FILES[s.c]}${8 - s.r}`;

export const GLYPH: Record<Color, Record<PieceType, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

export const PIECE_NAME: Record<PieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

export const other = (c: Color): Color => (c === "w" ? "b" : "w");

const BACK: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

export function initialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0]![c] = { id: `b-${BACK[c]}-${c}`, type: BACK[c]!, color: "b", revealed: false };
    board[1]![c] = { id: `b-p-${c}`, type: "p", color: "b", revealed: false };
    board[6]![c] = { id: `w-p-${c}`, type: "p", color: "w", revealed: false };
    board[7]![c] = { id: `w-${BACK[c]}-${c}`, type: BACK[c]!, color: "w", revealed: false };
  }
  return board;
}

type Dir = [number, number];
const STRAIGHT: Dir[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAGONAL: Dir[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const KNIGHT: Dir[] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

/**
 * Pseudo-legal moves. In fog chess you cannot see checks, so there is no
 * check rule: the game ends when a king is captured.
 */
export function legalMoves(
  board: Board,
  from: Sq,
  epTarget: Sq | null = null,
  asType?: PieceType,
): Sq[] {
  const piece = board[from.r]?.[from.c];
  if (!piece) return [];
  const type = asType ?? piece.type;
  const out: Sq[] = [];
  const at = (r: number, c: number) => board[r]?.[c] ?? null;
  const push = (r: number, c: number) => {
    if (!inside(r, c)) return false;
    const target = at(r, c);
    if (target && target.color === piece.color) return false;
    out.push({ r, c });
    return !target;
  };

  if (type === "p") {
    const dir = piece.color === "w" ? -1 : 1;
    const startRow = piece.color === "w" ? 6 : 1;
    if (inside(from.r + dir, from.c) && !at(from.r + dir, from.c)) {
      out.push({ r: from.r + dir, c: from.c });
      if (from.r === startRow && !at(from.r + 2 * dir, from.c)) {
        out.push({ r: from.r + 2 * dir, c: from.c });
      }
    }
    for (const dc of [-1, 1]) {
      const r = from.r + dir;
      const c = from.c + dc;
      if (!inside(r, c)) continue;
      const target = at(r, c);
      if (target && target.color !== piece.color) out.push({ r, c });
      // en passant: the square just skipped by an enemy double-step pawn
      else if (!target && epTarget && epTarget.r === r && epTarget.c === c) out.push({ r, c });
    }
    return out;
  }

  if (type === "n") {
    for (const [dr, dc] of KNIGHT) push(from.r + dr, from.c + dc);
    return out;
  }

  if (type === "k") {
    for (const [dr, dc] of [...STRAIGHT, ...DIAGONAL]) push(from.r + dr, from.c + dc);
    // Castling — in fog chess we cannot know about checks, so the only
    // requirements are: king and rook untouched, and empty squares between.
    const home = piece.color === "w" ? 7 : 0;
    if (!piece.moved && from.r === home && from.c === 4) {
      const rookOk = (c: number) => {
        const rook = at(home, c);
        return !!rook && rook.type === "r" && rook.color === piece.color && !rook.moved;
      };
      if (rookOk(7) && !at(home, 5) && !at(home, 6)) out.push({ r: home, c: 6 });
      if (rookOk(0) && !at(home, 1) && !at(home, 2) && !at(home, 3)) out.push({ r: home, c: 2 });
    }
    return out;
  }

  const dirs = type === "r" ? STRAIGHT : type === "b" ? DIAGONAL : [...STRAIGHT, ...DIAGONAL];
  for (const [dr, dc] of dirs) {
    let r = from.r + dr;
    let c = from.c + dc;
    while (push(r, c)) {
      r += dr;
      c += dc;
    }
  }
  return out;
}

export type MoveResult = {
  board: Board;
  captured: Piece | null;
  promoted: boolean;
  kingTaken: boolean;
  castled: "king" | "queen" | null;
  enPassant: boolean;
  /** square an enemy pawn may capture onto next turn, if any */
  epTarget: Sq | null;
};

export function applyMove(
  board: Board,
  from: Sq,
  to: Sq,
  epTarget: Sq | null = null,
  promoteTo: PieceType = "q",
): MoveResult {
  const next = board.map((row) => row.slice());
  const piece = next[from.r]![from.c]!;
  let captured = next[to.r]![to.c];
  let moved: Piece = { ...piece, moved: true };
  let promoted = false;
  let castled: "king" | "queen" | null = null;
  let enPassant = false;

  // En passant: the captured pawn stands beside the destination, not on it.
  if (
    piece.type === "p" &&
    !captured &&
    to.c !== from.c &&
    epTarget &&
    epTarget.r === to.r &&
    epTarget.c === to.c
  ) {
    const victimRow = from.r;
    captured = next[victimRow]![to.c];
    next[victimRow]![to.c] = null;
    enPassant = true;
  }

  // Castling: the king steps two files and the rook hops over it.
  if (piece.type === "k" && Math.abs(to.c - from.c) === 2) {
    const home = from.r;
    const kingSide = to.c === 6;
    const rookFrom = kingSide ? 7 : 0;
    const rookTo = kingSide ? 5 : 3;
    const rook = next[home]![rookFrom];
    if (rook) {
      next[home]![rookFrom] = null;
      next[home]![rookTo] = { ...rook, moved: true };
    }
    castled = kingSide ? "king" : "queen";
  }

  if (moved.type === "p" && (to.r === 0 || to.r === 7)) {
    moved = { ...moved, type: promoteTo };
    promoted = true;
  }
  // A piece that captures gives itself away, and stays visible forever.
  if (captured) moved = { ...moved, revealed: true };
  next[from.r]![from.c] = null;
  next[to.r]![to.c] = moved;

  const nextEp =
    piece.type === "p" && Math.abs(to.r - from.r) === 2
      ? { r: (from.r + to.r) / 2, c: from.c }
      : null;

  return {
    board: next,
    captured: captured ?? null,
    promoted,
    kingTaken: captured?.type === "k",
    castled,
    enPassant,
    epTarget: nextEp,
  };
}

export function revealAt(board: Board, sq: Sq): Board {
  const piece = board[sq.r]?.[sq.c];
  if (!piece) return board;
  const next = board.map((row) => row.slice());
  next[sq.r]![sq.c] = { ...piece, revealed: true };
  return next;
}

export function findSquares(board: Board, color: Color): Sq[] {
  const out: Sq[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r]![c]?.color === color) out.push({ r, c });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Check / checkmate rules
 * A "buff" is a piece temporarily granted Queen powers by a gold coin. While
 * the buff is active the piece attacks (and therefore gives check) as a queen.
 * ------------------------------------------------------------------------- */

export type Buff = { id: string; color: Color } | null;

export const effType = (p: Piece, buff: Buff): PieceType =>
  buff && buff.color === p.color && buff.id === p.id ? "q" : p.type;

/** Squares a piece genuinely attacks (pawns attack diagonally only). */
function attacks(board: Board, from: Sq, buff: Buff): Sq[] {
  const piece = board[from.r]?.[from.c];
  if (!piece) return [];
  const type = effType(piece, buff);
  if (type === "p") {
    const dir = piece.color === "w" ? -1 : 1;
    return [from.c - 1, from.c + 1]
      .filter((c) => inside(from.r + dir, c))
      .map((c) => ({ r: from.r + dir, c }));
  }
  if (type === "k") {
    const out: Sq[] = [];
    for (const [dr, dc] of [...STRAIGHT, ...DIAGONAL]) {
      if (inside(from.r + dr, from.c + dc)) out.push({ r: from.r + dr, c: from.c + dc });
    }
    return out;
  }
  return legalMoves(board, from, null, type);
}

export function isAttacked(board: Board, sq: Sq, by: Color, buff: Buff = null): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]![c];
      if (!p || p.color !== by) continue;
      if (attacks(board, { r, c }, buff).some((a) => same(a, sq))) return true;
    }
  }
  return false;
}

export function findKing(board: Board, color: Color): Sq | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]![c];
      if (p && p.color === color && p.type === "k") return { r, c };
    }
  }
  return null;
}

export function inCheck(board: Board, color: Color, buff: Buff = null): boolean {
  const king = findKing(board, color);
  return king ? isAttacked(board, king, other(color), buff) : false;
}

/**
 * Fully legal moves: pseudo-legal, minus captures of shielded pieces, minus
 * anything that leaves (or moves through, when castling) your own king in check.
 */
export function safeMoves(
  board: Board,
  from: Sq,
  epTarget: Sq | null = null,
  buff: Buff = null,
  shieldedIds: string[] = [],
): Sq[] {
  const piece = board[from.r]?.[from.c];
  if (!piece) return [];
  const color = piece.color;
  const type = effType(piece, buff);
  const buffed = type !== piece.type;
  return legalMoves(board, from, epTarget, type).filter((to) => {
    const target = board[to.r]![to.c];
    if (target && target.color !== color && shieldedIds.includes(target.id)) return false;
    if (piece.type === "k" && Math.abs(to.c - from.c) === 2) {
      if (inCheck(board, color, buff)) return false;
      const step = to.c > from.c ? 1 : -1;
      const mid = applyMove(board, from, { r: from.r, c: from.c + step }, null).board;
      if (inCheck(mid, color, buff)) return false;
    }
    const after = applyMove(board, from, to, epTarget).board;
    // a gold-buffed piece reverts to its own type once it has moved
    if (buffed) {
      const landed = after[to.r]![to.c];
      if (landed) after[to.r]![to.c] = { ...landed, type: piece.type };
    }
    return !inCheck(after, color, buffed ? null : buff);
  });
}

export function hasAnyMove(
  board: Board,
  color: Color,
  epTarget: Sq | null,
  buff: Buff = null,
  shieldedIds: string[] = [],
): boolean {
  for (const sq of findSquares(board, color)) {
    if (safeMoves(board, sq, epTarget, buff, shieldedIds).length > 0) return true;
  }
  return false;
}

/**
 * Camo chess moves: pseudo-legal for every piece (pins are invisible in the
 * fog), but the king may never step into an attacked square or castle through
 * one — kings still play by real chess rules.
 */
export function camoMoves(board: Board, from: Sq, epTarget: Sq | null = null): Sq[] {
  const piece = board[from.r]?.[from.c];
  if (!piece) return [];
  const moves = legalMoves(board, from, epTarget);
  if (piece.type !== "k") return moves;
  const color = piece.color;
  return moves.filter((to) => {
    if (Math.abs(to.c - from.c) === 2) {
      if (inCheck(board, color)) return false;
      const step = to.c > from.c ? 1 : -1;
      const mid = applyMove(board, from, { r: from.r, c: from.c + step }, null).board;
      if (inCheck(mid, color)) return false;
    }
    return !inCheck(applyMove(board, from, to, epTarget).board, color);
  });
}
