import {
  FILES,
  GLYPH,
  key,
  same,
  sqName,
  type Board as BoardType,
  type Color,
  type Sq,
} from "@/lib/chess";
import { cn } from "@/lib/utils";
import { CheckHaze } from "@/components/chess/ChessBoard";

export type CoinReveal = { sq: Sq; gold: number; silver: number; nonce: number };

type Props = {
  board: BoardType;
  viewer: Color;
  selected: Sq | null;
  moves: Sq[];
  lastMove: { from: Sq; to: Sq } | null;
  /** piece ids that are currently shielded / queen-powered */
  shieldedIds: string[];
  goldId: string | null;
  /** squares proven to hold no coins */
  emptyKnown: Set<string>;
  showEmptyMarks: boolean;
  /** when picking a piece for a coin, only these squares are clickable */
  pickable: Sq[] | null;
  /** square holding a king that is currently in check */
  checkSq?: Sq | null;
  /** square currently playing the treasure-reveal animation */
  reveal: CoinReveal | null;
  onSquare: (sq: Sq) => void;
};

export function TreasureBoard({
  board,
  viewer,
  selected,
  moves,
  lastMove,
  shieldedIds,
  goldId,
  emptyKnown,
  showEmptyMarks,
  pickable,
  reveal,
  checkSq = null,
  onSquare,
}: Props) {
  const moveSet = new Set(moves.map(key));
  const pickSet = pickable ? new Set(pickable.map(key)) : null;
  const rows = viewer === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = viewer === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div className="mx-auto w-full max-w-[min(100%,74vh)] rounded-2xl border-4 border-frame bg-frame/25 p-1.5 shadow-deep sm:p-2">
      <div className="grid grid-cols-8 overflow-hidden rounded-lg [perspective:800px]">
        {rows.map((r) =>
          cols.map((c) => {
            const sq = { r, c };
            const k = key(sq);
            const dark = (r + c) % 2 === 1;
            const piece = board[r]![c];
            const isMove = !pickSet && moveSet.has(k);
            const isSelected = selected ? same(selected, sq) : false;
            const canPick = pickSet ? pickSet.has(k) : false;
            const clickable = pickSet ? canPick : isMove || piece?.color === viewer;
            const shielded = !!piece && shieldedIds.includes(piece.id);
            const crowned = !!piece && goldId === piece.id;
            const revealing = reveal && same(reveal.sq, sq) ? reveal : null;

            return (
              <button
                key={k}
                type="button"
                disabled={!clickable}
                onClick={() => onSquare(sq)}
                aria-label={`${sqName(sq)}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                className={cn(
                  "@container relative aspect-square select-none",
                  dark ? "bg-stone-dark" : "bg-stone-light",
                  clickable ? "cursor-pointer hover:brightness-125" : "cursor-default",
                  isSelected && "ring-4 ring-inset ring-torch",
                  canPick && "ring-4 ring-inset ring-jade",
                  revealing && "animate-coin-flip z-20",
                )}
              >
                <span className="pointer-events-none absolute left-1 top-0.5 text-[8px] font-semibold text-piece-dark/45">
                  {r === (viewer === "w" ? 7 : 0) ? FILES[c] : ""}
                  {c === (viewer === "w" ? 0 : 7) ? 8 - r : ""}
                </span>

                {lastMove && (same(lastMove.to, sq) || same(lastMove.from, sq)) && (
                  <span className="pointer-events-none absolute inset-0 bg-torch/20" />
                )}

                {showEmptyMarks && emptyKnown.has(k) && (
                  <span className="pointer-events-none absolute right-0.5 top-0 text-[10px] font-bold leading-none text-destructive">
                    ✕
                  </span>
                )}

                {piece && (
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-0 grid place-items-center leading-none",
                      piece.type === "p"
                        ? "-translate-y-[3%] text-[62cqmin]"
                        : piece.type === "r"
                          ? "-translate-y-[8%] text-[73cqmin]"
                          : "-translate-y-[8%] text-[78cqmin]",
                      piece.color === "w"
                        ? "text-piece-light [text-shadow:0_0_1px_oklch(0.2_0.03_250),0_1px_2px_oklch(0_0_0/0.55),0_0_3px_oklch(0.2_0.03_250)]"
                        : "text-piece-dark [text-shadow:0_0_1px_oklch(1_0_0/0.85),0_1px_2px_oklch(1_0_0/0.5)]",
                    )}
                  >
                    {GLYPH[piece.color][piece.type]}
                  </span>
                )}
                {checkSq && same(checkSq, sq) && <CheckHaze />}

                {/* temporary-power badges float above the square */}
                {crowned && (
                  <span
                    title="Queen powers this turn"
                    className="animate-badge-bob pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/3 text-[34cqmin] leading-none text-torch"
                  >
                    👑
                  </span>
                )}
                {shielded && !crowned && (
                  <span
                    title="Invincible — cannot be captured"
                    className="animate-badge-bob pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/3 text-[34cqmin] leading-none text-jade"
                  >
                    🛡️
                  </span>
                )}

                {isMove && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span
                      className={cn(
                        "rounded-full bg-torch/80 shadow-glow",
                        piece ? "size-full opacity-25" : "size-3 sm:size-4",
                      )}
                    />
                  </span>
                )}

                {revealing && (
                  <span className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
                    <span className="absolute inset-0 bg-torch/35" />
                    <span className="relative flex gap-0.5 text-[34cqmin] leading-none">
                      {Array.from({ length: revealing.gold }).map((_, i) => (
                        <span
                          key={`g${i}`}
                          className="animate-coin-pop"
                          style={{ animationDelay: `${i * 0.12}s` }}
                        >
                          🪙
                        </span>
                      ))}
                      {Array.from({ length: revealing.silver }).map((_, i) => (
                        <span
                          key={`s${i}`}
                          className="animate-coin-pop"
                          style={{ animationDelay: `${(revealing.gold + i) * 0.12}s` }}
                        >
                          ⚪
                        </span>
                      ))}
                    </span>
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
