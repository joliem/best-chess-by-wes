import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { OnlineBattleship } from "@/components/online/OnlineCamo";
import { OnlineSwitcheroo } from "@/components/online/OnlineSwitcheroo";
import { OnlineTreasure } from "@/components/online/OnlineTreasure";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Color } from "@/lib/chess";
import {
  getOnlineGame,
  joinOnlineGame,
  rematchOnlineGame,
  submitOnlineAction,
  VARIANT_NAME,
  type OnlineAction,
  type PublicGame,
} from "@/lib/online.functions";
import { getPlayerToken } from "@/lib/player-token";
import { COLOR_NAME } from "@/lib/switcheroo";
import { BrandMark } from "@/components/Brand";

export const Route = createFileRoute("/play/$code")({
  head: () => ({
    meta: [
      { title: "Play Chess Online — Best Chess by Wes" },
      {
        name: "description",
        content:
          "Join a live game of Switcheroo, Treasure or Battleship Bishop from any device. No account needed — moves sync instantly between both players.",
      },
      { property: "og:title", content: "Play a chess variant online" },
      {
        property: "og:description",
        content: "A friend invited you to a live chess variant. Take your seat and play.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnlineGame,
});

function OnlineGame() {
  const { code } = Route.useParams();
  const join = useServerFn(joinOnlineGame);
  const fetchGame = useServerFn(getOnlineGame);
  const sendAction = useServerFn(submitOnlineAction);
  const sendRematch = useServerFn(rematchOnlineGame);

  const [game, setGame] = useState<PublicGame | null>(null);
  const [seat, setSeat] = useState<Color | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Take a seat (or recognise the seat this device already holds).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await join({ data: { code, token: getPlayerToken() } });
        if (!alive) return;
        setGame(result.game);
        setSeat(result.color);
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "Couldn't open that game.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, join]);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchGame({ data: { code, token: getPlayerToken() } });
      setGame(result.game);
      if (result.color) setSeat(result.color);
    } catch {
      /* transient — the realtime channel will catch us up */
    }
  }, [code, fetchGame]);

  // Live sync: both devices watch the same row.
  useEffect(() => {
    const channel = supabase
      .channel(`game-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `code=eq.${code}` },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [code, refresh]);

  const act = useCallback(
    async (action: OnlineAction) => {
      setSending(true);
      setActionError(null);
      try {
        const result = await sendAction({ data: { code, token: getPlayerToken(), action } });
        setGame(result.game);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "That move was rejected.");
        void refresh();
      } finally {
        setSending(false);
      }
    },
    [code, refresh, sendAction],
  );

  const rematch = useCallback(async () => {
    const result = await sendRematch({ data: { code, token: getPlayerToken() } });
    setGame(result.game);
    setActionError(null);
  }, [code, sendRematch]);

  function copyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="text-3xl">Game not found</h1>
          <p className="mt-2 text-muted-foreground">{loadError}</p>
          <Link to="/" className="mt-4 inline-block text-torch underline">
            ← Back to all variants
          </Link>
        </div>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-muted-foreground">
        Loading game {code}…
      </main>
    );
  }

  const waiting = !game.blackJoined;
  const props = { code, game, seat, sending, error: actionError, act, rematch };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-3 py-4">
      <BrandMark />
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-torch">Online</p>
        <h1 className="text-4xl text-foreground sm:text-5xl">{VARIANT_NAME[game.variant]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {seat
            ? `You are ${COLOR_NAME[seat]}.`
            : "Both seats are taken — you're watching this game."}{" "}
          Game code <span className="font-mono tracking-widest text-foreground">{game.code}</span>
        </p>
        <Link to="/" className="mt-1 inline-block text-xs text-torch underline">
          ← All variants
        </Link>
      </header>

      {waiting && (
        <div className="rounded-xl border border-torch/50 bg-card p-4 text-center">
          <p className="text-lg">Waiting for your opponent…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Send them this link (or the code {game.code}) and the board will start as soon as they
            arrive.
          </p>
          <Button className="mt-3" variant="outline" onClick={copyLink}>
            {copied ? "Link copied!" : "Copy invite link"}
          </Button>
        </div>
      )}

      {game.variant === "switcheroo" && <OnlineSwitcheroo {...props} />}
      {game.variant === "treasure" && <OnlineTreasure {...props} />}
      {game.variant === "battleship" && <OnlineBattleship {...props} />}

      <Button variant="outline" className="mx-auto w-full max-w-xs" onClick={copyLink}>
        {copied ? "Link copied!" : "Copy invite link"}
      </Button>
    </main>
  );
}
