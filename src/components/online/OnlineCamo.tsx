import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChessBoard, MissMarkerIcon } from "@/components/chess/ChessBoard";
import { BattleLog } from "@/components/online/OnlineSwitcheroo";
import { GameOver, PromotionPicker } from "@/components/online/shell";
import { findKing, GLYPH, key, same, type Color, type PieceType, type Sq } from "@/lib/chess";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { emptyLost } from "@/lib/captures";
import { NAME, type CamoPublicState, type GuessRecord } from "@/lib/camo-engine";
import type { OnlineProps } from "@/components/online/types";
import { cn } from "@/lib/utils";
type Selection = { sq: Sq; hidden: boolean };

export function OnlineBattleship({ game, seat, sending, error, act, rematch }: OnlineProps) {
  const state = game.state as CamoPublicState;
  const viewer: Color = seat ?? "w";
  const myTurn = Boolean(seat && state.turn === seat && state.phase !== "over");

  const [selected, setSelected] = useState<Selection | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const [guessReveal, setGuessReveal] = useState<GuessRecord | null>(null);
  const seenNotice = useRef<number | null>(null);
  const latestGuess = state.guesses.at(-1);

  useEffect(() => {
    if (!state.notice || seenNotice.current === state.notice.id) return;
    seenNotice.current = state.notice.id;
    toast(state.notice.text, {
      icon: state.notice.text.includes("check") ? "⚔️" : "🎯",
      duration: 4200,
    });
  }, [state.notice]);
  useEffect(() => {
    if (!latestGuess) return;
    setGuessReveal(latestGuess);
    const timer = window.setTimeout(() => setGuessReveal(null), 4200);
    return () => window.clearTimeout(timer);
    // Only a new guess should restart the reveal; later realtime updates must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestGuess?.id]);

  const mode: "move" | "guess" | "locked" = !myTurn
    ? "locked"
    : state.phase === "guess"
      ? "guess"
      : "move";

  const moves = useMemo(() => {
    if (!selected || mode !== "move") return [];
    return selected.hidden ? state.hiddenLegal : (state.legal?.[key(selected.sq)] ?? []);
  }, [state, selected, mode]);

  const lost = state.lost ?? emptyLost();
  useCaptureToast(lost, seat ?? null);
  const checkSq = state.checkColor ? findKing(state.board, state.checkColor) : null;

  async function move(from: Sq, to: Sq, hidden = false, promoteTo?: PieceType) {
    setSelected(null);
    setPending(null);
    await act({
      kind: "move",
      from,
      to,
      ...(hidden ? { hidden: true } : {}),
      ...(promoteTo ? { promoteTo } : {}),
    });
  }

  function onSquare(sq: Sq) {
    if (!myTurn || sending) return;

    if (mode === "guess") {
      if ((sq.r + sq.c) % 2 !== (state.guessColor === "light" ? 0 : 1)) return;
      void act({ kind: "guess", sq });
      return;
    }

    if (selected && moves.some((m) => same(m, sq))) {
      const moving = selected.hidden
        ? state.overlays[key(selected.sq)]
        : state.board[selected.sq.r]?.[selected.sq.c];
      if (moving?.type === "p" && (sq.r === 0 || sq.r === 7)) {
        setPending({ from: selected.sq, to: sq });
        return;
      }
      void move(selected.sq, sq, selected.hidden);
      return;
    }
    const overlay = state.overlays[key(sq)];
    const piece = state.board[sq.r]?.[sq.c];
    if (overlay?.color === state.turn && piece?.color === state.turn)
      setSelected(
        selected && same(selected.sq, sq)
          ? { sq, hidden: !selected.hidden }
          : { sq, hidden: false },
      );
    else if (overlay?.color === state.turn) setSelected({ sq, hidden: true });
    else if (piece?.color === state.turn) setSelected({ sq, hidden: false });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            "mx-auto flex w-fit max-w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-2 text-center",
            mode === "guess" && "border-torch",
          )}
        >
          <span className="text-lg">
            {state.phase === "over"
              ? "Game over"
              : state.phase === "guess"
                ? `${NAME[state.turn]} to target one ${state.guessColor} square`
                : `${NAME[state.turn]} to move`}
          </span>
          <span className="text-sm text-muted-foreground">
            {myTurn ? "Your turn" : state.phase === "over" ? "" : "Their turn"}
          </span>
        </div>

        <ChessBoard
          board={state.board}
          overlays={state.overlays}
          viewer={viewer}
          revealed={state.revealed}
          showAll={state.phase === "over"}
          selected={selected?.sq ?? null}
          moves={moves}
          lastMove={state.lastMove}
          guesses={state.guesses}
          guessReveal={guessReveal}
          checkSq={checkSq}
          mode={mode}
          onSquare={onSquare}
        />

        <CapturedBar lost={lost} viewer={seat ?? null} />

        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-lg">How Battleship Bishop works</h2>
          <ul className="space-y-3 text-sm text-muted-foreground [&>li]:grid [&>li]:grid-cols-[1.25rem_minmax(0,1fr)] [&>li]:items-start [&>li]:gap-2">
            <li>
              <span>🫥</span>
              <span>
                Each player&apos;s kingside bishop is camouflaged on squares of its same color —
                White&apos;s is hidden on light squares; Black&apos;s is hidden on dark squares. The
                hidden bishop can&apos;t be captured in the regular way, and another piece of either
                color can even land on the square where it&apos;s hiding.
              </span>
            </li>
            <li>
              <span>🎯</span>
              <span>
                If the hidden bishop moves without making a capture, the other player gets to guess
                its location, battleship-style! If they guess correctly, they capture the bishop.
              </span>
            </li>
            <li>
              <MissMarkerIcon className="mt-0.5" />
              <span>
                A hidden bishop can&apos;t move onto an occupied square unless it captures an enemy
                piece. A capture reveals it for the rest of the game, so there is no location guess.
              </span>
            </li>
            <li>
              <span>✓</span>
              <span>
                The hidden bishop can give check, but only on a move by itself or one of its own
                army pieces.
              </span>
            </li>
          </ul>
        </div>

        <BattleLog log={state.log} />
      </aside>

      {pending && (
        <PromotionPicker
          color={state.turn}
          glyph={GLYPH}
          onPick={(t) => void move(pending.from, pending.to, false, t)}
        />
      )}

      {state.phase === "over" && state.winner !== null && (
        <GameOver
          emoji="🏆"
          title={`${NAME[state.winner]} wins!`}
          detail="The enemy fleet has no legal escape."
          canRematch={!!seat}
          onRematch={() => void rematch()}
        />
      )}
    </div>
  );
}
