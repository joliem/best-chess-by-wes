import type { Color } from "@/lib/chess";
import { COIN_HELP, type Chest, type CoinKind } from "@/lib/treasure";
import { cn } from "@/lib/utils";

const NAME: Record<Color, string> = { w: "White", b: "Black" };

/** A drawn treasure chest with the coins earned stacked beside it. */
export function TreasureChest({
  color,
  chest,
  active,
  onSpend,
}: {
  color: Color;
  chest: Chest;
  active: boolean;
  onSpend: (kind: CoinKind) => void;
}) {
  const mine = chest[color];
  const white = color === "w";

  const slot = (kind: CoinKind, i: number) => {
    const has = mine[kind] > i;
    const usable = has && active;
    return (
      <button
        key={`${kind}-${i}`}
        type="button"
        disabled={!usable}
        title={has ? COIN_HELP[kind] : "Empty slot"}
        onClick={() => onSpend(kind)}
        className={cn(
          "grid size-8 place-items-center rounded-full border-2 text-base transition",
          has
            ? kind === "gold"
              ? "border-torch bg-torch/30 shadow-glow"
              : "border-foreground/60 bg-foreground/25"
            : "border-dashed border-border/60 bg-transparent opacity-35",
          usable ? "cursor-pointer hover:scale-110" : "cursor-default",
        )}
      >
        {has ? (kind === "gold" ? "🪙" : "⚪") : ""}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border-2 px-3 py-2",
        white ? "border-piece-light/70 bg-piece-light/10" : "border-piece-dark bg-piece-dark/40",
        active && "shadow-glow",
      )}
    >
      <div className="w-24 shrink-0 select-none" aria-hidden>
        <svg viewBox="0 0 100 78" className="w-full drop-shadow-[0_4px_6px_oklch(0_0_0/0.5)]">
          {(() => {
            const shell = white ? "oklch(0.99 0.01 95)" : "oklch(0.22 0.03 250)";
            const shade = white ? "oklch(0.86 0.02 90)" : "oklch(0.15 0.02 250)";
            const iron = white ? "oklch(0.36 0.04 205)" : "oklch(0.62 0.03 240)";
            return (
              <g stroke={iron} strokeWidth={3} strokeLinejoin="round">
                <path d="M10 34 A40 30 0 0 1 90 34 Z" fill={shell} />
                <path
                  d="M10 34 A40 30 0 0 1 50 8 L50 34 Z"
                  fill={shade}
                  opacity={0.35}
                  stroke="none"
                />
                <rect x="6" y="34" width="88" height="9" rx="3" fill={shade} />
                <path d="M11 43 h78 v25 a4 4 0 0 1 -4 4 h-70 a4 4 0 0 1 -4 -4 Z" fill={shell} />
                <path d="M28 10.5 A40 30 0 0 0 22 34 M22 43 v29" fill="none" strokeWidth={5} />
                <path d="M72 10.5 A40 30 0 0 1 78 34 M78 43 v29" fill="none" strokeWidth={5} />
                <rect
                  x="44"
                  y="36"
                  width="12"
                  height="16"
                  rx="2"
                  fill="oklch(0.82 0.16 74)"
                  strokeWidth={2.5}
                />
                <circle cx="50" cy="45" r="2.4" fill={iron} stroke="none" />
              </g>
            );
          })()}
        </svg>
        <p
          className={cn(
            "mt-1 text-center text-[11px] leading-tight",
            white ? "text-piece-light" : "text-foreground/80",
          )}
        >
          {NAME[color]}&apos;s chest
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <span className="w-10 text-[10px] uppercase tracking-wider text-muted-foreground">
            Gold
          </span>
          {[0, 1, 2].map((i) => slot("gold", i))}
        </div>
        <div className="flex items-center gap-1">
          <span className="w-10 text-[10px] uppercase tracking-wider text-muted-foreground">
            Silver
          </span>
          {[0, 1, 2].map((i) => slot("silver", i))}
        </div>
      </div>

      {active && (
        <span className="ml-auto text-xs text-muted-foreground">Click a coin to spend it</span>
      )}
    </div>
  );
}
