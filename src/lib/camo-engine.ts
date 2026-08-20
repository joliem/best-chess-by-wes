import {
  applyMove,
  camoMoves,
  inCheck,
  initialBoard,
  key,
  other,
  PIECE_NAME,
  same,
  sqName,
  type Board,
  type Color,
  type PieceType,
  type Sq,
} from "@/lib/chess";
import { emptyLost, sortLost, type Lost } from "@/lib/captures";
import { canScout, canSee, skey } from "@/lib/fog";

export const NAME: Record<Color, string> = { w: "White", b: "Black" };

export type GuessRecord = { sq: Sq; hit: boolean };

export type CamoState = {
  board: Board;
  turn: Color;
  phase: "move" | "guess" | "over";
  epTarget: Sq | null;
  lastMove: { from: Sq; to: Sq } | null;
  guesses: Record<Color, GuessRecord[]>;
  /** squares scouted for good — visible to both players */
  revealed: string[];
  /** pieces each colour has lost */
  lost: Lost;
  winner: Color | null;
  /** each side keeps its own battle log so nothing leaks through the fog */
  log: Record<Color, string[]>;
  ply: number;
};

/** One player's censored view of the game. */
export type CamoPublicState = Omit<CamoState, "log" | "guesses" | "board"> & {
  board: Board;
  log: string[];
  guesses: GuessRecord[];
  /** true when the viewer's own king is in check */
  check: boolean;
  /** legal destinations for the viewer's pieces, keyed `r-c` (their turn only) */
  legal: Record<string, Sq[]>;
};

export type CamoAction =
  { kind: "move"; from: Sq; to: Sq; promoteTo?: PieceType } | { kind: "guess"; sq: Sq };

export type CamoOutcome = { ok: true; state: CamoState } | { ok: false; error: string };

function say(log: string[], line: string): string[] {
  return [line, ...log].slice(0, 8);
}

function tell(state: CamoState, color: Color, line: string): Record<Color, string[]> {
  return { ...state.log, [color]: say(state.log[color], line) };
}

export function createCamoState(): CamoState {
  const opening = "White moves first. Nobody can see everything.";
  return {
    board: initialBoard(),
    turn: "w",
    phase: "move",
    epTarget: null,
    lastMove: null,
    guesses: { w: [], b: [] },
    revealed: [],
    lost: emptyLost(),
    winner: null,
    log: { w: [opening], b: [opening] },
    ply: 0,
  };
}

/**
 * Strip everything `viewer` isn't allowed to know: pieces standing on squares
 * still under camouflage, the other side's guesses and log, and move trails
 * through the fog. Pass `null` for a spectator, who sees only scouted squares.
 *
 * The legal-move map is computed on the *true* board, so a player can infer
 * hidden pieces from where their own pieces may or may not go.
 */
export function maskCamoState(state: CamoState, viewer: Color | null): CamoPublicState {
  const over = state.phase === "over";
  state = { ...state, revealed: state.revealed ?? [], lost: state.lost ?? emptyLost() };
  const board: Board = state.board.map((row, r) =>
    row.map((piece, c) => {
      if (!piece) return null;
      if (over) return piece;
      if (!viewer) return state.revealed.includes(skey({ r, c })) ? piece : null;
      return canSee(state.board, { r, c }, viewer, state.revealed) ? piece : null;
    }),
  );
  const trailVisible =
    state.lastMove !== null &&
    (over || (!!viewer && canSee(state.board, state.lastMove.to, viewer, state.revealed)));

  const legal: Record<string, Sq[]> = {};
  if (viewer && !over && state.phase === "move" && state.turn === viewer) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = state.board[r]![c];
        if (piece?.color !== viewer) continue;
        legal[key({ r, c })] = camoMoves(state.board, { r, c }, state.epTarget);
      }
    }
  }

  return {
    board,
    turn: state.turn,
    phase: state.phase,
    epTarget: state.epTarget,
    lastMove: trailVisible ? state.lastMove : null,
    guesses: viewer ? state.guesses[viewer] : [],
    revealed: state.revealed,
    lost: state.lost,
    winner: state.winner,
    log: viewer ? state.log[viewer] : state.log.w.filter((l) => l.startsWith("🏆")),
    ply: state.ply,
    check: !!viewer && !over && inCheck(state.board, viewer),
    legal,
  };
}

export function applyCamoAction(state: CamoState, action: CamoAction, actor: Color): CamoOutcome {
  if (state.phase === "over") return { ok: false, error: "This game is already over." };
  if (actor !== state.turn) return { ok: false, error: "It isn't your turn." };
  state = { ...state, revealed: state.revealed ?? [], lost: state.lost ?? emptyLost() };

  for (const sq of action.kind === "move" ? [action.from, action.to] : [action.sq]) {
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

  if (action.kind === "guess") {
    if (state.phase !== "guess") return { ok: false, error: "There's nothing to scout right now." };
    if (!canScout(action.sq, actor, state.revealed)) {
      return { ok: false, error: "Pick one of your opponent's shrouded squares." };
    }
    const target = state.board[action.sq.r]?.[action.sq.c];
    const hit = !!target && target.color !== actor;
    let log = tell(
      state,
      actor,
      hit
        ? `🔦 You unhid ${sqName(action.sq)} — an enemy ${PIECE_NAME[target!.type]} was standing there!`
        : `🔦 You unhid ${sqName(action.sq)} — empty for now, but you'll see it from here on.`,
    );
    log = {
      ...log,
      [other(actor)]: say(
        log[other(actor)],
        `🔦 ${NAME[actor]} unhid ${sqName(action.sq)} — that square has lost its camouflage.`,
      ),
    };
    return {
      ok: true,
      state: {
        ...state,
        revealed: [...state.revealed, skey(action.sq)],
        guesses: { ...state.guesses, [actor]: [...state.guesses[actor], { sq: action.sq, hit }] },
        phase: "move",
        turn: other(actor),
        log,
      },
    };
  }

  if (state.phase !== "move") return { ok: false, error: "You can't move right now." };
  const { from, to } = action;
  const mover = state.board[from.r]?.[from.c];
  if (!mover) return { ok: false, error: "There's no piece on that square." };
  if (mover.color !== actor) return { ok: false, error: "That isn't your piece." };

  const legal = camoMoves(state.board, from, state.epTarget);
  if (!legal.some((m) => same(m, to))) {
    return { ok: false, error: "Something hidden blocks that move — try another one." };
  }

  const promoteTo: PieceType =
    mover.type === "p" && (to.r === 0 || to.r === 7) ? (action.promoteTo ?? "q") : "q";
  const result = applyMove(state.board, from, to, state.epTarget, promoteTo);

  const capture = result.captured
    ? ` and captured a ${PIECE_NAME[result.captured.type]}${result.enPassant ? " en passant" : ""}`
    : "";
  let log = tell(
    state,
    actor,
    result.castled
      ? `You castled ${result.castled}side.`
      : `You played ${PIECE_NAME[mover.type]} to ${sqName(to)}${capture}${
          result.promoted ? ` — promoted to ${PIECE_NAME[promoteTo]}!` : ""
        }.`,
  );

  const foe = other(actor);
  const foeLine = result.captured
    ? `⚔️ Your ${PIECE_NAME[result.captured.type]} on ${sqName(to)} was captured!`
    : "🌫️ Your opponent moved somewhere in the fog.";
  log = { ...log, [foe]: say(log[foe], foeLine) };

  const lost: Lost = result.captured
    ? {
        ...state.lost,
        [result.captured.color]: sortLost([
          ...state.lost[result.captured.color],
          result.captured.type,
        ]),
      }
    : state.lost;

  if (result.kingTaken) {
    log = {
      w: say(log.w, `🏆 ${NAME[actor]} captured the king and wins!`),
      b: say(log.b, `🏆 ${NAME[actor]} captured the king and wins!`),
    };
    return {
      ok: true,
      state: {
        ...state,
        board: result.board,
        lastMove: { from, to },
        epTarget: result.epTarget,
        phase: "over",
        winner: actor,
        lost,
        ply: state.ply + 1,
        log,
      },
    };
  }

  const stillShrouded = state.revealed.length < 32;
  return {
    ok: true,
    state: {
      ...state,
      board: result.board,
      lastMove: { from, to },
      epTarget: result.epTarget,
      phase: stillShrouded ? "guess" : "move",
      turn: stillShrouded ? actor : foe,
      lost,
      ply: state.ply + 1,
      log,
    },
  };
}
