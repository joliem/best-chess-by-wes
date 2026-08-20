import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/** Small "Best Chess by Wes" mark for game pages (top-left corner). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "fixed left-3 top-3 z-40 hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur transition-colors hover:border-torch hover:text-foreground sm:inline-flex",
        className,
      )}
    >
      <span className="text-sm leading-none">♟️</span>
      <span>
        Best Chess by <span className="text-torch">Wes</span>
      </span>
    </Link>
  );
}

/** Big wordmark for the home page. */
export function BrandWordmark() {
  return (
    <p className="font-display text-xl font-semibold tracking-tight text-torch sm:text-2xl">
      Best Chess by Wes
    </p>
  );
}
