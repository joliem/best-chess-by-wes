import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/Brand";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { ChessBoard, MissMarkerIcon } from "@/components/chess/ChessBoard";
import { Button } from "@/components/ui/button";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { applyCamoAction, createCamoState, maskCamoState, NAME } from "@/lib/camo-engine";
import { findKing, GLYPH, key, same, type PieceType, type Sq } from "@/lib/chess";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/battleship")({
  head: () => ({
    meta: [
      { title: "Battleship Bishop — Hidden-Piece Chess" },
      {
        name: "description",
        content:
          "Hunt an intangible hidden bishop with Battleship-style target guesses while playing by regular chess rules.",
      },
      { property: "og:title", content: "Battleship Bishop — Hidden-Piece Chess" },
      {
        property: "og:description",
        content:
          "A hidden-bishop chess variant with overlapping pieces, target guesses and surprise checks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BattleshipBishop,
});
const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];
type Selection = { sq: Sq; hidden: boolean };

function BattleshipBishop() {
  const [state, setState] = useState(createCamoState);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const [handoff, setHandoff] = useState(false);
  const seenNotice = useRef<number | null>(null);
  const publicState = useMemo(() => maskCamoState(state, state.turn), [state]);
  const moves = selected
    ? selected.hidden
      ? publicState.hiddenLegal
      : (publicState.legal[key(selected.sq)] ?? [])
    : [];
  useCaptureToast(publicState.lost);
  useEffect(() => {
    if (handoff || !publicState.notice || seenNotice.current === publicState.notice.id) return;
    seenNotice.current = publicState.notice.id;
    toast(publicState.notice.text, {
      icon: publicState.notice.text.includes("check") ? "⚔️" : "🎯",
      duration: 4200,
    });
  }, [handoff, publicState.notice]);
  function reset() {
    setState(createCamoState());
    setSelected(null);
    setPending(null);
    setHandoff(false);
    seenNotice.current = null;
  }
  function move(from: Sq, to: Sq, hidden = false, promoteTo?: PieceType) {
    const outcome = applyCamoAction(
      state,
      {
        kind: "move",
        from,
        to,
        ...(hidden ? { hidden: true } : {}),
        ...(promoteTo ? { promoteTo } : {}),
      },
      state.turn,
    );
    if (!outcome.ok) return;
    setState(outcome.state);
    setSelected(null);
    setPending(null);
    if (outcome.state.phase !== "over") setHandoff(true);
  }
  function onSquare(sq: Sq) {
    if (handoff || state.phase === "over") return;
    if (state.phase === "guess") {
      if ((sq.r + sq.c) % 2 !== (publicState.guessColor === "light" ? 0 : 1)) return;
      const outcome = applyCamoAction(state, { kind: "guess", sq }, state.turn);
      if (outcome.ok) setState(outcome.state);
      return;
    }
    if (selected && moves.some((candidate) => same(candidate, sq))) {
      const moving = selected.hidden
        ? publicState.overlays[key(selected.sq)]
        : publicState.board[selected.sq.r]?.[selected.sq.c];
      if (moving?.type === "p" && (sq.r === 0 || sq.r === 7)) {
        setPending({ from: selected.sq, to: sq });
        return;
      }
      move(selected.sq, sq, selected.hidden);
      return;
    }
    const overlay = publicState.overlays[key(sq)];
    const piece = publicState.board[sq.r]?.[sq.c];
    if (overlay?.color === state.turn && piece?.color === state.turn) {
      setSelected(
        selected && same(selected.sq, sq)
          ? { sq, hidden: !selected.hidden }
          : { sq, hidden: false },
      );
    } else if (overlay?.color === state.turn) setSelected({ sq, hidden: true });
    else if (piece?.color === state.turn) setSelected({ sq, hidden: false });
  }
  const mode = state.phase === "guess" ? "guess" : state.phase === "move" ? "move" : "locked";
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-3 py-4">
      <BrandMark />
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-torch">Wesley&apos;s</p>
        <h1 className="text-4xl text-foreground sm:text-5xl">Battleship Bishop</h1>
        <p className="mt-2 text-muted-foreground">
          Beware of an enemy bishop hidden under squares of the same color.
        </p>
        <Link to="/" className="mt-1 inline-block text-xs text-torch underline">
          ← All variants
        </Link>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "mx-auto rounded-xl border border-border bg-card px-5 py-2 text-center",
              state.phase === "guess" && "border-torch",
            )}
          >
            <span className="text-lg">
              {state.phase === "over"
                ? "Game over"
                : state.phase === "guess"
                  ? `${NAME[state.turn]} to target one ${publicState.guessColor} square`
                  : `${NAME[state.turn]} to move`}
            </span>
          </div>
          <ChessBoard
            board={publicState.board}
            overlays={publicState.overlays}
            viewer={state.turn}
            revealed={[]}
            showAll={state.phase === "over"}
            selected={selected?.sq ?? null}
            moves={moves}
            lastMove={publicState.lastMove}
            guesses={publicState.guesses}
            checkSq={
              publicState.checkColor ? findKing(publicState.board, publicState.checkColor) : null
            }
            mode={mode}
            onSquare={onSquare}
          />
          <CapturedBar lost={publicState.lost} />
        </div>
        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-lg">How Battleship Bishop works</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                🫥 Each player&apos;s kingside bishop is camouflaged on squares of its same color —
                White&apos;s is hidden on light squares; Black&apos;s is hidden on dark squares. The
                hidden bishop can&apos;t be captured in the regular way, and another piece can even
                land on the square where it&apos;s hiding.
              </li>
              <li>
                🎯 If the hidden bishop moves without making a capture, the other player gets to
                guess its location, battleship-style! If they guess correctly, they capture the
                bishop.
              </li>
              <li className="flex gap-2">
                <MissMarkerIcon className="mt-0.5" />
                <span>
                  A hidden bishop can&apos;t move onto an occupied square unless it&apos;s capturing
                  an opponent piece, but then it reveals itself for the rest of the game.
                </span>
              </li>
              <li>
                ✓ The hidden bishop can give check, but only on a move by itself or one of its own
                army pieces.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-lg">Battle Log</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {publicState.log.map((line, index) => (
                <li key={`${index}-${line}`} className={index === 0 ? "text-foreground" : ""}>
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
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-deep">
            <h2 className="text-2xl">Promote the pawn</h2>
            <div className="mt-4 flex gap-2">
              {PROMOTIONS.map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  onClick={() => move(pending.from, pending.to, false, type)}
                >
                  {GLYPH[state.turn][type]}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
      {handoff && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-deep">
            <div className="text-6xl">{state.turn === "w" ? "♔" : "♚"}</div>
            <h2 className="mt-4 text-3xl">Pass to {NAME[state.turn]}</h2>
            <p className="mt-2 text-muted-foreground">
              No peeking! Hand over the device before revealing the next player&apos;s board.
            </p>
            <Button className="mt-6 w-full" onClick={() => setHandoff(false)}>
              I&apos;m {NAME[state.turn]} — show my board
            </Button>
          </div>
        </div>
      )}
      {state.phase === "over" && state.winner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-deep">
            <div className="text-6xl">🏆</div>
            <h2 className="mt-4 text-3xl">{NAME[state.winner]} wins!</h2>
            <Button className="mt-6" onClick={reset}>
              Play Again
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
