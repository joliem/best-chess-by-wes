import { PIECE_GLYPH, key, same, type PieceType, type Room, type Sq, THRONE } from "@/lib/quest";
import { cn } from "@/lib/utils";

type Props = {
  grid: Room[][];
  hero: Sq;
  piece: PieceType;
  moves: Sq[];
  onPick: (sq: Sq) => void;
  busy: boolean;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function Board({ grid, hero, piece, moves, onPick, busy }: Props) {
  const moveSet = new Set(moves.map(key));

  return (
    <div className="rounded-2xl border-4 border-frame bg-frame/25 p-2 shadow-deep sm:p-3">
      <div className="grid grid-cols-8 overflow-hidden rounded-lg">
        {grid.map((row, r) =>
          row.map((room, c) => {
            const sq = { r, c };
            const dark = (r + c) % 2 === 1;
            const isHero = same(hero, sq);
            const canGo = moveSet.has(key(sq)) && !busy;
            const isThrone = same(THRONE, sq);
            const hidden = !room.cleared && (room.kind === "monster" || room.kind === "treasure");
            return (
              <button
                key={key(sq)}
                type="button"
                disabled={!canGo}
                onClick={() => onPick(sq)}
                aria-label={`${FILES[c]}${8 - r} ${room.name}`}
                className={cn(
                  "relative aspect-square select-none text-2xl transition-transform sm:text-3xl",
                  dark ? "bg-stone-dark" : "bg-stone-light",
                  canGo && "cursor-pointer hover:scale-[1.06] hover:brightness-125",
                  !canGo && "cursor-default",
                )}
              >
                <span className="absolute left-1 top-0.5 text-[8px] font-semibold text-muted-foreground/60">
                  {r === 7 ? FILES[c] : ""}
                  {c === 0 ? 8 - r : ""}
                </span>

                {room.cleared && room.kind !== "empty" && (
                  <span className="absolute inset-0 grid place-items-center text-lg opacity-30">
                    {room.kind === "throne" ? "🏆" : "✦"}
                  </span>
                )}

                {!room.cleared && (
                  <span
                    className={cn(
                      "absolute inset-0 grid place-items-center",
                      hidden && "opacity-90",
                      isThrone && "animate-pulse-glow",
                    )}
                  >
                    {room.kind === "gate" || isThrone || !hidden ? room.emoji : "❔"}
                  </span>
                )}

                {canGo && (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="size-3 rounded-full bg-torch shadow-glow sm:size-4" />
                  </span>
                )}

                {isHero && (
                  <span className="absolute inset-0 grid place-items-center text-3xl text-hero drop-shadow-[0_0_10px_var(--torch)] sm:text-4xl">
                    {PIECE_GLYPH[piece]}
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
