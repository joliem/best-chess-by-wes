import { useEffect, useMemo, useRef, useState } from "react";

import { SwitcherooBoard } from "@/components/chess/SwitcherooBoard";
import { findKing, GLYPH, safeMoves, same, type Color, type PieceType, type Sq } from "@/lib/chess";
import { lostFromBoard } from "@/lib/captures";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { COLOR_NAME, moverOf, type SwitcherooState } from "@/lib/switcheroo";
import { cn } from "@/lib/utils";
import type { OnlineProps } from "@/components/online/types";
import { GameOver, PromotionPicker } from "@/components/online/shell";

export function OnlineSwitcheroo({ game, seat, sending, error, act, rematch }: OnlineProps) {
  const state = game.state as SwitcherooState;
  const [selected, setSelected] = useState<Sq | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const lastSpin = useRef<number | null>(null);

  useEffect(() => {
    if (state.spunAtPly === null) return;
    if (lastSpin.current === state.spunAtPly) return;
    lastSpin.current = state.spunAtPly;
    if (state.spunAtPly !== state.ply) return;
    setSpinning(true);
    const timer = window.setTimeout(() => setSpinning(false), 1200);
    return () => window.clearTimeout(timer);
  }, [state.spunAtPly, state.ply]);

  const viewer: Color = seat ?? "w";
  const mover = moverOf(state);
  const myTurn = Boolean(seat && state.controller === seat && state.phase === "move");

  const moves = useMemo(() => {
    if (!selected || !myTurn) return [];
    const piece = state.board[selected.r]?.[selected.c];
    if (!piece || piece.color !== mover) return [];
    return safeMoves(state.board, selected, state.epTarget);
  }, [state, selected, myTurn, mover]);

  async function move(from: Sq, to: Sq, promoteTo?: PieceType) {
    setSelected(null);
    setPending(null);
    await act({ kind: "move", from, to, ...(promoteTo ? { promoteTo } : {}) });
  }

  function onSquare(sq: Sq) {
    if (!myTurn || sending) return;
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
    if (piece && piece.color === mover) {
      setSelected(selected && same(selected, sq) ? null : sq);
    }
  }

  const lost = useMemo(() => lostFromBoard(state.board), [state.board]);
  useCaptureToast(lost, seat ?? null);
  const checkSq = state.check ? findKing(state.board, state.check) : null;

  const swapped = state.swapLeft > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            "mx-auto flex w-fit max-w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-2 text-center",
            swapped && "border-[oklch(0.6_0.18_300)] animate-pulse-glow",
            state.check === mover && "border-destructive",
          )}
        >
          <span className="text-lg">
            {state.phase === "over"
              ? "Game over"
              : swapped
                ? `🌀 ${COLOR_NAME[state.controller]} is playing ${COLOR_NAME[mover]}'s pieces!${
                    state.check === mover ? ` — ${COLOR_NAME[mover]} is in CHECK!` : ""
                  }`
                : `${COLOR_NAME[state.controller]} to move${state.check === mover ? " — CHECK!" : ""}`}
          </span>
          <span className="text-sm text-muted-foreground">
            {myTurn ? "Your move" : state.phase === "over" ? "" : "Their move"}
          </span>
        </div>


        <SwitcherooBoard
          board={state.board}
          viewer={viewer}
          mover={mover}
          selected={selected}
          moves={moves}
          lastMove={state.lastMove}
          swapped={swapped}
          spinning={spinning}
          checkSq={checkSq}
          onSquare={onSquare}
        />
        <CapturedBar lost={lost} viewer={seat ?? null} />
        {selected && myTurn && moves.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            That piece has no legal moves right now
            {state.check === mover
              ? ` — ${COLOR_NAME[mover]} is in check, so only moves that stop the check are allowed.`
              : " — it's pinned to its own king."}
          </p>
        )}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>


      <aside className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-lg">How Switcheroo Chess works</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>♟️ Standard chess rules.</li>
            <li>
              🌀 Before any move there&apos;s a 1-in-10 chance the board spins into switcheroo mode.
              The server rolls the dice, so nobody can cheat it.
            </li>
            <li>
              💜 While the squares are purple &amp; green you move your <em>opponent&apos;s</em>{" "}
              pieces.
            </li>
            <li>
              🔁 Then they get one move with <em>your</em> pieces before control snaps back to
              normal.
            </li>
          </ul>
        </div>

        <BattleLog log={state.log} />
      </aside>

      {pending && (
        <PromotionPicker
          color={mover}
          glyph={GLYPH}
          onPick={(t) => void move(pending.from, pending.to, t)}
        />
      )}

      {state.phase === "over" && state.winner !== null && (
        <GameOver
          emoji={state.winner === "tie" ? "🤝" : "🏆"}
          title={state.winner === "tie" ? "Stalemate!" : `${COLOR_NAME[state.winner]} wins!`}
          canRematch={!!seat}
          onRematch={async () => {
            lastSpin.current = null;
            await rematch();
          }}
        />
      )}
    </div>
  );
}

export function BattleLog({ log }: { log: string[] }) {
  return (
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
  );
}
