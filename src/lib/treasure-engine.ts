import {
  applyMove,
  hasAnyMove,
  inCheck,
  initialBoard,
  key,
  other,
  PIECE_NAME,
  safeMoves,
  same,
  sqName,
  type Board,
  type Buff,
  type Color,
  type PieceType,
  type Sq,
} from "@/lib/chess";
import {
  emptyChest,
  scatterCoins,
  type Chest,
  type CoinKind,
  type CoinMap,
  type Shield,
} from "@/lib/treasure";

export const NAME: Record<Color, string> = { w: "White", b: "Black" };

export type TreasureState = {
  board: Board;
  /** SECRET — never sent to a client. */
  coins: CoinMap;
  chest: Chest;
  emptyKnown: string[];
  shields: Shield[];
  gold: Buff;
  turn: Color;
  phase: "move" | "pick" | "over";
  pendingCoin: CoinKind | null;
  epTarget: Sq | null;
  lastMove: { from: Sq; to: Sq } | null;
  check: Color | null;
  winner: Color | "tie" | null;
  drawByTreasure: boolean;
  /** drives the coin-flip animation on both devices */
  reveal: { sq: Sq; gold: number; silver: number; ply: number } | null;
  ply: number;
  log: string[];
};

/** What clients are allowed to know. */
export type TreasurePublicState = Omit<TreasureState, "coins">;

export function maskTreasureState(state: TreasureState): TreasurePublicState {
  const { coins: _coins, ...rest } = state;
  return rest;
}

export type TreasureAction =
  | { kind: "move"; from: Sq; to: Sq; promoteTo?: PieceType }
  | { kind: "spend"; coin: CoinKind }
  | { kind: "pick"; sq: Sq }
  | { kind: "draw" };

export type TreasureOutcome = { ok: true; state: TreasureState } | { ok: false; error: string };

export const treasureScore = (chest: Chest, c: Color) => chest[c].gold * 2 + chest[c].silver;

function say(log: string[], line: string): string[] {
  return [line, ...log].slice(0, 8);
}

const TREASURE_INTRO =
  "Six coins are buried somewhere in the middle four ranks. Land on them and plunder!";

export function createTreasureState(): TreasureState {
  return {
    board: initialBoard(),
    coins: scatterCoins(),
    chest: emptyChest(),
    emptyKnown: [],
    shields: [],
    gold: null,
    turn: "w",
    phase: "move",
    pendingCoin: null,
    epTarget: null,
    lastMove: null,
    check: null,
    winner: null,
    drawByTreasure: false,
    reveal: null,
    ply: 0,
    log: [TREASURE_INTRO],
  };
}

/** Hand the turn over: tick shields, then test check / mate / stalemate. */
function endTurn(
  state: TreasureState,
  next: {
    board: Board;
    epTarget: Sq | null;
    gold: Buff;
    shields: Shield[];
    log: string[];
    lastMove?: { from: Sq; to: Sq } | null;
    chest?: Chest;
    emptyKnown?: string[];
    reveal?: TreasureState["reveal"];
  },
): TreasureState {
  const mover = state.turn;
  const shields = next.shields
    .map((s) => (s.color === mover ? s : { ...s, movesLeft: s.movesLeft - 1 }))
    .filter((s) => s.movesLeft > 0);

  const turn = other(mover);
  const ids = shields.map((s) => s.id);
  const checked = inCheck(next.board, turn, next.gold);
  const canMove = hasAnyMove(next.board, turn, next.epTarget, next.gold, ids);
  const chest = next.chest ?? state.chest;

  let log = next.log;
  let phase: TreasureState["phase"] = "move";
  let winner: TreasureState["winner"] = null;
  let drawByTreasure = false;

  if (!canMove) {
    phase = "over";
    if (checked) {
      winner = mover;
      log = say(log, `♛ Checkmate! ${NAME[mover]} wins.`);
    } else {
      const w = treasureScore(chest, "w");
      const b = treasureScore(chest, "b");
      drawByTreasure = true;
      winner = w === b ? "tie" : w > b ? "w" : "b";
      log = say(log, `😐 Stalemate — treasure decides it: White ${w} vs Black ${b}.`);
    }
  } else if (checked) {
    log = say(log, `⚔️ ${NAME[turn]} is in CHECK — you must get out of it!`);
  }

  return {
    ...state,
    board: next.board,
    epTarget: next.epTarget,
    gold: next.gold,
    shields,
    chest,
    emptyKnown: next.emptyKnown ?? state.emptyKnown,
    reveal: next.reveal ?? null,
    lastMove: next.lastMove !== undefined ? next.lastMove : state.lastMove,
    turn,
    phase,
    winner,
    drawByTreasure,
    check: checked ? turn : null,
    pendingCoin: null,
    ply: state.ply + 1,
    log,
  };
}

export function applyTreasureAction(
  state: TreasureState,
  action: TreasureAction,
  actor: Color,
): TreasureOutcome {
  if (state.phase === "over") return { ok: false, error: "This game is already over." };
  if (actor !== state.turn && action.kind !== "draw") {
    return { ok: false, error: "It isn't your turn." };
  }

  if (action.kind === "draw") {
    const w = treasureScore(state.chest, "w");
    const b = treasureScore(state.chest, "b");
    return {
      ok: true,
      state: {
        ...state,
        phase: "over",
        drawByTreasure: true,
        winner: w === b ? "tie" : w > b ? "w" : "b",
        log: say(state.log, `🤝 Draw agreed — treasure decides it: White ${w} vs Black ${b}.`),
      },
    };
  }

  if (action.kind === "spend") {
    if (state.phase !== "move") return { ok: false, error: "You can't spend a coin right now." };
    if (state.chest[actor][action.coin] < 1)
      return { ok: false, error: "You don't have that coin." };
    if (state.check === actor) {
      return { ok: false, error: "You're in check — answer the check before spending a coin." };
    }
    return {
      ok: true,
      state: {
        ...state,
        chest: {
          ...state.chest,
          [actor]: { ...state.chest[actor], [action.coin]: state.chest[actor][action.coin] - 1 },
        },
        pendingCoin: action.coin,
        phase: "pick",
      },
    };
  }

  if (action.kind === "pick") {
    if (state.phase !== "pick" || !state.pendingCoin) {
      return { ok: false, error: "There's no coin waiting to be spent." };
    }
    const piece = state.board[action.sq.r]?.[action.sq.c];
    if (!piece || piece.color !== actor)
      return { ok: false, error: "Pick one of your own pieces." };
    if (piece.type === "k") return { ok: false, error: "Your king can't take a coin's power." };

    if (state.pendingCoin === "silver") {
      const shields: Shield[] = [
        ...state.shields.filter((s) => s.id !== piece.id),
        { id: piece.id, color: actor, movesLeft: 2 },
      ];
      const log = say(
        state.log,
        `⚪ ${NAME[actor]} spent a silver coin — their ${PIECE_NAME[piece.type]} on ${sqName(
          action.sq,
        )} is untouchable for 2 enemy moves.`,
      );
      return {
        ok: true,
        state: endTurn(state, {
          board: state.board,
          epTarget: state.epTarget,
          gold: state.gold,
          shields,
          log,
        }),
      };
    }

    const gold: Buff = { id: piece.id, color: actor };
    const log = say(
      state.log,
      `🪙 ${NAME[actor]} spent a gold coin — their ${PIECE_NAME[piece.type]} on ${sqName(
        action.sq,
      )} moves like a Queen next turn.`,
    );
    return {
      ok: true,
      state: endTurn(state, {
        board: state.board,
        epTarget: state.epTarget,
        gold,
        shields: state.shields,
        log,
      }),
    };
  }

  // --- a normal move -------------------------------------------------------
  if (state.phase !== "move") return { ok: false, error: "You can't move right now." };
  const { from, to } = action;
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
  const mover = state.board[from.r]?.[from.c];
  if (!mover) return { ok: false, error: "There's no piece on that square." };
  if (mover.color !== actor) return { ok: false, error: "That isn't your piece." };

  const shieldedIds = state.shields.map((s) => s.id);
  const legal = safeMoves(state.board, from, state.epTarget, state.gold, shieldedIds);
  if (!legal.some((m) => same(m, to))) return { ok: false, error: "That move isn't legal." };

  const asQueen = !!state.gold && state.gold.color === actor && state.gold.id === mover.id;
  const promoteTo: PieceType =
    mover.type === "p" && !asQueen && (to.r === 0 || to.r === 7) ? (action.promoteTo ?? "q") : "q";

  const result = applyMove(state.board, from, to, state.epTarget, promoteTo);
  if (asQueen) {
    const landed = result.board[to.r]![to.c];
    if (landed) result.board[to.r]![to.c] = { ...landed, type: mover.type };
  }

  const capture = result.captured
    ? ` and captured a ${PIECE_NAME[result.captured.type]}${result.enPassant ? " en passant" : ""}`
    : "";
  let log = say(
    state.ply === 0 ? state.log.filter((line) => line !== TREASURE_INTRO) : state.log,
    result.castled
      ? `${NAME[actor]} castled ${result.castled}side.`
      : `${NAME[actor]} played ${PIECE_NAME[mover.type]} to ${sqName(to)}${capture}${
          result.promoted && !asQueen ? ` — promoted to ${PIECE_NAME[promoteTo]}!` : ""
        }.`,
  );
  if (asQueen) {
    log = say(
      log,
      `👑 ${NAME[actor]}'s ${PIECE_NAME[mover.type]} used its Queen powers and turned back.`,
    );
  }

  // --- dig up any coins on the landing square ------------------------------
  const k = key(to);
  const pile = state.coins[k];
  let coins = state.coins;
  let chest = state.chest;
  let reveal: TreasureState["reveal"] = null;
  if (pile && pile.gold + pile.silver > 0) {
    coins = { ...state.coins, [k]: { gold: 0, silver: 0 } };
    chest = {
      ...state.chest,
      [actor]: {
        gold: state.chest[actor].gold + pile.gold,
        silver: state.chest[actor].silver + pile.silver,
      },
    };
    reveal = { sq: to, gold: pile.gold, silver: pile.silver, ply: state.ply + 1 };
    const bits = [
      pile.gold ? `${pile.gold} gold` : null,
      pile.silver ? `${pile.silver} silver` : null,
    ].filter(Boolean);
    log = say(log, `💰 ${NAME[actor]} dug up ${bits.join(" and ")} on ${sqName(to)}!`);
  }
  const emptyKnown = state.emptyKnown.includes(k) ? state.emptyKnown : [...state.emptyKnown, k];

  const withCoins: TreasureState = { ...state, coins };

  if (result.kingTaken) {
    return {
      ok: true,
      state: {
        ...withCoins,
        board: result.board,
        chest,
        emptyKnown,
        reveal,
        lastMove: { from, to },
        phase: "over",
        winner: actor,
        ply: state.ply + 1,
        log,
      },
    };
  }

  return {
    ok: true,
    state: endTurn(withCoins, {
      board: result.board,
      epTarget: result.epTarget,
      gold: asQueen ? null : state.gold,
      shields: state.shields,
      lastMove: { from, to },
      chest,
      emptyKnown,
      reveal,
      log,
    }),
  };
}
