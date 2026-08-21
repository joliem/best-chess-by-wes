import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TreasureBoard, type CoinReveal } from "@/components/chess/TreasureBoard";
import { CoinIcon } from "@/components/CoinIcon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  applyMove,
  GLYPH,
  hasAnyMove,
  findKing,
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
  COIN_HELP,
  emptyChest,
  scatterCoins,
  type Chest,
  type CoinKind,
  type CoinMap,
  type Shield,
} from "@/lib/treasure";
import { BrandMark } from "@/components/Brand";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { lostFromBoard } from "@/lib/captures";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/treasure")({
  head: () => ({
    meta: [
      { title: "Treasure Chess — Hidden Coins & Magic Powers" },
      {
        name: "description",
        content:
          "Chess with six hidden coins buried in the middle ranks. Land on one, then spend gold for Queen powers or silver for two turns of temporary invincibility.",
      },
      { property: "og:title", content: "Treasure Chess — Hidden Coins & Magic Powers" },
      {
        property: "og:description",
        content:
          "Two-player chess where the middle of the board hides 3 gold and 3 silver coins. Collect them, then spend them for powers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TreasureChess,
});

const NAME: Record<Color, string> = { w: "White", b: "Black" };
const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];
const TREASURE_INTRO =
  "Six coins are buried somewhere in the middle four ranks. Land on them and plunder!";

function TreasureChess() {
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [coins, setCoins] = useState<CoinMap>({});
  const [chest, setChest] = useState<Chest>(emptyChest);
  const [emptyKnown, setEmptyKnown] = useState<Set<string>>(() => new Set());
  const [showEmptyMarks, setShowEmptyMarks] = useState(true);
  const [shields, setShields] = useState<Shield[]>([]);
  const [gold, setGold] = useState<{ id: string; color: Color } | null>(null);
  const [turn, setTurn] = useState<Color>("w");
  const [phase, setPhase] = useState<"move" | "promote" | "pick" | "over">("move");
  const [pendingCoin, setPendingCoin] = useState<CoinKind | null>(null);
  const [selected, setSelected] = useState<Sq | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Sq; to: Sq } | null>(null);
  const [epTarget, setEpTarget] = useState<Sq | null>(null);
  const [winner, setWinner] = useState<Color | "tie" | null>(null);
  const [drawByTreasure, setDrawByTreasure] = useState(false);
  const [check, setCheck] = useState<Color | null>(null);
  const lost = useMemo(() => lostFromBoard(board), [board]);
  useCaptureToast(lost);
  const [reveal, setReveal] = useState<CoinReveal | null>(null);
  const [log, setLog] = useState<string[]>([TREASURE_INTRO]);

  // Randomised on the client only, so the server render always matches.
  useEffect(() => setCoins(scatterCoins()), []);

  const say = (line: string, removeIntro = false) =>
    setLog((current) =>
      [line, ...(removeIntro ? current.filter((item) => item !== TREASURE_INTRO) : current)].slice(
        0,
        7,
      ),
    );

  const shieldedIds = shields.map((s) => s.id);

  const moves = useMemo(() => {
    if (!selected || phase !== "move") return [];
    const piece = board[selected.r]![selected.c];
    if (!piece) return [];
    return safeMoves(board, selected, epTarget, gold, shieldedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, selected, phase, epTarget, gold, turn, shields]);

  const pickable = useMemo(() => {
    if (phase !== "pick") return null;
    const out: Sq[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r]![c];
        if (!p || p.color !== turn) continue;
        if (p.type === "k") continue;
        out.push({ r, c });
      }
    }
    return out;
  }, [phase, board, turn, pendingCoin]);

  const score = (c: Color) => chest[c].gold * 2 + chest[c].silver;

  function reset() {
    setBoard(initialBoard());
    setCoins(scatterCoins());
    setChest(emptyChest());
    setEmptyKnown(new Set());
    setShields([]);
    setGold(null);
    setTurn("w");
    setPhase("move");
    setPendingCoin(null);
    setSelected(null);
    setPending(null);
    setLastMove(null);
    setEpTarget(null);
    setWinner(null);
    setDrawByTreasure(false);
    setCheck(null);
    setLog([TREASURE_INTRO]);
  }

  /**
   * Hand over the turn: tick the other side's shields, then work out whether
   * the new player to move is in check, checkmated or stalemated.
   */
  function endTurn(nextBoard: Board, nextEp: Sq | null, nextGold: Buff, baseShields = shields) {
    const nextShields = baseShields
      .map((s) => (s.color === turn ? s : { ...s, movesLeft: s.movesLeft - 1 }))
      .filter((s) => s.movesLeft > 0);
    setShields(nextShields);
    setSelected(null);
    setPendingCoin(null);

    const nextTurn = other(turn);
    setTurn(nextTurn);

    const ids = nextShields.map((s) => s.id);
    const checked = inCheck(nextBoard, nextTurn, nextGold);
    const canMove = hasAnyMove(nextBoard, nextTurn, nextEp, nextGold, ids);
    setCheck(checked ? nextTurn : null);

    if (!canMove) {
      if (checked) {
        setWinner(turn);
        setPhase("over");
        say(`♛ Checkmate! ${NAME[turn]} wins.`);
      } else {
        const w = score("w");
        const b = score("b");
        setDrawByTreasure(true);
        setWinner(w === b ? "tie" : w > b ? "w" : "b");
        setPhase("over");
        say(`😐 Stalemate — treasure decides it: White ${w} vs Black ${b}.`);
      }
      return;
    }
    if (checked) say(`⚔️ ${NAME[nextTurn]} is in CHECK — you must get out of it!`);
    setPhase("move");
  }

  function collect(to: Sq) {
    const k = key(to);
    const pile = coins[k];
    if (pile && pile.gold + pile.silver > 0) {
      const finder = turn;
      setReveal({ sq: to, gold: pile.gold, silver: pile.silver, nonce: Date.now() });
      setCoins((m) => ({ ...m, [k]: { gold: 0, silver: 0 } }));
      // let the square flip and show the loot before it flies into the chest
      window.setTimeout(() => {
        setChest((ch) => ({
          ...ch,
          [finder]: { gold: ch[finder].gold + pile.gold, silver: ch[finder].silver + pile.silver },
        }));
      }, 900);
      window.setTimeout(() => setReveal(null), 1600);
      const bits = [
        pile.gold ? `${pile.gold} gold` : null,
        pile.silver ? `${pile.silver} silver` : null,
      ].filter(Boolean);
      say(`💰 ${NAME[turn]} dug up ${bits.join(" and ")} on ${sqName(to)}!`);
    }
    setEmptyKnown((s) => new Set(s).add(k));
  }

  function commitMove(from: Sq, to: Sq, promoteTo: PieceType = "q") {
    const mover = board[from.r]![from.c]!;
    const asQueen = gold && gold.color === turn && gold.id === mover.id;
    const result = applyMove(board, from, to, epTarget, promoteTo);
    if (asQueen) {
      // borrowed powers only — the piece turns back into itself
      const landed = result.board[to.r]![to.c];
      if (landed) result.board[to.r]![to.c] = { ...landed, type: mover.type };
      setGold(null);
      say(`👑 ${NAME[turn]}'s ${PIECE_NAME[mover.type]} used its Queen powers and turned back.`);
    }
    setBoard(result.board);
    setLastMove({ from, to });
    setPending(null);
    setEpTarget(result.epTarget);
    const capture = result.captured
      ? ` and captured a ${PIECE_NAME[result.captured.type]}${result.enPassant ? " en passant" : ""}`
      : "";
    say(
      result.castled
        ? `${NAME[turn]} castled ${result.castled}side.`
        : `${NAME[turn]} played ${PIECE_NAME[mover.type]} to ${sqName(to)}${capture}${
            result.promoted && !asQueen ? ` — promoted to ${PIECE_NAME[promoteTo]}!` : ""
          }.`,
      lastMove === null,
    );
    collect(to);
    if (result.kingTaken) {
      setWinner(turn);
      setPhase("over");
      return;
    }
    endTurn(result.board, result.epTarget, asQueen ? null : gold);
  }

  function onSquare(sq: Sq) {
    if (phase === "pick") {
      const piece = board[sq.r]![sq.c];
      if (!piece || piece.color !== turn) return;
      if (piece.type === "k") return;
      if (pendingCoin === "silver") {
        const nextShields: Shield[] = [
          ...shields.filter((x) => x.id !== piece.id),
          { id: piece.id, color: turn, movesLeft: 2 },
        ];
        setShields(nextShields);
        say(
          `⚪ ${NAME[turn]} spent a silver coin — their ${PIECE_NAME[piece.type]} on ${sqName(sq)} is untouchable for 2 enemy moves.`,
        );
        endTurn(board, epTarget, gold, nextShields);
      } else {
        const nextGold: Buff = { id: piece.id, color: turn };
        setGold(nextGold);
        say(
          `🪙 ${NAME[turn]} spent a gold coin — their ${PIECE_NAME[piece.type]} on ${sqName(sq)} moves like a Queen next turn (and already attacks like one).`,
        );
        endTurn(board, epTarget, nextGold);
      }
      return;
    }

    if (phase !== "move") return;
    const piece = board[sq.r]![sq.c];

    if (selected && moves.some((m) => same(m, sq))) {
      const mover = board[selected.r]![selected.c]!;
      const asQueen = gold && gold.color === turn && gold.id === mover.id;
      if (mover.type === "p" && !asQueen && (sq.r === 0 || sq.r === 7)) {
        setPending({ from: selected, to: sq });
        setPhase("promote");
        return;
      }
      commitMove(selected, sq);
      return;
    }

    if (piece && piece.color === turn) {
      setSelected(selected && same(selected, sq) ? null : sq);
    }
  }

  function spend(kind: CoinKind) {
    if (phase !== "move" || chest[turn][kind] < 1) return;
    if (check === turn) {
      say(`⚔️ ${NAME[turn]} is in check — you must answer the check before spending a coin.`);
      return;
    }
    setChest((ch) => ({ ...ch, [turn]: { ...ch[turn], [kind]: ch[turn][kind] - 1 } }));
    setPendingCoin(kind);
    setSelected(null);
    setPhase("pick");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-3 py-4">
      <BrandMark />
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-torch">Wesley&apos;s</p>
        <h1 className="text-4xl text-foreground sm:text-5xl">Treasure Chess</h1>
        <p className="mt-2 text-muted-foreground">
          Six coins are buried in the middle four ranks. Land on one to grab it — then spend it for
          magic.
        </p>
        <div className="mt-1 flex justify-center text-xs text-torch">
          <Link to="/" className="underline">
            ← All variants
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-3">
          <TreasureChest color={other(turn)} chest={chest} active={false} onSpend={spend} />

          <div
            className={cn(
              "mx-auto flex w-fit max-w-full items-center justify-center rounded-xl border border-border bg-card px-5 py-2 text-center",
              phase === "pick" && "border-jade",
              check === turn && phase === "move" && "border-destructive",
            )}
          >
            <span className="text-lg">
              {phase === "pick"
                ? `${NAME[turn]}: pick a piece for your ${pendingCoin} coin`
                : phase === "promote"
                  ? "Choose a promotion"
                  : phase === "over"
                    ? "Game over"
                    : check === turn
                      ? `${NAME[turn]} to move — CHECK!`
                      : `${NAME[turn]} to move`}
            </span>
          </div>

          <CapturedBar lost={lost} />

          <TreasureBoard
            board={board}
            viewer={turn}
            selected={selected}
            moves={moves}
            lastMove={lastMove}
            shieldedIds={shieldedIds}
            goldId={gold?.id ?? null}
            emptyKnown={emptyKnown}
            showEmptyMarks={showEmptyMarks}
            checkSq={check ? findKing(board, check) : null}
            pickable={pickable}
            reveal={reveal}
            onSquare={onSquare}
          />

          <TreasureChest color={turn} chest={chest} active={phase === "move"} onSpend={spend} />
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-lg">How Treasure Chess works</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <CoinIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  3 gold + ⚪ 3 silver coins hide on random middle-rank squares (a square can hold
                  more than one).
                </span>
              </li>
              <li>🏃 Land on a square and you scoop up every coin hidden there.</li>
              <li className="flex gap-2">
                <CoinIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Gold: spend your whole move to give a piece (not your king) Queen powers through
                  your following move. A gold-powered piece attacks like a Queen and can give check
                  (or even checkmate!) the moment it&apos;s chosen. It can move and capture like a
                  Queen through your next move, but then reverts back to its original form.
                </span>
              </li>
              <li>
                ⚪ Silver: spend your whole move to make a piece (not your king) uncapturable for 2
                enemy moves.
              </li>
              <li>
                ♛ Normal check rules except a stalemate is decided by treasure stockpiles remaining
                (1 gold coin = 2 silver coins). A stalemate only ends in a draw if treasure
                stockpiles are equal.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Switch id="marks" checked={showEmptyMarks} onCheckedChange={setShowEmptyMarks} />
              <label htmlFor="marks" className="cursor-pointer">
                <span className="block leading-tight">
                  Memory helper{" "}
                  <span
                    className={cn(
                      "text-xs",
                      showEmptyMarks ? "text-torch" : "text-muted-foreground",
                    )}
                  >
                    {showEmptyMarks ? "· ON" : "· OFF"}
                  </span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  Marks a small red ✕ on every square proven to have no coins left.
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-lg">Battle Log</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {log.map((line, i) => (
                <li key={`${i}-${line}`} className={i === 0 ? "text-foreground" : ""}>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <Button variant="outline" onClick={reset}>
            New game
          </Button>
        </aside>
      </div>

      {phase === "promote" && pending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-deep">
            <h2 className="text-2xl">Promote your pawn</h2>
            <div className="mt-4 flex justify-center gap-2">
              {PROMOTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-xl border border-border px-4 py-2 text-4xl hover:border-torch"
                  onClick={() => {
                    setPhase("move");
                    commitMove(pending.from, pending.to, t);
                  }}
                >
                  {GLYPH[turn][t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "over" && winner !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-deep">
            <div className="text-6xl">{winner === "tie" ? "🤝" : "🏆"}</div>
            <h2 className="mt-4 text-3xl">
              {winner === "tie" ? "Perfectly even!" : `${NAME[winner]} wins!`}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {drawByTreasure
                ? `Draw on the board, so the chests decided it — White ${score("w")} vs Black ${score("b")} (gold counts double).`
                : "Checkmate — king cornered, treasure and all."}
            </p>
            <Button className="mt-6 w-full" onClick={reset}>
              Play again
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

/** A drawn treasure chest with the coins earned stacked beside it. */
function TreasureChest({
  color,
  chest,
  active,
  onSpend,
}: {
  color: Color;
  chest: Chest;
  active: boolean;
  onSpend: (kind: CoinKind) => void;
}) {
  const mine = chest[color];
  const white = color === "w";

  const slot = (kind: CoinKind, i: number) => {
    const has = mine[kind] > i;
    const usable = has && active;
    return (
      <button
        key={`${kind}-${i}`}
        type="button"
        disabled={!usable}
        title={has ? COIN_HELP[kind] : "Empty slot"}
        onClick={() => onSpend(kind)}
        className={cn(
          "grid size-8 place-items-center rounded-full border-2 text-base transition",
          has
            ? kind === "gold"
              ? "border-torch bg-torch/30 shadow-glow"
              : "border-foreground/60 bg-foreground/25"
            : "border-dashed border-border/60 bg-transparent opacity-35",
          usable ? "cursor-pointer hover:scale-110" : "cursor-default",
        )}
      >
        {has ? (kind === "gold" ? "🪙" : "⚪") : ""}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border-2 px-3 py-2",
        white ? "border-piece-light/70 bg-piece-light/10" : "border-piece-dark bg-piece-dark/40",
        active && "shadow-glow",
      )}
    >
      {/* the chest itself */}
      <div className="w-24 shrink-0 select-none" aria-hidden>
        <svg viewBox="0 0 100 78" className="w-full drop-shadow-[0_4px_6px_oklch(0_0_0/0.5)]">
          {(() => {
            const shell = white ? "oklch(0.99 0.01 95)" : "oklch(0.22 0.03 250)";
            const shade = white ? "oklch(0.86 0.02 90)" : "oklch(0.15 0.02 250)";
            const iron = white ? "oklch(0.36 0.04 205)" : "oklch(0.62 0.03 240)";
            return (
              <g stroke={iron} strokeWidth={3} strokeLinejoin="round">
                {/* domed lid */}
                <path d="M10 34 A40 30 0 0 1 90 34 Z" fill={shell} />
                <path
                  d="M10 34 A40 30 0 0 1 50 8 L50 34 Z"
                  fill={shade}
                  opacity={0.35}
                  stroke="none"
                />
                {/* lid rim */}
                <rect x="6" y="34" width="88" height="9" rx="3" fill={shade} />
                {/* body */}
                <path d="M11 43 h78 v25 a4 4 0 0 1 -4 4 h-70 a4 4 0 0 1 -4 -4 Z" fill={shell} />
                {/* iron straps */}
                <path d="M28 10.5 A40 30 0 0 0 22 34 M22 43 v29" fill="none" strokeWidth={5} />
                <path d="M72 10.5 A40 30 0 0 1 78 34 M78 43 v29" fill="none" strokeWidth={5} />
                {/* clasp */}
                <rect
                  x="44"
                  y="36"
                  width="12"
                  height="16"
                  rx="2"
                  fill="oklch(0.82 0.16 74)"
                  strokeWidth={2.5}
                />
                <circle cx="50" cy="45" r="2.4" fill={iron} stroke="none" />
              </g>
            );
          })()}
        </svg>
        <p
          className={cn(
            "mt-1 text-center text-[11px] leading-tight",
            white ? "text-piece-light" : "text-foreground/80",
          )}
        >
          {NAME[color]}&apos;s chest
        </p>
      </div>

      {/* coins earned, one row of gold and one of silver */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <span className="w-10 text-[10px] uppercase tracking-wider text-muted-foreground">
            Gold
          </span>
          {[0, 1, 2].map((i) => slot("gold", i))}
        </div>
        <div className="flex items-center gap-1">
          <span className="w-10 text-[10px] uppercase tracking-wider text-muted-foreground">
            Silver
          </span>
          {[0, 1, 2].map((i) => slot("silver", i))}
        </div>
      </div>

      {active && (
        <span className="ml-auto text-xs text-muted-foreground">Click a coin to spend it</span>
      )}
    </div>
  );
}
