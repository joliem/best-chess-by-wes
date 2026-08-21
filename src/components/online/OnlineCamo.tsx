import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChessBoard } from "@/components/chess/ChessBoard";
import { BattleLog } from "@/components/online/OnlineSwitcheroo";
import { GameOver, PromotionPicker } from "@/components/online/shell";
import { findKing, GLYPH, key, same, type Color, type PieceType, type Sq } from "@/lib/chess";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { emptyLost } from "@/lib/captures";
import { NAME, type CamoPublicState } from "@/lib/camo-engine";
import type { OnlineProps } from "@/components/online/types";
import { cn } from "@/lib/utils";

export function OnlineBattleship({ game, seat, sending, error, act, rematch }: OnlineProps) {
  const state = game.state as CamoPublicState;
  const viewer: Color = seat ?? "w";
  const myTurn = Boolean(seat && state.turn === seat && state.phase !== "over");

  const [selected, setSelected] = useState<Sq | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const seenNotice = useRef<number | null>(null);

  useEffect(() => {
    if (!state.notice || seenNotice.current === state.notice.id) return;
    seenNotice.current = state.notice.id;
    toast(state.notice.text, { icon: state.notice.text.includes("check") ? "⚔️" : "🎯" });
  }, [state.notice]);

  const mode: "move" | "guess" | "locked" = !myTurn
    ? "locked"
    : state.phase === "guess"
      ? "guess"
      : "move";

  const moves = useMemo(() => {
    if (!selected || mode !== "move") return [];
    return state.legal?.[key(selected)] ?? [];
  }, [state, selected, mode]);

  const lost = state.lost ?? emptyLost();
  useCaptureToast(lost, seat ?? null);
  const checkSq = state.check ? findKing(state.board, viewer) : null;

  async function move(from: Sq, to: Sq, promoteTo?: PieceType) {
    setSelected(null);
    setPending(null);
    await act({ kind: "move", from, to, ...(promoteTo ? { promoteTo } : {}) });
  }

  function onSquare(sq: Sq) {
    if (!myTurn || sending) return;

    if (mode === "guess") {
      if ((sq.r + sq.c) % 2 !== (state.guessColor === "light" ? 0 : 1)) return;
      void act({ kind: "guess", sq });
      return;
    }

    const piece = state.overlays[key(sq)] ?? state.board[sq.r]?.[sq.c];
    if (selected && moves.some((m) => same(m, sq))) {
      const moving = state.overlays[key(selected)] ?? state.board[selected.r]?.[selected.c];
      if (moving?.type === "p" && (sq.r === 0 || sq.r === 7)) {
        setPending({ from: selected, to: sq });
        return;
      }
      void move(selected, sq);
      return;
    }
    if (piece && piece.color === state.turn) {
      setSelected(selected && same(selected, sq) ? null : sq);
    }
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
                ? `${NAME[state.turn]}: guess the camouflaged bishop's ${state.guessColor} square`
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
          selected={selected}
          moves={moves}
          lastMove={state.lastMove}
          guesses={state.guesses}
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
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              🫥 Each player&apos;s kingside bishop is camouflaged on squares of its same color —
              White&apos;s is hidden on light squares; Black&apos;s is hidden on dark squares. It
              can&apos;t be captured normally, and an opponent piece can even land on its square
              without realizing it!
            </li>
            <li>
              🎯 If the hidden bishop moves without making a capture, the other player gets to guess
              its location. A correct guess captures the bishop; every guess leaves a red target on
              the board.
            </li>
            <li>
              ⚔️ A hidden bishop can&apos;t move onto an occupied square unless it captures an enemy
              piece. A capture reveals it for the rest of the game, so there is no location guess.
            </li>
            <li>
              💡 The hidden bishop can give check, but beware that doing so might give away its
              location!
            </li>
          </ul>
        </div>

        <BattleLog log={state.log} />
      </aside>

      {pending && (
        <PromotionPicker
          color={state.turn}
          glyph={GLYPH}
          onPick={(t) => void move(pending.from, pending.to, t)}
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
