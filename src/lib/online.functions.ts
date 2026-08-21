import { createServerFn } from "@tanstack/react-start";

import type { Color, PieceType, Sq } from "@/lib/chess";
import {
  applyCamoAction,
  createCamoState,
  maskCamoState,
  type CamoAction,
  type CamoPublicState,
  type CamoState,
} from "@/lib/camo-engine";
import {
  applySwitcherooMove,
  createInitialState,
  moverOf,
  type SwitcherooState,
} from "@/lib/switcheroo";
import {
  applyTreasureAction,
  createTreasureState,
  maskTreasureState,
  type TreasureAction,
  type TreasurePublicState,
  type TreasureState,
} from "@/lib/treasure-engine";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const VARIANTS = ["switcheroo", "treasure", "battleship"] as const;
export type OnlineVariant = (typeof VARIANTS)[number];

export const VARIANT_NAME: Record<OnlineVariant, string> = {
  switcheroo: "Switcheroo Chess",
  treasure: "Treasure Chess",
  battleship: "Battleship Bishop",
};

function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanCode(code: unknown): string {
  const value = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(value)) throw new Error("That game code doesn't look right.");
  return value;
}

function cleanToken(token: unknown): string {
  const value = String(token ?? "").trim();
  if (value.length < 8 || value.length > 128) throw new Error("Missing player token.");
  return value;
}

function cleanName(name: unknown): string | null {
  const value = String(name ?? "").trim();
  if (!value) return null;
  return value.slice(0, 24);
}

function cleanVariant(variant: unknown): OnlineVariant {
  const value = String(variant ?? "switcheroo") as OnlineVariant;
  if (!VARIANTS.includes(value)) throw new Error("Unknown variant.");
  return value;
}

function cleanSq(sq: unknown): Sq {
  const s = sq as { r?: unknown; c?: unknown } | undefined;
  const r = Number(s?.r);
  const c = Number(s?.c);
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r > 7 || c < 0 || c > 7) {
    throw new Error("That square isn't on the board.");
  }
  return { r, c };
}

const PROMOTIONS = ["q", "r", "b", "n"] as const;

/** The union of every action a client may send, per variant. */
export type OnlineAction =
  | { kind: "move"; from: Sq; to: Sq; promoteTo?: PieceType }
  | { kind: "guess"; sq: Sq }
  | { kind: "spend"; coin: "gold" | "silver" }
  | { kind: "pick"; sq: Sq }
  | { kind: "draw" };

function cleanAction(input: unknown): OnlineAction {
  const a = input as Partial<OnlineAction> & { kind?: string };
  switch (a?.kind) {
    case "move": {
      const move = a as { from: unknown; to: unknown; promoteTo?: unknown };
      const promoteTo = PROMOTIONS.includes(move.promoteTo as never)
        ? (move.promoteTo as PieceType)
        : undefined;
      return {
        kind: "move",
        from: cleanSq(move.from),
        to: cleanSq(move.to),
        ...(promoteTo ? { promoteTo } : {}),
      };
    }
    case "guess":
      return { kind: "guess", sq: cleanSq((a as { sq: unknown }).sq) };
    case "pick":
      return { kind: "pick", sq: cleanSq((a as { sq: unknown }).sq) };
    case "spend": {
      const coin = (a as { coin?: unknown }).coin;
      if (coin !== "gold" && coin !== "silver") throw new Error("Unknown coin.");
      return { kind: "spend", coin };
    }
    case "draw":
      return { kind: "draw" };
    default:
      throw new Error("Unknown action.");
  }
}

export type PublicState = SwitcherooState | TreasurePublicState | CamoPublicState;

export type PublicGame = {
  code: string;
  variant: OnlineVariant;
  status: string;
  state: PublicState;
  whiteJoined: boolean;
  blackJoined: boolean;
};

type GameRow = {
  id: string;
  code: string;
  variant: string;
  status: string;
  state: unknown;
  white_joined: boolean;
  black_joined: boolean;
};

const SELECT = "id, code, variant, status, state, white_joined, black_joined";

function freshState(variant: OnlineVariant) {
  if (variant === "treasure") return createTreasureState();
  if (variant === "battleship") return createCamoState();
  return createInitialState();
}

/** Censor the stored state for one seat before it leaves the server. */
function toPublic(row: GameRow, viewer: Color | null): PublicGame {
  const variant = cleanVariant(row.variant);
  let state: PublicState;
  if (variant === "treasure") state = maskTreasureState(row.state as TreasureState);
  else if (variant === "battleship") state = maskCamoState(row.state as CamoState, viewer);
  else state = row.state as SwitcherooState;

  return {
    code: row.code,
    variant,
    status: row.status,
    state,
    whiteJoined: row.white_joined,
    blackJoined: row.black_joined,
  };
}

export const createOnlineGame = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; name?: string; variant?: string }) => ({
    token: cleanToken(input?.token),
    name: cleanName(input?.name),
    variant: cleanVariant(input?.variant),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = freshState(data.variant);

    let row: GameRow | null = null;
    for (let attempt = 0; attempt < 5 && !row; attempt++) {
      const { data: inserted, error } = await supabaseAdmin
        .from("games")
        .insert({
          code: makeCode(),
          variant: data.variant,
          status: "waiting",
          state: state as unknown as never,
          white_joined: true,
        })
        .select(SELECT)
        .single();
      if (!error && inserted) row = inserted as GameRow;
      else if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    }
    if (!row) throw new Error("Couldn't create a game right now. Try again.");

    const { error: seatError } = await supabaseAdmin.from("game_players").insert({
      game_id: row.id,
      color: "w",
      token_hash: await hashToken(data.token),
      display_name: data.name,
    });
    if (seatError) throw new Error(seatError.message);

    return { game: toPublic(row, "w"), color: "w" as Color };
  });

export const joinOnlineGame = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; token: string; name?: string }) => ({
    code: cleanCode(input?.code),
    token: cleanToken(input?.token),
    name: cleanName(input?.name),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("games")
      .select(SELECT)
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("No game with that code.");

    const game = row as GameRow;
    const tokenHash = await hashToken(data.token);

    const { data: seats } = await supabaseAdmin
      .from("game_players")
      .select("color, token_hash")
      .eq("game_id", game.id);
    const mine = (seats ?? []).find((s) => s.token_hash === tokenHash);
    if (mine) return { game: toPublic(game, mine.color as Color), color: mine.color as Color };

    const taken = new Set((seats ?? []).map((s) => s.color));
    const free: Color | null = !taken.has("w") ? "w" : !taken.has("b") ? "b" : null;
    if (!free) return { game: toPublic(game, null), color: null };

    const { error: seatError } = await supabaseAdmin.from("game_players").insert({
      game_id: game.id,
      color: free,
      token_hash: tokenHash,
      display_name: data.name,
    });
    if (seatError) throw new Error(seatError.message);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("games")
      .update(
        free === "w"
          ? { white_joined: true, status: "active" }
          : { black_joined: true, status: "active" },
      )
      .eq("id", game.id)
      .select(SELECT)
      .single();
    if (updateError) throw new Error(updateError.message);

    return { game: toPublic(updated as GameRow, free), color: free };
  });

export const getOnlineGame = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; token?: string }) => ({
    code: cleanCode(input?.code),
    token: input?.token ? cleanToken(input.token) : null,
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("games")
      .select(SELECT)
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("No game with that code.");

    const game = row as GameRow;
    let color: Color | null = null;
    if (data.token) {
      const tokenHash = await hashToken(data.token);
      const { data: seat } = await supabaseAdmin
        .from("game_players")
        .select("color")
        .eq("game_id", game.id)
        .eq("token_hash", tokenHash)
        .maybeSingle();
      color = (seat?.color as Color | undefined) ?? null;
    }
    return { game: toPublic(game, color), color };
  });

async function loadSeat(code: string, token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("games")
    .select(SELECT)
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("No game with that code.");

  const game = row as GameRow;
  const { data: seat } = await supabaseAdmin
    .from("game_players")
    .select("color")
    .eq("game_id", game.id)
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!seat) throw new Error("You don't have a seat in this game.");

  return { supabaseAdmin, game, color: seat.color as Color };
}

/** One entry point for every variant's actions — the server owns the rules. */
export const submitOnlineAction = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; token: string; action: unknown }) => ({
    code: cleanCode(input?.code),
    token: cleanToken(input?.token),
    action: cleanAction(input?.action),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin, game, color } = await loadSeat(data.code, data.token);
    const variant = cleanVariant(game.variant);
    const action = data.action;

    let nextState: unknown;
    let over = false;

    if (variant === "switcheroo") {
      if (action.kind !== "move") throw new Error("That isn't a Switcheroo move.");
      const state = game.state as SwitcherooState;
      if (state.controller !== color) throw new Error("It isn't your turn.");
      const outcome = applySwitcherooMove(
        state,
        {
          from: action.from,
          to: action.to,
          ...(action.promoteTo ? { promoteTo: action.promoteTo } : {}),
        },
        Math.random,
      );
      if (!outcome.ok) throw new Error(outcome.error);
      nextState = outcome.state;
      over = outcome.state.phase === "over";
    } else if (variant === "treasure") {
      if (action.kind === "guess") throw new Error("There's no guessing in Treasure Chess.");
      const outcome = applyTreasureAction(
        game.state as TreasureState,
        action as TreasureAction,
        color,
      );
      if (!outcome.ok) throw new Error(outcome.error);
      nextState = outcome.state;
      over = outcome.state.phase === "over";
    } else {
      if (action.kind !== "move" && action.kind !== "guess") {
        throw new Error("That isn't a Battleship Bishop action.");
      }
      const outcome = applyCamoAction(game.state as CamoState, action as CamoAction, color);
      if (!outcome.ok) throw new Error(outcome.error);
      nextState = outcome.state;
      over = outcome.state.phase === "over";
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("games")
      .update({ state: nextState as never, status: over ? "finished" : "active" })
      .eq("id", game.id)
      .select(SELECT)
      .single();
    if (updateError) throw new Error(updateError.message);

    return { game: toPublic(updated as GameRow, color) };
  });

export const rematchOnlineGame = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; token: string }) => ({
    code: cleanCode(input?.code),
    token: cleanToken(input?.token),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin, game, color } = await loadSeat(data.code, data.token);
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("games")
      .update({
        state: freshState(cleanVariant(game.variant)) as unknown as never,
        status: game.black_joined ? "active" : "waiting",
      })
      .eq("id", game.id)
      .select(SELECT)
      .single();
    if (updateError) throw new Error(updateError.message);

    return { game: toPublic(updated as GameRow, color) };
  });

export { moverOf };
