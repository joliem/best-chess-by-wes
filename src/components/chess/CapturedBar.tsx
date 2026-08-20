import { GLYPH, other, PIECE_NAME, type Color, type PieceType } from "@/lib/chess";
import { materialScore, sortLost, type Lost } from "@/lib/captures";
import { cn } from "@/lib/utils";

const NAME: Record<Color, string> = { w: "White", b: "Black" };

function Row({
  label,
  pieces,
  color,
  edge,
}: {
  label: string;
  pieces: PieceType[];
  /** colour of the captured pieces */
  color: Color;
  edge?: number;
}) {
  // Dark pieces sit on a light panel, light pieces on a dark panel.
  const onLight = color === "b";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 px-4 py-2",
        onLight ? "bg-stone-light text-piece-dark" : "bg-stone-dark text-piece-light",
      )}
    >
      <span
        className={cn(
          "shrink-0 text-xs uppercase tracking-[0.14em]",
          onLight ? "text-piece-dark/70" : "text-piece-light/70",
        )}
      >
        {label}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-0.5 leading-none">
        {sortLost(pieces).map((t, i) => (
          <span key={`${t}-${i}`} title={`${NAME[color]} ${PIECE_NAME[t]}`} className="text-xl">
            {GLYPH[color][t]}
          </span>
        ))}
        {pieces.length === 0 && (
          <span className={cn("text-xs", onLight ? "text-piece-dark/60" : "text-piece-light/60")}>
            —
          </span>
        )}
      </span>
      {edge !== undefined && edge > 0 && (
        <span className="shrink-0 text-xs font-semibold text-torch">+{edge}</span>
      )}
    </div>
  );
}

/**
 * Captured material for both sides. `viewer` (when given) makes the labels
 * personal — "You took" / "You lost".
 */
export function CapturedBar({ lost, viewer }: { lost: Lost; viewer?: Color | null }) {
  const me: Color = viewer ?? "w";
  const them = other(me);
  const myScore = materialScore(lost[them]);
  const theirScore = materialScore(lost[me]);

  return (
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-xl border border-border">
      <Row
        label={viewer ? "You took" : `${NAME[me]} took`}
        pieces={lost[them]}
        color={them}
        edge={myScore - theirScore}
      />
      <Row
        label={viewer ? "You lost" : `${NAME[them]} took`}
        pieces={lost[me]}
        color={me}
        edge={theirScore - myScore}
      />
    </div>
  );
}
