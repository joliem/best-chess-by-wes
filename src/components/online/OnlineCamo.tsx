import { useMemo, useState } from "react";

import { ChessBoard } from "@/components/chess/ChessBoard";
import { BattleLog } from "@/components/online/OnlineSwitcheroo";
import { GameOver, PromotionPicker } from "@/components/online/shell";
import { findKing, GLYPH, key, same, type Color, type PieceType, type Sq } from "@/lib/chess";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { emptyLost } from "@/lib/captures";
import { NAME, type CamoPublicState } from "@/lib/camo-engine";
import { canScout, CAMO_RULES } from "@/lib/fog";
import type { OnlineProps } from "@/components/online/types";
import { cn } from "@/lib/utils";

export function OnlineCamo({ game, seat, sending, error, act, rematch }: OnlineProps) {
  const state = game.state as CamoPublicState;
  const viewer: Color = seat ?? "w";
  const myTurn = Boolean(seat && state.turn === seat && state.phase !== "over");

  const [selected, setSelected] = useState<Sq | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);

  const mode: "move" | "guess" | "locked" = !myTurn
    ? "locked"
    : state.phase === "guess"
      ? "guess"
      : "move";

  // The server sends the true legal moves, so blocked rays and available
  // captures can betray a hidden enemy piece.
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
      if (!canScout(sq, viewer, state.revealed)) return;
      void act({ kind: "guess", sq });
      return;
    }

    const piece = state.board[sq.r]?.[sq.c];
    if (selected && moves.some((m) => same(m, sq))) {
      const moving = state.board[selected.r]?.[selected.c];
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
                ? `${NAME[state.turn]}: unhide one ${state.turn === "w" ? "dark" : "light"} square`
                : `${NAME[state.turn]} to move`}
          </span>
          <span className="text-sm text-muted-foreground">
            {myTurn ? "Your turn" : state.phase === "over" ? "" : "Their turn"}
          </span>
        </div>

        <ChessBoard
          board={state.board}
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

        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-torch">How the camouflage works</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {CAMO_RULES.map((r) => r.blurb).join(" ")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tap one of your opponent&apos;s {viewer === "w" ? "dark" : "light"} squares to unhide it
            forever — unhidden squares are marked with a red ✕.
          </p>
        </div>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-lg">Rules in effect</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {CAMO_RULES.map((r) => (
              <li key={r.name}>
                <strong className="text-foreground">{r.name}:</strong> {r.blurb}
              </li>
            ))}
            <li>
              ❌ A red ✕ marks a square whose camouflage is gone. Both players see the same ✕ marks.
            </li>
            <li>
              👑 Your own king pulses red when he is in check, and he may never step into check.
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
          detail="The losing king ran out of cover — his camouflage could not save him."
          canRematch={!!seat}
          onRematch={() => void rematch()}
        />
      )}
    </div>
  );
}
