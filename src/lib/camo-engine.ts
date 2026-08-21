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
import { CAMO_START, camoShade, canGuess } from "@/lib/fog";

export const NAME: Record<Color, string> = { w: "White", b: "Black" };

export type GuessRecord = { sq: Sq; hit: boolean };

/** Where each side's camouflaged kingside bishop is, and whether it is still hidden. */
export type CamoTrack = { sq: Sq | null; hidden: boolean };

export type CamoState = {
  board: Board;
  turn: Color;
  phase: "move" | "guess" | "over";
  epTarget: Sq | null;
  lastMove: { from: Sq; to: Sq } | null;
  guesses: Record<Color, GuessRecord[]>;
  /** the camouflaged bishop of each side */
  camo: Record<Color, CamoTrack>;
  /** pieces each color has lost */
  lost: Lost;
  winner: Color | null;
  /** each side keeps its own battle log so nothing leaks through the camouflage */
  log: Record<Color, string[]>;
  ply: number;
};

/** One player's censored view of the game. */
export type CamoPublicState = Omit<CamoState, "log" | "guesses" | "board" | "camo"> & {
  board: Board;
  log: string[];
  guesses: GuessRecord[];
  /** the viewer's own camouflaged bishop, if it is still hidden */
  myCamo: Sq | null;
  /** whether the enemy bishop is still camouflaged */
  enemyHidden: boolean;
  /** true when the viewer's own king is in check */
  check: boolean;
  /** legal destinations for the viewer's pieces, keyed `r-c` (their turn only) */
  legal: Record<string, Sq[]>;
};

export type CamoAction =
  | { kind: "move"; from: Sq; to: Sq; promoteTo?: PieceType }
  | { kind: "guess"; sq: Sq };

export type CamoOutcome = { ok: true; state: CamoState } | { ok: false; error: string };

function say(log: string[], line: string): string[] {
  return [line, ...log].slice(0, 8);
}

function tell(state: CamoState, color: Color, line: string): Record<Color, string[]> {
  return { ...state.log, [color]: say(state.log[color], line) };
}

export function createCamoState(): CamoState {
  const opening = "White moves first. Each side's kingside bishop is camouflaged.";
  return {
    board: initialBoard(),
    turn: "w",
    phase: "move",
    epTarget: null,
    lastMove: null,
    guesses: { w: [], b: [] },
    camo: { w: { sq: CAMO_START.w, hidden: true }, b: { sq: CAMO_START.b, hidden: true } },
    lost: emptyLost(),
    winner: null,
    log: { w: [opening], b: [opening] },
    ply: 0,
  };
}

function normalize(state: CamoState): CamoState {
  return {
    ...state,
    lost: state.lost ?? emptyLost(),
    camo: state.camo ?? {
      w: { sq: CAMO_START.w, hidden: true },
      b: { sq: CAMO_START.b, hidden: true },
    },
  };
}

/**
 * Strip everything `viewer` isn't allowed to know: the enemy's camouflaged
 * bishop, the other side's guesses and log, and the move trail whenever that
 * bishop was the piece that moved. Pass `null` for a spectator, who sees
 * neither camouflaged bishop.
 *
 * The legal-move map is computed on the *true* board, so a player can still
 * infer the hidden bishop from where their own pieces may or may not go.
 */
export function maskCamoState(state: CamoState, viewer: Color | null): CamoPublicState {
  state = normalize(state);
  const over = state.phase === "over";

  const hiddenSquares: Sq[] = over
    ? []
    : (["w", "b"] as Color[])
        .filter((c) => c !== viewer && state.camo[c].hidden && state.camo[c].sq)
        .map((c) => state.camo[c].sq!);

  const board: Board = state.board.map((row, r) =>
    row.map((piece, c) => (hiddenSquares.some((s) => same(s, { r, c })) ? null : piece)),
  );

  const trailVisible =
    state.lastMove !== null &&
    (over || !hiddenSquares.some((s) => same(s, state.lastMove!.to)));

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

  const foe = viewer ? other(viewer) : null;
  return {
    board,
    turn: state.turn,
    phase: state.phase,
    epTarget: state.epTarget,
    lastMove: trailVisible ? state.lastMove : null,
    guesses: viewer ? state.guesses[viewer] : [],
    myCamo: viewer && state.camo[viewer].hidden ? state.camo[viewer].sq : null,
    enemyHidden: !!foe && state.camo[foe].hidden && !!state.camo[foe].sq,
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
  state = normalize(state);

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

  const foe = other(actor);

  if (action.kind === "guess") {
    if (state.phase !== "guess") return { ok: false, error: "There's nothing to guess right now." };
    const target = state.camo[foe];
    if (!target.hidden || !target.sq) return { ok: false, error: "Nothing left to guess." };
    if (!canGuess(action.sq, foe)) {
      return { ok: false, error: `Pick a ${camoShade(foe)} square.` };
    }
    const hit = same(action.sq, target.sq);
    let log = tell(
      state,
      actor,
      hit
        ? `🔦 You guessed ${sqName(action.sq)} — found it! The enemy bishop is exposed for good.`
        : `🔦 You guessed ${sqName(action.sq)} — nothing there. The bishop stays camouflaged.`,
    );
    log = {
      ...log,
      [foe]: say(
        log[foe],
        hit
          ? `🫥 ${NAME[actor]} guessed ${sqName(action.sq)} and found your bishop — it's exposed now.`
          : `🫥 ${NAME[actor]} guessed ${sqName(action.sq)} and missed. Your bishop stays hidden.`,
      ),
    };
    return {
      ok: true,
      state: {
        ...state,
        camo: { ...state.camo, [foe]: { ...target, hidden: !hit } },
        guesses: { ...state.guesses, [actor]: [...state.guesses[actor], { sq: action.sq, hit }] },
        phase: "move",
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
    return { ok: false, error: "That move isn't legal — try another one." };
  }

  const promoteTo: PieceType =
    mover.type === "p" && (to.r === 0 || to.r === 7) ? (action.promoteTo ?? "q") : "q";
  const result = applyMove(state.board, from, to, state.epTarget, promoteTo);

  // Follow the camouflaged bishops: the mover's may have moved, the foe's may
  // have just been captured.
  const mine = state.camo[actor];
  const theirs = state.camo[foe];
  const movedCamo = !!mine.sq && same(mine.sq, from);
  const camo: Record<Color, CamoTrack> = {
    ...state.camo,
    [actor]: movedCamo ? { ...mine, sq: to } : mine,
    [foe]: theirs.sq && same(theirs.sq, to) ? { sq: null, hidden: false } : theirs,
  };

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

  const hideMove = movedCamo && mine.hidden;
  const foeLine = hideMove
    ? `🫥 ${NAME[actor]} moved their camouflaged bishop — guess which ${camoShade(actor)} square it's on!`
    : result.captured
      ? `⚔️ Your ${PIECE_NAME[result.captured.type]} on ${sqName(to)} was captured!`
      : `${NAME[actor]} played ${PIECE_NAME[mover.type]} to ${sqName(to)}${
          result.captured ? " with a capture" : ""
        }.`;
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
        camo,
        lost,
        ply: state.ply + 1,
        log,
      },
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      board: result.board,
      lastMove: { from, to },
      epTarget: result.epTarget,
      // The foe always moves next; if the camouflaged bishop just moved they
      // first get one Battleship guess at where it went.
      phase: hideMove ? "guess" : "move",
      turn: foe,
      camo,
      lost,
      ply: state.ply + 1,
      log,
    },
  };
}
