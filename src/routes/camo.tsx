import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChessBoard, type GuessMark } from "@/components/chess/ChessBoard";
import { Button } from "@/components/ui/button";
import {
  applyMove,
  camoMoves,
  findKing,
  inCheck,
  GLYPH,
  initialBoard,
  isLight,
  other,
  PIECE_NAME,
  same,
  sqName,
  type Board,
  type Color,
  type PieceType,
  type Sq,
} from "@/lib/chess";
import { CAMO_RULES, isCamoBishop } from "@/lib/fog";
import { BrandMark } from "@/components/Brand";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { lostFromBoard } from "@/lib/captures";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/camo")({
  head: () => ({
    meta: [
      { title: "Camo Chess — Fog, Camouflage & Bluffing" },
      {
        name: "description",
        content:
          "Two-player chess with hidden information: camouflaged squares and Battleship-style scouting that clears the fog for good.",
      },
      { property: "og:title", content: "Camo Chess — Fog, Camouflage & Bluffing" },
      {
        property: "og:description",
        content:
          "Real chess rules, but half the board is camouflaged. Scout a square each turn to clear it forever. Pass and play on one device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CamoChess,
});

const NAME: Record<Color, string> = { w: "White", b: "Black" };

type Phase = "move" | "promote" | "guess" | "handoff" | "over";

const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];

function CamoChess() {
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [turn, setTurn] = useState<Color>("w");
  const [phase, setPhase] = useState<Phase>("move");
  const [selected, setSelected] = useState<Sq | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Sq; to: Sq } | null>(null);
  const [guesses, setGuesses] = useState<Record<Color, GuessMark[]>>({ w: [], b: [] });
  const [revealed, setRevealed] = useState<string[]>([]);
  const [winner, setWinner] = useState<Color | null>(null);
  const [log, setLog] = useState<string[]>(["White moves first. Nobody can see everything."]);
  const [epTarget, setEpTarget] = useState<Sq | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const [guessingBishop, setGuessingBishop] = useState<{ id: string; color: Color } | null>(null);

  const moves = useMemo(
    () => (selected && phase === "move" ? camoMoves(board, selected, epTarget) : []),
    [board, selected, phase, epTarget],
  );

  const lost = useMemo(() => lostFromBoard(board), [board]);
  useCaptureToast(lost);

  const say = (line: string) => setLog((l) => [line, ...l].slice(0, 7));

  function reset() {
    setBoard(initialBoard());
    setTurn("w");
    setPhase("move");
    setSelected(null);
    setLastMove(null);
    setGuesses({ w: [], b: [] });
    setRevealed([]);
    setWinner(null);
    setEpTarget(null);
    setPending(null);
    setGuessingBishop(null);
    setLog(["A fresh board. White moves first."]);
  }

  function commitMove(from: Sq, to: Sq, promoteTo: PieceType = "q") {
    const mover = board[from.r]![from.c]!;
    const result = applyMove(board, from, to, epTarget, promoteTo);
    setBoard(result.board);
    setLastMove({ from, to });
    setSelected(null);
    setPending(null);
    setEpTarget(result.epTarget);
    const capture = result.captured
      ? ` and captured a ${PIECE_NAME[result.captured.type]}${result.enPassant ? " en passant" : ""}`
      : "";
    say(
      result.castled
        ? `${NAME[turn]} castled ${result.castled}side — king and rook swapped places.`
        : `${NAME[turn]} played ${PIECE_NAME[mover.type]} to ${sqName(to)}${capture}${
            result.promoted ? ` — promoted to ${PIECE_NAME[promoteTo]}!` : ""
          }.`,
    );
    if (result.kingTaken) {
      setWinner(turn);
      setPhase("over");
      return;
    }
    if (isCamoBishop(mover) && !mover.revealed) setGuessingBishop({ id: mover.id, color: mover.color });
    endTurn();
  }

  function endTurn() {
    setSelected(null);
    setPhase("handoff");
  }

  function onSquare(sq: Sq) {
    if (phase === "guess") {
      if (!guessingBishop || isLight(sq) !== (guessingBishop.color === "w")) return;
      const target = board[sq.r]![sq.c];
      const hit = target?.id === guessingBishop.id;
      if (hit) setBoard((b) => b.map((row) => row.map((p) => p?.id === guessingBishop.id ? { ...p, revealed: true } : p)));
      setGuesses((g) => ({ ...g, [turn]: [...g[turn], { sq, hit }] }));
      say(
        hit
          ? `🔦 ${NAME[turn]} found the camouflaged bishop on ${sqName(sq)} — it is revealed for good!`
          : `🔦 ${NAME[turn]} guessed ${sqName(sq)} but missed the camouflaged bishop.`,
      );
      setGuessingBishop(null);
      endTurn();
      return;
    }

    if (phase !== "move") return;
    const piece = board[sq.r]![sq.c];

    if (selected && moves.some((m) => same(m, sq))) {
      const mover = board[selected.r]![selected.c]!;
      if (mover.type === "p" && (sq.r === 0 || sq.r === 7)) {
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

  const viewer = turn;
  const boardMode = phase === "guess" ? "guess" : phase === "move" ? "move" : "locked";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-3 py-4">
      <BrandMark />
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-torch">Wesley&apos;s</p>
        <h1 className="text-4xl text-foreground sm:text-5xl">Camo Chess</h1>
        <p className="mt-2 text-muted-foreground">
          Real chess rules — but some enemy pieces are hidden on the battlefield.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "mx-auto flex w-fit max-w-full items-center justify-center rounded-xl border border-border bg-card px-5 py-2 text-center",
              phase === "guess" && "border-torch",
            )}
          >
            <span className="text-lg">
              {phase === "guess"
                ? `${NAME[turn]}: guess the camouflaged bishop's ${guessingBishop?.color === "w" ? "light" : "dark"} square`
                : phase === "promote"
                  ? "Choose a promotion"
                  : phase === "handoff"
                    ? "Pass the device"
                    : phase === "over"
                      ? "Game over"
                      : `${NAME[turn]} to move`}
            </span>
          </div>

          <ChessBoard
            board={board}
            viewer={viewer}
            revealed={revealed}
            showAll={phase === "over"}
            selected={selected}
            moves={moves}
            lastMove={lastMove}
            guesses={guesses[viewer]}
            checkSq={phase !== "over" && inCheck(board, viewer) ? findKing(board, viewer) : null}
            mode={boardMode}
            onSquare={onSquare}
          />

          <CapturedBar lost={lost} />

          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-torch">
              How the camouflage works
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {CAMO_RULES.map((r) => r.blurb).join(" ")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              When your opponent moves their hidden kingside bishop, you immediately get one guess
              at its light or dark square. Find it to reveal it for good.
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-lg">Hidden-Info Rules</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {CAMO_RULES.map((rule) => (
                <li key={rule.name}>
                  <strong className="text-foreground">{rule.name}:</strong> {rule.blurb}
                </li>
              ))}
              <li>
                🔦 A correct guess reveals the bishop for the rest of the game.
              </li>
              <li>👑 Your king pulses red in check, and he can never step into check.</li>
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
            New Game
          </Button>
        </aside>
      </div>

      {phase === "promote" && pending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-deep">
            <h2 className="text-3xl">Promote your Pawn!</h2>
            <p className="mt-2 text-muted-foreground">
              It marched all the way to {sqName(pending.to)}. Pick what it becomes.
            </p>
            <div className="mt-6 grid grid-cols-4 gap-2">
              {PROMOTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => commitMove(pending.from, pending.to, t)}
                  className="rounded-xl border border-border bg-background py-3 text-4xl hover:border-torch"
                  aria-label={PIECE_NAME[t]}
                >
                  {GLYPH[turn][t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "handoff" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-deep">
            <div className="text-6xl">{other(turn) === "w" ? "♔" : "♚"}</div>
            <h2 className="mt-4 text-3xl">Pass to {NAME[other(turn)]}</h2>
            <p className="mt-2 text-muted-foreground">
              No peeking! Hand the device over, then tap below to see your own view of the board.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                const next = other(turn);
                setTurn(next);
                setPhase(guessingBishop ? "guess" : "move");
              }}
            >
              I&apos;m {NAME[other(turn)]} — show my board
            </Button>
          </div>
        </div>
      )}

      {phase === "over" && winner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-deep">
            <div className="text-6xl">🏆</div>
            <h2 className="mt-4 text-3xl">{NAME[winner]} wins!</h2>
            <p className="mt-2 text-muted-foreground">
              The losing king ran out of cover — his camouflage could not save him.
            </p>
            <Button className="mt-6 w-full" onClick={reset}>
              Play Again
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
