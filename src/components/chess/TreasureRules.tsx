import {
  CoinIcon,
  CoinPileIcon,
  CompassIcon,
  PirateFlagIcon,
  SilverCoinIcon,
} from "@/components/CoinIcon";

export function TreasureRules() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-lg">How Treasure Chess works</h2>
      <ul className="space-y-3 text-sm text-muted-foreground [&>li]:grid [&>li]:grid-cols-[1.25rem_minmax(0,1fr)] [&>li]:items-start [&>li]:gap-2">
        <li>
          <CompassIcon className="size-5 text-piece-light" />
          <span>
            3 silver + 3 gold coins are buried on the four middle-rank squares (a square can hold
            more than one). Land on a square to claim any treasure hidden there. When the Memory
            Helper toggle is on, any squares that might still have treasure are marked with a red
            question mark in the corner.
          </span>
        </li>
        <li>
          <CoinPileIcon className="size-5" />
          <div>
            <p>
              When it&apos;s your turn, you can spend a coin in your treasure chest to bestow any
              one of your pieces (other than your king) with special powers. You have to select the
              coin and piece before making your move. The powers last through your move and your
              opponent&apos;s next move, and then your piece reverts back to normal.
            </p>
            <ul className="mt-3 space-y-2">
              <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-2">
                <CoinIcon className="size-5" />
                <span>
                  A gold coin gives a piece queen powers. It can move and capture like a queen, and
                  if it gives check, your opponent will need to respond on their next move. It can
                  even deliver checkmate to end the game!
                </span>
              </li>
              <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-2">
                <SilverCoinIcon className="size-5" />
                <span>
                  A silver coin gives a piece invincibility. Your opponent won&apos;t be able to
                  capture this piece on their next move.
                </span>
              </li>
            </ul>
          </div>
        </li>
        <li>
          <PirateFlagIcon className="size-5 text-torch" />
          <span>
            A stalemate is decided by remaining treasure stockpiles (1 gold coin = 2 silver coins),
            and only ends in a draw if stockpiles are equal.
          </span>
        </li>
      </ul>
    </div>
  );
}
