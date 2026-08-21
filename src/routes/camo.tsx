import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChessBoard } from "@/components/chess/ChessBoard";
import { Button } from "@/components/ui/button";
import { findKing, GLYPH, key, other, PIECE_NAME, same, sqName, type Color, type PieceType, type Sq } from "@/lib/chess";
import { CAMO_RULES, camoShade } from "@/lib/fog";
import {
  applyCamoAction,
  createCamoState,
  maskCamoState,
  NAME,
  type CamoAction,
  type CamoState,
} from "@/lib/camo-engine";
import { BrandMark } from "@/components/Brand";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/camo")({
  head: () => ({
    meta: [
      { title: "Camo Chess — One Hidden Bishop & Battleship Guesses" },
      {
        name: "description",
        content:
          "Two-player chess with one twist: each side's kingside bishop is camouflaged. Guess where it moved to strip its camouflage for good.",
      },
      { property: "og:title", content: "Camo Chess — One Hidden Bishop" },
      {
        property: "og:description",
        content:
          "Real chess rules, but your opponent's kingside bishop is invisible until you guess the square it moved to. Pass and play on one device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CamoChess,
});

const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];

function CamoChess() {
  const [game, setGame] = useState<CamoState>(() => createCamoState());
  const [viewer, setViewer] = useState<Color>("w");
  const [selected, setSelected] = useState<Sq | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const view = useMemo(() => maskCamoState(game, viewer), [game, viewer]);
  useCaptureToast(view.lost, viewer);

  const over = view.phase === "over";
  const handoff = !over && game.turn !== viewer;
  const mode: "move" | "guess" | "locked" = handoff
    ? "locked"
    : view.phase === "guess"
      ? "guess"
      : view.phase === "move"
        ? "move"
        : "locked";

  const moves = useMemo(
    () => (selected && mode === "move" ? (view.legal[key(selected)] ?? []) : []),
    [selected, mode, view],
  );

  function act(action: CamoAction) {
    const result = applyCamoAction(game, action, game.turn);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setSelected(null);
    setPending(null);
    setGame(result.state);
  }

  function reset() {
    setGame(createCamoState());
    setViewer("w");
    setSelected(null);
    setPending(null);
    setError(null);
  }

  function onSquare(sq: Sq) {
    if (handoff || over) return;

    if (mode === "guess") {
      act({ kind: "guess", sq });
      return;
    }

    const piece = view.board[sq.r]?.[sq.c];
    if (selected && moves.some((m) => same(m, sq))) {
      const mover = view.board[selected.r]![selected.c]!;
      if (mover.type === "p" && (sq.r === 0 || sq.r === 7)) {
        setPending({ from: selected, to: sq });
        return;
      }
      act({ kind: "move", from: selected, to: sq });
      return;
    }
    if (piece && piece.color === viewer) {
      setSelected(selected && same(selected, sq) ? null : sq);
    }
  }

  const enemyShade = camoShade(other(viewer));

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-3 py-4">
      <BrandMark />
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-torch">Wesley&apos;s</p>
        <h1 className="text-4xl text-foreground sm:text-5xl">Camo Chess</h1>
        <p className="mt-2 text-muted-foreground">
          Real chess rules — but each side&apos;s kingside bishop is hidden from the enemy.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "mx-auto flex w-fit max-w-full items-center justify-center rounded-xl border border-border bg-card px-5 py-2 text-center",
              mode === "guess" && "border-torch",
            )}
          >
            <span className="text-lg">
              {over
                ? "Game over"
                : handoff
                  ? "Pass the device"
                  : mode === "guess"
                    ? `${NAME[viewer]}: guess a ${enemyShade} square`
                    : `${NAME[game.turn]} to move`}
            </span>
          </div>

          <ChessBoard
            board={view.board}
            viewer={viewer}
            selected={selected}
            moves={moves}
            lastMove={view.lastMove}
            myCamo={view.myCamo}
            guesses={view.guesses}
            guessShade={mode === "guess" ? enemyShade : null}
            checkSq={view.check ? findKing(view.board, viewer) : null}
            mode={mode}
            onSquare={onSquare}
          />

          <CapturedBar lost={view.lost} viewer={viewer} />

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-torch">
              How the camouflage works
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {CAMO_RULES.map((r) => r.blurb).join(" ")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your own camouflaged bishop is marked with a 🌿. Your opponent&apos;s bishop hides on{" "}
              {enemyShade} squares — when they move it, you get one guess.
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
              <li>🌿 A leaf marks your own camouflaged bishop — only you can see it.</li>
              <li>👑 Your king pulses red in check, and he can never step into check.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-lg">Battle Log</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {view.log.map((line, i) => (
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

      {pending && (
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
                  onClick={() => act({ kind: "move", from: pending.from, to: pending.to, promoteTo: t })}
                  className="rounded-xl border border-border bg-background py-3 text-4xl hover:border-torch"
                  aria-label={PIECE_NAME[t]}
                >
                  {GLYPH[viewer][t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {handoff && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-deep">
            <div className="text-6xl">{game.turn === "w" ? "♔" : "♚"}</div>
            <h2 className="mt-4 text-3xl">Pass to {NAME[game.turn]}</h2>
            <p className="mt-2 text-muted-foreground">
              No peeking! Hand the device over, then tap below to see your own view of the board.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                setViewer(game.turn);
                setSelected(null);
              }}
            >
              I&apos;m {NAME[game.turn]} — show my board
            </Button>
          </div>
        </div>
      )}

      {over && view.winner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-deep">
            <div className="text-6xl">🏆</div>
            <h2 className="mt-4 text-3xl">{NAME[view.winner]} wins!</h2>
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
