import {
  applyMove,
  hasAnyMove,
  inCheck,
  initialBoard,
  other,
  PIECE_NAME,
  safeMoves,
  same,
  sqName,
  type Board,
  type Color,
  type PieceType,
  type Sq,
} from "@/lib/chess";

export const SWITCH_CHANCE = 0.1;
export const COLOR_NAME: Record<Color, string> = { w: "White", b: "Black" };
const SWITCHEROO_INTRO = "Every move has a 1-in-10 chance of a switcheroo. Watch out!";

export type SwitcherooState = {
  board: Board;
  /** the seat whose turn it is to click */
  controller: Color;
  /** plies of switcheroo remaining (2 = you move their army, 1 = they move yours) */
  swapLeft: number;
  ply: number;
  epTarget: Sq | null;
  lastMove: { from: Sq; to: Sq } | null;
  check: Color | null;
  phase: "move" | "over";
  winner: Color | "tie" | null;
  log: string[];
  /** ply number at which the board most recently spun (drives the animation) */
  spunAtPly: number | null;
};

/** whose pieces the controller is actually moving right now */
export const moverOf = (s: Pick<SwitcherooState, "controller" | "swapLeft">): Color =>
  s.swapLeft > 0 ? other(s.controller) : s.controller;

function say(log: string[], line: string): string[] {
  return [line, ...log].slice(0, 8);
}

/** Roll the switcheroo dice for a fresh, non-swapped turn. Server-side only. */
function rollSwitcheroo(state: SwitcherooState, random: () => number): SwitcherooState {
  if (state.phase !== "move" || state.swapLeft > 0) return state;
  // White's very first move is always normal — no switcheroo on ply 0.
  if (state.ply === 0) return state;
  if (random() >= SWITCH_CHANCE) return state;
  return {
    ...state,
    swapLeft: 2,
    spunAtPly: state.ply,
    log: say(
      state.log,
      `🌀 SWITCHEROO! The board spins — ${COLOR_NAME[state.controller]} must move ${
        COLOR_NAME[other(state.controller)]
      }'s army.`,
    ),
  };
}

export function createInitialState(random: () => number = Math.random): SwitcherooState {
  const base: SwitcherooState = {
    board: initialBoard(),
    controller: "w",
    swapLeft: 0,
    ply: 0,
    epTarget: null,
    lastMove: null,
    check: null,
    phase: "move",
    winner: null,
    log: [SWITCHEROO_INTRO],
    spunAtPly: null,
  };
  return rollSwitcheroo(base, random);
}

export type MoveAttempt = {
  from: Sq;
  to: Sq;
  promoteTo?: PieceType;
};

export type MoveOutcome = { ok: true; state: SwitcherooState } | { ok: false; error: string };

/**
 * Validate and apply one move. Pure — pass a seeded/real random source so the
 * server owns the switcheroo roll.
 */
export function applySwitcherooMove(
  state: SwitcherooState,
  attempt: MoveAttempt,
  random: () => number = Math.random,
): MoveOutcome {
  if (state.phase !== "move") return { ok: false, error: "This game is already over." };

  const { from, to } = attempt;
  for (const sq of [from, to]) {
    if (
      !Number.isInteger(sq.r) ||
      !Number.isInteger(sq.c) ||
      sq.r < 0 ||
      sq.r > 7 ||
      sq.c < 0 ||
      sq.c > 7
    ) {
      return { ok: false, error: "That square isn't on the board." };
    }
  }

  const mover = moverOf(state);
  const piece = state.board[from.r]?.[from.c];
  if (!piece) return { ok: false, error: "There's no piece on that square." };
  if (piece.color !== mover) return { ok: false, error: "That isn't the army you're moving." };

  const legal = safeMoves(state.board, from, state.epTarget);
  if (!legal.some((m) => same(m, to))) return { ok: false, error: "That move isn't legal." };

  const promoteTo: PieceType =
    piece.type === "p" && (to.r === 0 || to.r === 7) ? (attempt.promoteTo ?? "q") : "q";

  const result = applyMove(state.board, from, to, state.epTarget, promoteTo);

  const capture = result.captured
    ? ` and captured a ${PIECE_NAME[result.captured.type]}${result.enPassant ? " en passant" : ""}`
    : "";
  let log = say(
    state.ply === 0 ? state.log.filter((line) => line !== SWITCHEROO_INTRO) : state.log,
    result.castled
      ? `${COLOR_NAME[state.controller]} castled ${result.castled}side.`
      : `${COLOR_NAME[state.controller]} played ${PIECE_NAME[piece.type]} to ${sqName(to)}${capture}${result.promoted ? ` — promoted to ${PIECE_NAME[promoteTo]}!` : ""}.`,
  );

  const nextSwap = state.swapLeft > 0 ? state.swapLeft - 1 : 0;
  const nextController = other(state.controller);
  const nextMover: Color = nextSwap > 0 ? other(nextController) : nextController;

  const checked = inCheck(result.board, nextMover);
  const canMove = hasAnyMove(result.board, nextMover, result.epTarget);

  let next: SwitcherooState = {
    ...state,
    board: result.board,
    controller: nextController,
    swapLeft: nextSwap,
    ply: state.ply + 1,
    epTarget: result.epTarget,
    lastMove: { from, to },
    check: checked ? nextMover : null,
    phase: "move",
    winner: null,
    log,
  };

  if (!canMove) {
    log = say(
      log,
      checked
        ? `♛ Checkmate! ${COLOR_NAME[other(nextMover)]} wins.`
        : "😐 Stalemate — it's a draw.",
    );
    return {
      ok: true,
      state: { ...next, phase: "over", winner: checked ? other(nextMover) : "tie", log },
    };
  }

  if (nextSwap === 1) {
    log = say(log, `🔁 Now ${COLOR_NAME[nextController]} plays ${COLOR_NAME[nextMover]}'s pieces.`);
  } else if (state.swapLeft === 1) {
    log = say(log, "✅ Switcheroo over — everyone back to their own army.");
  }
  if (checked) log = say(log, `⚔️ ${COLOR_NAME[nextMover]} is in CHECK.`);

  next = { ...next, log };
  return { ok: true, state: rollSwitcheroo(next, random) };
}
