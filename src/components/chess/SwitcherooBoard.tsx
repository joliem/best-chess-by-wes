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

type Props = {
  board: BoardType;
  /** which side is at the bottom */
  viewer: Color;
  /** whose pieces may move right now */
  mover: Color;
  selected: Sq | null;
  moves: Sq[];
  lastMove: { from: Sq; to: Sq } | null;
  /** switcheroo mode: purple / green squares */
  swapped: boolean;
  /** square holding a king that is currently in check */
  checkSq?: Sq | null;
  /** plays the spin animation once */
  spinning: boolean;
  onSquare: (sq: Sq) => void;
};

export function SwitcherooBoard({
  board,
  viewer,
  mover,
  selected,
  moves,
  lastMove,
  swapped,
  spinning,
  checkSq = null,
  onSquare,
}: Props) {
  const moveSet = new Set(moves.map(key));
  const rows = viewer === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = viewer === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[min(100%,74vh)] rounded-2xl border-4 p-1.5 shadow-deep transition-colors sm:p-2",
        swapped
          ? "border-[oklch(0.45_0.16_300)] bg-[oklch(0.45_0.16_300)]/25"
          : "border-frame bg-frame/25",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-8 overflow-hidden rounded-lg",
          spinning && "animate-board-spin",
        )}
      >
        {rows.map((r) =>
          cols.map((c) => {
            const sq = { r, c };
            const k = key(sq);
            const dark = (r + c) % 2 === 1;
            const piece = board[r]![c];
            const isMove = moveSet.has(k);
            const isSelected = selected ? same(selected, sq) : false;
            const clickable = isMove || piece?.color === mover;

            return (
              <button
                key={k}
                type="button"
                disabled={!clickable}
                onClick={() => onSquare(sq)}
                aria-label={`${sqName(sq)}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                className={cn(
                  "@container relative aspect-square select-none transition-colors",
                  swapped
                    ? dark
                      ? "bg-[oklch(0.45_0.17_300)]"
                      : "bg-[oklch(0.78_0.16_150)]"
                    : dark
                      ? "bg-stone-dark"
                      : "bg-stone-light",
                  clickable ? "cursor-pointer hover:brightness-125" : "cursor-default",
                  isSelected && "ring-4 ring-inset ring-torch",
                )}
              >
                <span className="pointer-events-none absolute left-1 top-0.5 text-[8px] font-semibold text-piece-dark/45">
                  {r === (viewer === "w" ? 7 : 0) ? FILES[c] : ""}
                  {c === (viewer === "w" ? 0 : 7) ? 8 - r : ""}
                </span>

                {lastMove && (same(lastMove.to, sq) || same(lastMove.from, sq)) && (
                  <span className="pointer-events-none absolute inset-0 bg-torch/20" />
                )}

                {piece && (
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-0 grid place-items-center leading-none",
                      piece.type === "p" ? "text-[62cqmin]" : "text-[78cqmin]",
                      piece.color === "w"
                        ? "text-piece-light [text-shadow:0_0_1px_oklch(0.2_0.03_250),0_1px_2px_oklch(0_0_0/0.55),0_0_3px_oklch(0.2_0.03_250)]"
                        : "text-piece-dark [text-shadow:0_0_1px_oklch(1_0_0/0.85),0_1px_2px_oklch(1_0_0/0.5)]",
                    )}
                  >
                    {GLYPH[piece.color][piece.type]}
                  </span>
                )}
                {checkSq && same(checkSq, sq) && <CheckHaze />}

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
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
