import { useEffect, useMemo, useRef, useState } from "react";

import { TreasureBoard, type CoinReveal } from "@/components/chess/TreasureBoard";
import { CoinIcon, CoinPileIcon } from "@/components/CoinIcon";
import { TreasureChest } from "@/components/chess/TreasureChest";
import { BattleLog } from "@/components/online/OnlineSwitcheroo";
import { GameOver, PromotionPicker } from "@/components/online/shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  findKing,
  GLYPH,
  other,
  safeMoves,
  same,
  type Color,
  type PieceType,
  type Sq,
} from "@/lib/chess";
import { lostFromBoard } from "@/lib/captures";
import { CapturedBar } from "@/components/chess/CapturedBar";
import { useCaptureToast } from "@/hooks/useCaptureToast";
import { NAME, treasureScore, type TreasurePublicState } from "@/lib/treasure-engine";
import type { CoinKind } from "@/lib/treasure";
import type { OnlineProps } from "@/components/online/types";
import { cn } from "@/lib/utils";

export function OnlineTreasure({ game, seat, sending, error, act, rematch }: OnlineProps) {
  const state = game.state as TreasurePublicState;
  const viewer: Color = seat ?? "w";
  const myTurn = Boolean(seat && state.turn === seat && state.phase !== "over");

  const [selected, setSelected] = useState<Sq | null>(null);
  const [pending, setPending] = useState<{ from: Sq; to: Sq } | null>(null);
  const [showEmptyMarks, setShowEmptyMarks] = useState(true);
  const [reveal, setReveal] = useState<CoinReveal | null>(null);
  const lastReveal = useRef<number | null>(null);

  // Play the coin-flip animation on both devices when the server reports one.
  useEffect(() => {
    const r = state.reveal;
    if (!r || lastReveal.current === r.ply) return;
    lastReveal.current = r.ply;
    setReveal({ sq: r.sq, gold: r.gold, silver: r.silver, nonce: r.ply });
    const timer = window.setTimeout(() => setReveal(null), 1600);
    return () => window.clearTimeout(timer);
  }, [state.reveal]);

  const shieldedIds = state.shields.map((s) => s.id);
  const emptyKnown = useMemo(() => new Set(state.emptyKnown), [state.emptyKnown]);

  const moves = useMemo(() => {
    if (!selected || !myTurn || state.phase !== "move") return [];
    const piece = state.board[selected.r]?.[selected.c];
    if (!piece || piece.color !== state.turn) return [];
    return safeMoves(state.board, selected, state.epTarget, state.gold, shieldedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selected, myTurn]);

  const pickable = useMemo(() => {
    if (state.phase !== "pick" || !myTurn) return null;
    const list: Sq[] = [];
    state.board.forEach((row, r) =>
      row.forEach((piece, c) => {
        if (piece && piece.color === state.turn && piece.type !== "k") list.push({ r, c });
      }),
    );
    return list;
  }, [state, myTurn]);

  async function move(from: Sq, to: Sq, promoteTo?: PieceType) {
    setSelected(null);
    setPending(null);
    await act({ kind: "move", from, to, ...(promoteTo ? { promoteTo } : {}) });
  }

  function onSquare(sq: Sq) {
    if (!myTurn || sending) return;

    if (state.phase === "pick") {
      void act({ kind: "pick", sq });
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

  const lost = useMemo(() => lostFromBoard(state.board), [state.board]);
  useCaptureToast(lost, seat ?? null);
  const checkSq = state.check ? findKing(state.board, state.check) : null;

  const myScore = treasureScore(state.chest, viewer);
  const theirScore = treasureScore(state.chest, other(viewer));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border-2 border-border bg-card/70 shadow-glow">
          <TreasureChest
            color="w"
            chest={state.chest}
            active={viewer === "w" && myTurn && state.phase === "move"}
            onSpend={(coin: CoinKind) => void act({ kind: "spend", coin })}
          />
          <TreasureChest
            color="b"
            chest={state.chest}
            active={viewer === "b" && myTurn && state.phase === "move"}
            onSpend={(coin: CoinKind) => void act({ kind: "spend", coin })}
          />
        </div>

        <div
          className={cn(
            "mx-auto flex w-fit max-w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-2 text-center",
            state.check === state.turn && "border-destructive",
          )}
        >
          <span className="text-lg">
            {state.phase === "over"
              ? "Game over"
              : state.phase === "pick"
                ? `${NAME[state.turn]} is choosing a piece for the ${state.pendingCoin} coin…`
                : `${NAME[state.turn]} to move${state.check === state.turn ? " — CHECK!" : ""}`}
          </span>
          <span className="text-sm text-muted-foreground">
            {myTurn ? "Your turn" : state.phase === "over" ? "" : "Their turn"}
          </span>
        </div>

        <TreasureBoard
          board={state.board}
          viewer={viewer}
          selected={selected}
          moves={moves}
          lastMove={state.lastMove}
          shieldedIds={shieldedIds}
          goldId={state.gold?.id ?? null}
          emptyKnown={emptyKnown}
          showEmptyMarks={showEmptyMarks}
          pickable={pickable}
          reveal={reveal}
          checkSq={checkSq}
          onSquare={onSquare}
        />

        <CapturedBar lost={lost} viewer={seat ?? null} />
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-lg">How Treasure Chess works</h2>
          <ul className="space-y-2 text-sm text-muted-foreground [&>li]:grid [&>li]:grid-cols-[1.25rem_minmax(0,1fr)] [&>li]:items-start [&>li]:gap-2">
            <li>
              <CoinPileIcon className="h-5 w-5" />
              <span>Three gold and three silver coins hide on the middle four ranks.</span>
            </li>
            <li>
              <span>🎁</span>
              <span>Land on a square and you scoop up every coin hidden there.</span>
            </li>
            <li>
              <span>⚪</span>
              <span>Spend a silver coin: one piece is untouchable for 2 enemy moves.</span>
            </li>
            <li>
              <CoinIcon className="mt-0.5 h-4 w-4" />
              <span>
                Gold: spend your whole move to give a piece (not your king) Queen powers through
                your following move. It attacks like a Queen the moment it&apos;s chosen, can move
                and capture like one through your next move, then reverts.
              </span>
            </li>
            <li>
              <span className="grid size-5 place-items-center rounded-full border border-torch/70 text-base leading-none text-torch">
                ♛
              </span>
              <span>
                A stalemate is decided by remaining treasure stockpiles (1 gold coin = 2 silver
                coins), and only ends in a draw if stockpiles are equal.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Switch id="marks" checked={showEmptyMarks} onCheckedChange={setShowEmptyMarks} />
          <label htmlFor="marks" className="text-sm">
            Show red ✗ on empty squares{" "}
            <span className={showEmptyMarks ? "text-torch" : "text-muted-foreground"}>
              {showEmptyMarks ? "· ON" : "· OFF"}
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p>
            Your treasure: <strong>{myScore}</strong> · Theirs: <strong>{theirScore}</strong>
          </p>
          {seat && state.phase !== "over" && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => void act({ kind: "draw" })}
            >
              Agree to a draw
            </Button>
          )}
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
          emoji={state.winner === "tie" ? "🤝" : "🏆"}
          title={state.winner === "tie" ? "A perfect tie!" : `${NAME[state.winner]} wins!`}
          {...(state.drawByTreasure
            ? {
                detail: `Treasure decided it — White ${treasureScore(state.chest, "w")} vs Black ${treasureScore(
                  state.chest,
                  "b",
                )}.`,
              }
            : {})}
          canRematch={!!seat}
          onRematch={async () => {
            lastReveal.current = null;
            await rematch();
          }}
        />
      )}
    </div>
  );
}
