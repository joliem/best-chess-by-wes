import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import type { Color, PieceType } from "@/lib/chess";

const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];

export function PromotionPicker({
  color,
  glyph,
  onPick,
}: {
  color: Color;
  glyph: Record<Color, Record<PieceType, string>>;
  onPick: (t: PieceType) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-4">
      <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-deep">
        <h2 className="text-2xl">Promote the pawn</h2>
        <div className="mt-4 flex justify-center gap-2">
          {PROMOTIONS.map((t) => (
            <button
              key={t}
              type="button"
              className="rounded-xl border border-border px-4 py-2 text-4xl hover:border-torch"
              onClick={() => onPick(t)}
            >
              {glyph[color][t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GameOver({
  emoji,
  title,
  detail,
  canRematch,
  onRematch,
}: {
  emoji: string;
  title: string;
  detail?: string;
  canRematch: boolean;
  onRematch: () => void | Promise<void>;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <div className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-torch/60 bg-card/95 px-4 py-3 text-center shadow-deep backdrop-blur">
        <span className="text-3xl">{emoji}</span>
        <div className="text-left">
          <h2 className="text-2xl leading-tight">{title}</h2>
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
          <p className="text-xs text-muted-foreground">
            The final move is highlighted on the board below.
          </p>
        </div>
        {canRematch && (
          <Button size="sm" onClick={() => void onRematch()}>
            Rematch
          </Button>
        )}
        <Link to="/" className="text-sm text-torch underline">
          All variants
        </Link>
      </div>
    </div>
  );
}
