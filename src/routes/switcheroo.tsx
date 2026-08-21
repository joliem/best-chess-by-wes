import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SwitcherooBoard } from "@/components/chess/SwitcherooBoard";
import { Button } from "@/components/ui/button";
import {
  applyMove,
  GLYPH,
  hasAnyMove,
  findKing,
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
import { BrandMark } from "@/components/Brand";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { lostFromBoard } from "@/lib/captures";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/switcheroo")({
  head: () => ({
    meta: [
      { title: "Switcheroo Chess — Play as Your Opponent" },
      {
        name: "description",
        content:
          "A chess variant where the board randomly spins and you must play a move as your opponent — blunder as badly as you can before control snaps back.",
      },
      { property: "og:title", content: "Switcheroo Chess — Play as Your Opponent" },
      {
        property: "og:description",
        content:
          "1-in-10 chance before any move that the board spins: you move their army, then they move yours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SwitcherooChess,
});

const NAME: Record<Color, string> = { w: "White", b: "Black" };
const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];
const SWITCH_CHANCE = 0.1;

function SwitcherooChess() {
  const [board, setBoard] = useState<Board>(() => initialBoard());
  /** the human whose turn it is to click */
  const [controller, setController] = useState<Color>("w");
  /** how many plies of switcheroo remain (2 = playing their army, 1 = they play yours) */
  const [swapLeft, setSwapLeft] = useState(0);
  const [ply, setPly] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<Sq | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Sq; to: Sq } | null>(null);
  const [epTarget, setEpTarget] = useState<Sq | null>(null);
  const [phase, setPhase] = useState<"move" | "promote" | "over">("move");
  const [winner, setWinner] = useState<Color | "tie" | null>(null);
  const [check, setCheck] = useState<Color | null>(null);
  const lost = useMemo(() => lostFromBoard(board), [board]);
  useCaptureToast(lost);
  const [log, setLog] = useState<string[]>([
    "Every move has a 1-in-10 chance of a switcheroo. Watch out!",
  ]);
  const rolled = useRef(-1);

  const mover: Color = swapLeft > 0 ? other(controller) : controller;
  const say = (line: string) => setLog((l) => [line, ...l].slice(0, 7));

  // Roll for a switcheroo at the start of each normal turn (client-only randomness).
  useEffect(() => {
    if (phase !== "move" || swapLeft > 0 || rolled.current === ply) return;
    rolled.current = ply;
    if (Math.random() >= SWITCH_CHANCE) return;
    setSwapLeft(2);
    setSpinning(true);
    setSelected(null);
    window.setTimeout(() => setSpinning(false), 1200);
    say(
      `🌀 SWITCHEROO! The board spins — ${NAME[controller]} must move ${NAME[other(controller)]}'s army.`,
    );
  }, [ply, phase, swapLeft, controller]);

  const moves = useMemo(() => {
    if (!selected || phase !== "move") return [];
    const piece = board[selected.r]![selected.c];
    if (!piece || piece.color !== mover) return [];
    return safeMoves(board, selected, epTarget);
  }, [board, selected, phase, epTarget, mover]);

  function reset() {
    setBoard(initialBoard());
    setController("w");
    setSwapLeft(0);
    setPly(0);
    rolled.current = -1;
    setSpinning(false);
    setSelected(null);
    setPending(null);
    setLastMove(null);
    setEpTarget(null);
    setPhase("move");
    setWinner(null);
    setCheck(null);
    setLog(["Fresh board. Every move has a 1-in-10 chance of a switcheroo."]);
  }

  function endTurn(nextBoard: Board, nextEp: Sq | null) {
    setSelected(null);
    const nextSwap = swapLeft > 0 ? swapLeft - 1 : 0;
    const nextController = other(controller);
    const nextMover: Color = nextSwap > 0 ? other(nextController) : nextController;
    setSwapLeft(nextSwap);
    setController(nextController);
    setPly((p) => p + 1);

    const checked = inCheck(nextBoard, nextMover);
    const canMove = hasAnyMove(nextBoard, nextMover, nextEp);
    setCheck(checked ? nextMover : null);

    if (!canMove) {
      setWinner(checked ? other(nextMover) : "tie");
      setPhase("over");
      say(checked ? `♛ Checkmate! ${NAME[other(nextMover)]} wins.` : "😐 Stalemate — it's a draw.");
      return;
    }
    if (nextSwap === 1) {
      say(`🔁 Now ${NAME[nextController]} plays ${NAME[nextMover]}'s pieces.`);
    } else if (swapLeft === 1) {
      say("✅ Switcheroo over — everyone back to their own army.");
    }
    if (checked) say(`⚔️ ${NAME[nextMover]} is in CHECK.`);
    setPhase("move");
  }

  function commitMove(from: Sq, to: Sq, promoteTo: PieceType = "q") {
    const piece = board[from.r]![from.c]!;
    const result = applyMove(board, from, to, epTarget, promoteTo);
    setBoard(result.board);
    setLastMove({ from, to });
    setPending(null);
    setEpTarget(result.epTarget);
    const capture = result.captured
      ? ` and captured a ${PIECE_NAME[result.captured.type]}${result.enPassant ? " en passant" : ""}`
      : "";
    say(
      result.castled
        ? `${NAME[controller]} castled ${result.castled}side with ${NAME[piece.color]}.`
        : `${NAME[controller]} moved ${NAME[piece.color]}'s ${PIECE_NAME[piece.type]} to ${sqName(to)}${capture}${
            result.promoted ? ` — promoted to ${PIECE_NAME[promoteTo]}!` : ""
          }.`,
    );
    endTurn(result.board, result.epTarget);
  }

  function onSquare(sq: Sq) {
    if (phase !== "move") return;
    const piece = board[sq.r]![sq.c];

    if (selected && moves.some((m) => same(m, sq))) {
      const mover2 = board[selected.r]![selected.c]!;
      if (mover2.type === "p" && (sq.r === 0 || sq.r === 7)) {
        setPending({ from: selected, to: sq });
        setPhase("promote");
        return;
      }
      commitMove(selected, sq);
      return;
    }

    if (piece && piece.color === mover) {
      setSelected(selected && same(selected, sq) ? null : sq);
    }
  }

  const swapped = swapLeft > 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-3 py-4">
      <BrandMark />
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-torch">Wesley&apos;s</p>
        <h1 className="text-4xl text-foreground sm:text-5xl">Switcheroo Chess</h1>
        <p className="mt-2 text-muted-foreground">
          By random chance, roles reverse — you play their army, then they play yours. Get Blunder
          away!
        </p>
        <Link to="/" className="mt-1 inline-block text-xs text-torch underline">
          ← All variants
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "mx-auto flex w-fit max-w-full items-center justify-center rounded-xl border border-border bg-card px-5 py-2 text-center",
              swapped && "border-[oklch(0.6_0.18_300)] animate-pulse-glow",
              check === mover && "border-destructive",
            )}
          >
            <span className="text-lg">
              {phase === "over"
                ? "Game over"
                : swapped
                  ? `🌀 ${NAME[controller]} is playing ${NAME[mover]}'s pieces!${
                      check === mover ? ` — ${NAME[mover]} is in CHECK!` : ""
                    }`
                  : `${NAME[controller]} to move${check === mover ? " — CHECK!" : ""}`}
            </span>
          </div>

          <CapturedBar lost={lost} />

          <SwitcherooBoard
            board={board}
            viewer={controller}
            mover={mover}
            selected={selected}
            moves={moves}
            lastMove={lastMove}
            swapped={swapped}
            spinning={spinning}
            checkSq={check ? findKing(board, check) : null}
            onSquare={onSquare}
          />

          {selected && phase === "move" && moves.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              That piece has no legal moves right now
              {check === mover
                ? ` — ${NAME[mover]} is in check, so only moves that stop the check are allowed.`
                : " — it's pinned to its own king."}
            </p>
          )}

        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-lg">How Switcheroo Chess works</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                🌀 Before any move there&apos;s a 1-in-10 chance the board spins into switcheroo
                mode.
              </li>
              <li>
                💜 While the squares are purple &amp; green, you move your <em>opponent&apos;s</em>{" "}
                pieces — blunder as badly as you can.
              </li>
              <li>
                🔁 Then they get one move with <em>your</em> pieces before control snaps back to
                normal.
              </li>
            </ul>
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
            <h2 className="text-2xl">Promote the pawn</h2>
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
                  {GLYPH[mover][t]}
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
              {winner === "tie" ? "Stalemate!" : `${NAME[winner]} wins!`}
            </h2>
            <Button className="mt-6 w-full" onClick={reset}>
              Play again
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
