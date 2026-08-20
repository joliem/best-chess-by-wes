import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { BrandWordmark } from "@/components/Brand";
import { CoinIcon } from "@/components/CoinIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createOnlineGame,
  joinOnlineGame,
  VARIANT_NAME,
  type OnlineVariant,
} from "@/lib/online.functions";
import { getPlayerToken } from "@/lib/player-token";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wesley's Chess Variants — Play Online or Pass-and-Play" },
      {
        name: "description",
        content:
          "Homemade chess variants: Switcheroo, Treasure and Camo Chess. Play any of them online with a friend on another device — no account needed.",
      },
      { property: "og:title", content: "Wesley's Chess Variants" },
      {
        property: "og:description",
        content:
          "Switcheroo, Treasure and Camo Chess — pick a variant, or send a friend a link and play online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VariantHub,
});

type Variant = {
  to: "/switcheroo" | "/treasure" | "/camo";
  emoji: string;
  name: string;
  tagline: string;
  blurb: string;
  online: OnlineVariant;
};

const VARIANTS: Variant[] = [
  {
    to: "/switcheroo",
    emoji: "🌀",
    name: "Switcheroo Chess",
    tagline: "By random chance, roles reverse",
    blurb:
      "Normal chess until the switcheroo hits — then you move your opponent's army for a move, and they move yours. Blunder away!",
    online: "switcheroo",
  },
  {
    to: "/treasure",
    emoji: "🪙",
    name: "Treasure Chess",
    tagline: "Six hidden coins, two kinds of magic",
    blurb:
      "Gold and silver coins are buried in the middle ranks. Spend silver for temporary invincibility, gold for temporary queen powers.",
    online: "treasure",
  },
  {
    to: "/camo",
    emoji: "🫥",
    name: "Camo Chess",
    tagline: "Squares hide pieces of the same color",
    blurb:
      "Hidden information chess: camouflaged squares and battleship-style scouting to clear the fog.",
    online: "camo",
  },
];

function VariantHub() {
  const navigate = useNavigate();
  const create = useServerFn(createOnlineGame);
  const join = useServerFn(joinOnlineGame);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [variant, setVariant] = useState<OnlineVariant>("switcheroo");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy("create");
    setError(null);
    try {
      const result = await create({ data: { token: getPlayerToken(), variant } });
      navigate({ to: "/play/$code", params: { code: result.game.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the game.");
      setBusy(null);
    }
  }

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setBusy("join");
    setError(null);
    try {
      await join({ data: { code: trimmed, token: getPlayerToken() } });
      navigate({ to: "/play/$code", params: { code: trimmed } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join that game.");
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="text-center">
        <BrandWordmark />
        <p className="mt-2 text-sm uppercase tracking-[0.35em] text-jade">Wesley&apos;s</p>
        <h1 className="text-4xl text-foreground sm:text-6xl">Chess Variants</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Homemade twists on chess. Play at the same screen, or send a friend a link and play any of
          them from two different devices.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-deep">
        <h2 className="text-2xl">Play online with a friend</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No account needed. Pick a variant, start a game, then send the link to your opponent.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["switcheroo", "treasure", "camo"] as OnlineVariant[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={
                "rounded-full border px-4 py-1.5 text-sm transition " +
                (variant === v
                  ? "border-torch bg-torch/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-torch/60")
              }
            >
              {VARIANT_NAME[v]}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={handleCreate} disabled={busy !== null} className="sm:w-56">
            {busy === "create" ? "Creating…" : `Create ${VARIANT_NAME[variant]} link`}
          </Button>
          <div className="flex flex-1 gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Have a code? e.g. K7QMR2"
              maxLength={12}
              className="uppercase tracking-widest"
            />
            <Button variant="outline" onClick={handleJoin} disabled={busy !== null || !code.trim()}>
              Join
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VARIANTS.map((v) => (
          <Link
            key={v.to}
            to={v.to}
            className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-torch"
          >
            <span className="flex h-10 items-center text-4xl">
              {v.to === "/treasure" ? <CoinIcon className="size-10" /> : v.emoji}
            </span>
            <h3 className="mt-3 text-xl text-foreground">{v.name}</h3>
            <p className="text-xs uppercase tracking-wider text-torch">{v.tagline}</p>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{v.blurb}</p>
            <span className="mt-4 text-xs text-muted-foreground">
              {v.online ? "Pass-and-play or online" : "Pass-and-play"} →
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
