import { canScout, canSee, isScouted } from "@/lib/fog";
import {
  FILES,
  GLYPH,
  key,
  same,
  sqName,
  type Board as BoardType,
  type Color,
  type Piece,
  type Sq,
} from "@/lib/chess";
import { cn } from "@/lib/utils";

export type GuessMark = { sq: Sq; hit: boolean; id?: number };

export function MissMarkerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("inline-block size-4 shrink-0 overflow-visible text-destructive", className)}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="14" />
      <path
        d="M24 24 76 76M76 24 24 76"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckHaze() {
  return (
    <span
      className="pointer-events-none absolute inset-[8%] z-20 rounded-full bg-destructive/30 shadow-[0_0_14px_5px_hsl(var(--destructive)/0.35)]"
      aria-hidden="true"
    />
  );
}

type Props = {
  board: BoardType;
  /** hidden pieces visible only to this viewer, keyed by square */
  overlays?: Record<string, Piece>;
  viewer: Color;
  /** squares scouted for good, as `r-c` keys */
  revealed: string[];
  /** game over — drop the fog entirely */
  showAll?: boolean;
  selected: Sq | null;
  moves: Sq[];
  lastMove: { from: Sq; to: Sq } | null;
  guesses: GuessMark[];
  /** newest guess while its result notification is visible */
  guessReveal?: GuessMark | null;
  /** square holding a king that is currently in check */
  checkSq?: Sq | null;
  mode: "move" | "guess" | "locked";
  onSquare: (sq: Sq) => void;
};

export function ChessBoard({
  board,
  overlays = {},
  viewer,
  revealed,
  showAll = false,
  selected,
  moves,
  lastMove,
  guesses,
  guessReveal = null,
  checkSq = null,
  mode,
  onSquare,
}: Props) {
  const moveSet = new Set(moves.map(key));
  // Only trail a move the viewer is actually allowed to witness — otherwise the
  // highlight would betray a hidden enemy move.
  const visibleLastMove =
    lastMove && (showAll || canSee(board, lastMove.to, viewer, revealed)) ? lastMove : null;
  const guessesBySquare = new Map(guesses.map((guess) => [key(guess.sq), guess]));
  const rows = viewer === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = viewer === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div className="mx-auto w-full max-w-[min(100%,74vh)] rounded-2xl border-4 border-frame bg-frame/25 p-1.5 shadow-deep sm:p-2">
      <div className="grid grid-cols-8 overflow-hidden rounded-lg">
        {rows.map((r) =>
          cols.map((c) => {
            const sq = { r, c };
            const dark = (r + c) % 2 === 1;
            const piece = board[r]![c];
            const overlay = overlays[key(sq)];
            const visible = showAll || canSee(board, sq, viewer, revealed);
            const shown = visible ? piece : null;
            const isMove = moveSet.has(key(sq)) && mode === "move";
            const isSelected = selected ? same(selected, sq) : false;
            const cleared = isScouted(revealed, sq);
            const scoutable = mode === "guess" && canScout(sq, viewer, revealed);
            const clickable =
              scoutable ||
              isMove ||
              (mode === "move" && (shown?.color === viewer || overlay?.color === viewer));
            const guess = guessesBySquare.get(key(sq));
            const revealingGuess = guessReveal && same(guessReveal.sq, sq) ? guessReveal : null;

            return (
              <button
                key={key(sq)}
                type="button"
                disabled={!clickable}
                onClick={() => onSquare(sq)}
                aria-label={`${sqName(sq)}${shown ? ` ${shown.color === "w" ? "white" : "black"} ${shown.type}` : ""}${cleared ? " unhidden" : " camouflaged"}`}
                className={cn(
                  "@container relative aspect-square select-none transition-transform",
                  dark ? "bg-stone-dark" : "bg-stone-light",

                  clickable ? "cursor-pointer hover:brightness-125" : "cursor-default",
                  isSelected && "ring-4 ring-inset ring-torch",
                  revealingGuess?.hit && "animate-coin-flip z-20",
                )}
              >
                <span className="pointer-events-none absolute left-1 top-0.5 text-[8px] font-semibold text-piece-dark/45">
                  {r === (viewer === "w" ? 7 : 0) ? FILES[c] : ""}
                  {c === (viewer === "w" ? 0 : 7) ? 8 - r : ""}
                </span>

                {cleared && (
                  <span
                    className="pointer-events-none absolute right-0.5 top-0 text-[20cqmin] font-black leading-none text-destructive [text-shadow:0_0_2px_oklch(0_0_0/0.5)]"
                    title="Camouflage cleared — this square is unhidden for good"
                  >
                    ✕
                  </span>
                )}

                {guess && !guess.hit && !revealingGuess && (
                  <MissMarkerIcon className="pointer-events-none absolute right-1 top-1 z-30 size-[24cqmin]" />
                )}

                {revealingGuess && !revealingGuess.hit && (
                  <span className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
                    <MissMarkerIcon className="size-[68cqmin] drop-shadow-[0_2px_2px_oklch(0_0_0/0.35)]" />
                  </span>
                )}

                {visibleLastMove &&
                  (same(visibleLastMove.to, sq) || same(visibleLastMove.from, sq)) && (
                    <span className="pointer-events-none absolute inset-0 bg-torch/20" />
                  )}

                {shown && (
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-0 grid place-items-center leading-none",
                      overlay && shown && "translate-x-[16%] scale-75",
                      shown.type === "p"
                        ? "-translate-y-[3%] text-[62cqmin]"
                        : shown.type === "r"
                          ? "-translate-y-[8%] text-[73cqmin]"
                          : "-translate-y-[8%] text-[78cqmin]",
                      shown.color === "w"
                        ? "text-piece-light [text-shadow:0_0_1px_oklch(0.2_0.03_250),0_1px_2px_oklch(0_0_0/0.55),0_0_3px_oklch(0.2_0.03_250)]"
                        : "text-piece-dark [text-shadow:0_0_1px_oklch(1_0_0/0.85),0_1px_2px_oklch(1_0_0/0.5)]",
                    )}
                  >
                    {GLYPH[shown.color][shown.type]}
                  </span>
                )}

                {overlay && (
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-0 grid place-items-center text-[78cqmin] leading-none",
                      shown && "-translate-x-[16%] scale-75",
                      overlay.color === "w"
                        ? "text-piece-light [text-shadow:0_0_1px_oklch(0.2_0.03_250),0_1px_2px_oklch(0_0_0/0.55)]"
                        : "text-piece-dark [text-shadow:0_0_1px_oklch(1_0_0/0.85),0_1px_2px_oklch(1_0_0/0.5)]",
                    )}
                    title="Your hidden bishop"
                  >
                    {GLYPH[overlay.color][overlay.type]}
                  </span>
                )}

                {checkSq && same(checkSq, sq) && <CheckHaze />}

                {isMove && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span
                      className={cn(
                        "rounded-full bg-torch/80 shadow-glow",
                        shown ? "size-full opacity-25" : "size-3 sm:size-4",
                      )}
                    />
                  </span>
                )}

                {scoutable && (
                  <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-torch/40" />
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
