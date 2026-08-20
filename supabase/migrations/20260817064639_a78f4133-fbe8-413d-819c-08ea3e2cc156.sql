CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  variant TEXT NOT NULL DEFAULT 'switcheroo',
  status TEXT NOT NULL DEFAULT 'waiting',
  state JSONB NOT NULL,
  white_joined BOOLEAN NOT NULL DEFAULT false,
  black_joined BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.game_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  display_name TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (game_id, color)
);

GRANT SELECT ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
GRANT ALL ON public.game_players TO service_role;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view games" ON public.games FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER games_set_updated_at BEFORE UPDATE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX games_code_idx ON public.games (code);
CREATE INDEX game_players_game_idx ON public.game_players (game_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;