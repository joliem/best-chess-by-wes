import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { GLYPH, other, PIECE_NAME, type Color, type PieceType } from "@/lib/chess";
import { type Lost } from "@/lib/captures";

const NAME: Record<Color, string> = { w: "White", b: "Black" };

function diff(before: PieceType[], after: PieceType[]): PieceType[] {
  const pool = [...before];
  const added: PieceType[] = [];
  for (const t of after) {
    const i = pool.indexOf(t);
    if (i === -1) added.push(t);
    else pool.splice(i, 1);
  }
  return added;
}

/**
 * Toast whenever a piece disappears from the board. Pass `viewer` for online
 * play so the wording is personal ("You captured Black's Bishop").
 */
export function useCaptureToast(lost: Lost, viewer?: Color | null) {
  const prev = useRef<Lost | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = lost;
    if (!before) return;

    for (const color of ["w", "b"] as Color[]) {
      for (const type of diff(before[color], lost[color])) {
        const taker = other(color);
        const message = viewer
          ? color === viewer
            ? `${NAME[taker]} captured your ${PIECE_NAME[type]}`
            : `You captured ${NAME[color]}'s ${PIECE_NAME[type]}`
          : `${NAME[taker]} captured ${NAME[color]}'s ${PIECE_NAME[type]}`;
        toast(message, { icon: GLYPH[color][type], duration: 3500 });
      }
    }
  }, [lost, viewer]);
}

/** Reset helper for rematches — clears the remembered board state. */
export function captureToastKey(...parts: Array<string | number>) {
  return parts.join(":");
}
