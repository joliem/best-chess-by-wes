import type { Color } from "@/lib/chess";
import type { OnlineAction, PublicGame } from "@/lib/online.functions";

export type OnlineProps = {
  code: string;
  game: PublicGame;
  seat: Color | null;
  sending: boolean;
  error: string | null;
  act: (action: OnlineAction) => Promise<void>;
  rematch: () => Promise<void>;
};
