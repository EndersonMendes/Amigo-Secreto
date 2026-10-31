-- Amigo Secreto de Natal — executar integralmente no SQL Editor do Supabase.
-- Requer PostgreSQL >= 15, UTF8 e os papéis nativos anon/authenticated/service_role.
-- Instalação idempotente, sem apagar inscrições. Não substitui migrações futuras.
BEGIN;

CREATE OR REPLACE FUNCTION public.as_normalize(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT pg_catalog.normalize(pg_catalog.btrim(pg_catalog.regexp_replace(
    p_value, U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'
  )), 'NFC');
$$;

CREATE OR REPLACE FUNCTION public.as_valid_text(p_value text, p_min integer, p_max integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(pg_catalog.char_length(p_value) BETWEEN p_min AND p_max
    AND p_value = public.as_normalize(p_value) AND p_value !~ U&'[\0001-\001F\007F-\009F]', false);
$$;

CREATE OR REPLACE FUNCTION public.as_clean_gifts(p_gifts text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT pg_catalog.array_agg(public.as_normalize(gift) ORDER BY position)
  FROM pg_catalog.unnest(p_gifts) WITH ORDINALITY AS g(gift, position);
$$;

CREATE OR REPLACE FUNCTION public.as_valid_gifts(p_gifts text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(
    pg_catalog.array_ndims(p_gifts) = 1 AND pg_catalog.cardinality(p_gifts) = 3
    AND (SELECT pg_catalog.count(DISTINCT pg_catalog.lower(public.as_normalize(gift))) = 3
      AND pg_catalog.bool_and(public.as_valid_text(gift, 1, 160))
      FROM pg_catalog.unnest(p_gifts) AS g(gift)), false);
$$;

CREATE OR REPLACE FUNCTION public.as_valid_hash(p_hash text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_hash ~ '^scrypt(-v2)?\$32768\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$', false);
$$;

CREATE TABLE IF NOT EXISTS public.as_event (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'Amigo Secreto de Natal' CHECK (public.as_valid_text(name, 2, 100)),
  intro text NOT NULL DEFAULT 'Um presente, uma surpresa, muitas boas histórias.' CHECK (public.as_valid_text(intro, 1, 500)),
  home_text text NOT NULL DEFAULT 'Preencha sua lista, guarde seu código e prepare uma surpresa especial.' CHECK (public.as_valid_text(home_text, 1, 1000)),
  event_date date,
  registrations_open boolean NOT NULL DEFAULT true,
  draw_id uuid UNIQUE,
  draw_at timestamptz,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  CHECK ((draw_id IS NULL) = (draw_at IS NULL)),
  CHECK (draw_id IS NULL OR NOT registrations_open)
);
INSERT INTO public.as_event(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.as_participants (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  name text NOT NULL CHECK (public.as_valid_text(name, 2, 100)),
  name_key text GENERATED ALWAYS AS (pg_catalog.lower(public.as_normalize(name))) STORED UNIQUE,
  code_hash text NOT NULL CHECK (public.as_valid_hash(code_hash)),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.as_gifts (
  participant_id uuid NOT NULL REFERENCES public.as_participants(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  description text NOT NULL CHECK (public.as_valid_text(description, 1, 160)),
  description_key text GENERATED ALWAYS AS (pg_catalog.lower(public.as_normalize(description))) STORED,
  PRIMARY KEY (participant_id, position),
  UNIQUE (participant_id, description_key)
);

-- Os limites de posição garantem no máximo três sugestões; o gatilho adiado
-- garante exatamente três ao COMMIT, inclusive para gravações SQL diretas.
CREATE OR REPLACE FUNCTION public.as_check_three_gifts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE checked_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'as_participants' THEN checked_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN checked_id := OLD.participant_id;
  ELSE checked_id := NEW.participant_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.as_participants WHERE id = checked_id)
    AND (SELECT pg_catalog.count(*) FROM public.as_gifts WHERE participant_id = checked_id) <> 3 THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF TG_TABLE_NAME = 'as_gifts' AND TG_OP = 'UPDATE' THEN
    IF OLD.participant_id IS DISTINCT FROM NEW.participant_id
      AND EXISTS (SELECT 1 FROM public.as_participants WHERE id = OLD.participant_id)
      AND (SELECT pg_catalog.count(*) FROM public.as_gifts WHERE participant_id = OLD.participant_id) <> 3 THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS as_participants_three_gifts ON public.as_participants;
CREATE CONSTRAINT TRIGGER as_participants_three_gifts AFTER INSERT OR UPDATE ON public.as_participants
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.as_check_three_gifts();
DROP TRIGGER IF EXISTS as_gifts_three_gifts ON public.as_gifts;
CREATE CONSTRAINT TRIGGER as_gifts_three_gifts AFTER INSERT OR UPDATE OR DELETE ON public.as_gifts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.as_check_three_gifts();

CREATE TABLE IF NOT EXISTS public.as_assignments (
  giver_id uuid PRIMARY KEY REFERENCES public.as_participants(id) ON DELETE RESTRICT,
  receiver_id uuid NOT NULL UNIQUE REFERENCES public.as_participants(id) ON DELETE RESTRICT,
  draw_id uuid NOT NULL REFERENCES public.as_event(draw_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (giver_id <> receiver_id)
);

CREATE TABLE IF NOT EXISTS public.as_rate_limits (
  key text PRIMARY KEY CHECK (key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts >= 1)
);
CREATE INDEX IF NOT EXISTS as_rate_limits_expiration_idx ON public.as_rate_limits(window_started_at);

ALTER TABLE public.as_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.as_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.as_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.as_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.as_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS as_event_deny_client ON public.as_event;
CREATE POLICY as_event_deny_client ON public.as_event AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS as_participants_deny_client ON public.as_participants;
CREATE POLICY as_participants_deny_client ON public.as_participants AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS as_gifts_deny_client ON public.as_gifts;
CREATE POLICY as_gifts_deny_client ON public.as_gifts AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS as_assignments_deny_client ON public.as_assignments;
CREATE POLICY as_assignments_deny_client ON public.as_assignments AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
DROP POLICY IF EXISTS as_rate_limits_deny_client ON public.as_rate_limits;
CREATE POLICY as_rate_limits_deny_client ON public.as_rate_limits AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON TABLE public.as_event, public.as_participants, public.as_gifts, public.as_assignments, public.as_rate_limits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.as_public_event()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'name', e.name, 'intro', e.intro, 'home_text', e.home_text, 'event_date', e.event_date,
    'registrations_open', e.registrations_open, 'draw_completed', e.draw_id IS NOT NULL,
    'participant_count', (SELECT pg_catalog.count(*) FROM public.as_participants)
  ) FROM public.as_event AS e WHERE e.id = 1;
$$;

CREATE OR REPLACE FUNCTION public.as_admin_event()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.as_public_event() || pg_catalog.jsonb_build_object(
    'draw_id', e.draw_id, 'draw_at', e.draw_at, 'revision', e.revision
  ) FROM public.as_event AS e WHERE e.id = 1;
$$;

CREATE OR REPLACE FUNCTION public.as_participants()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', p.id, 'name', p.name, 'gifts', (SELECT pg_catalog.array_agg(g.description ORDER BY g.position)
      FROM public.as_gifts AS g WHERE g.participant_id = p.id), 'created_at', p.created_at
  ) ORDER BY p.name, p.id), '[]'::jsonb) FROM public.as_participants AS p;
$$;

CREATE OR REPLACE FUNCTION public.as_edit_participant(p_id uuid, p_name text, p_gifts text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.as_event%ROWTYPE;
  clean_name text := public.as_normalize(p_name);
  clean_gifts text[] := public.as_clean_gifts(p_gifts);
BEGIN
  IF p_id IS NULL OR NOT public.as_valid_text(clean_name, 2, 100)
    OR NOT public.as_valid_gifts(clean_gifts) OR pg_catalog.array_ndims(p_gifts) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT * INTO e FROM public.as_event WHERE id = 1 FOR UPDATE;
  IF e.draw_id IS NOT NULL THEN RAISE EXCEPTION 'DRAW_EXISTS'; END IF;
  UPDATE public.as_participants SET name = clean_name WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  DELETE FROM public.as_gifts WHERE participant_id = p_id;
  INSERT INTO public.as_gifts(participant_id, position, description)
    SELECT p_id, position, gift FROM pg_catalog.unnest(clean_gifts) WITH ORDINALITY AS g(gift, position);
  UPDATE public.as_event SET revision = revision + 1 WHERE id = 1;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_NAME';
END;
$$;

CREATE OR REPLACE FUNCTION public.as_delete_participant(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.as_event%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.as_event WHERE id = 1 FOR UPDATE;
  IF e.draw_id IS NOT NULL THEN RAISE EXCEPTION 'DRAW_EXISTS'; END IF;
  DELETE FROM public.as_participants WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE public.as_event SET revision = revision + 1 WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.as_reveal(p_id uuid, p_code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM id FROM public.as_event WHERE id = 1 FOR SHARE;
  -- Código inválido/revogado não revela sequer o estado do sorteio.
  IF NOT EXISTS (SELECT 1 FROM public.as_participants AS p WHERE p.id = p_id AND p.code_hash = p_code_hash) THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.as_event AS e WHERE e.id = 1 AND e.draw_id IS NOT NULL) THEN RAISE EXCEPTION 'DRAW_PENDING'; END IF;
  -- A checagem do hash é repetida na própria consulta que retorna o destinatário.
  SELECT pg_catalog.jsonb_build_object('name', receiver.name, 'gifts',
    (SELECT pg_catalog.array_agg(g.description ORDER BY g.position) FROM public.as_gifts AS g WHERE g.participant_id = receiver.id)) INTO result
  FROM public.as_participants AS giver
  JOIN public.as_assignments AS a ON a.giver_id = giver.id
  JOIN public.as_participants AS receiver ON receiver.id = a.receiver_id
  JOIN public.as_event AS e ON e.id = 1 AND e.draw_id = a.draw_id
  WHERE giver.id = p_id AND giver.code_hash = p_code_hash;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.as_update_event(p_name text, p_intro text, p_home_text text, p_event_date date, p_open boolean, p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.as_event%ROWTYPE;
  clean_name text := public.as_normalize(p_name);
  clean_intro text := public.as_normalize(p_intro);
  clean_home text := public.as_normalize(p_home_text);
BEGIN
  IF NOT public.as_valid_text(clean_name, 2, 100)
    OR NOT public.as_valid_text(clean_intro, 1, 500)
    OR NOT public.as_valid_text(clean_home, 1, 1000)
    OR p_open IS NULL OR p_revision IS NULL OR (p_event_date IS NOT NULL AND NOT pg_catalog.isfinite(p_event_date)) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT * INTO e FROM public.as_event WHERE id = 1 FOR UPDATE;
  IF e.revision <> p_revision THEN RAISE EXCEPTION 'STALE_EVENT'; END IF;
  IF e.draw_id IS NOT NULL AND p_open THEN RAISE EXCEPTION 'DRAW_EXISTS'; END IF;
  UPDATE public.as_event SET name = clean_name, intro = clean_intro, home_text = clean_home,
    event_date = p_event_date, registrations_open = p_open, revision = revision + 1 WHERE id = 1;
  RETURN public.as_admin_event();
END;
$$;

CREATE OR REPLACE FUNCTION public.as_commit_draw(p_pairs jsonb, p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.as_event%ROWTYPE;
  participant_count integer;
  pair_count integer;
  giver_count integer;
  receiver_count integer;
  pair_item jsonb;
  g uuid;
  r uuid;
  new_draw_id uuid := pg_catalog.gen_random_uuid();
BEGIN
  SELECT * INTO e FROM public.as_event WHERE id = 1 FOR UPDATE;
  IF e.draw_id IS NOT NULL THEN RAISE EXCEPTION 'DRAW_EXISTS'; END IF;
  IF e.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_EVENT'; END IF;
  IF e.registrations_open THEN RAISE EXCEPTION 'REGISTRATION_OPEN'; END IF;
  SELECT pg_catalog.count(*) INTO participant_count FROM public.as_participants;
  IF participant_count < 2 THEN RAISE EXCEPTION 'TOO_FEW_PARTICIPANTS'; END IF;
  IF p_pairs IS NULL OR pg_catalog.jsonb_typeof(p_pairs) <> 'array' THEN RAISE EXCEPTION 'INVALID_DRAW'; END IF;
  IF pg_catalog.jsonb_array_length(p_pairs) <> participant_count THEN RAISE EXCEPTION 'INVALID_DRAW'; END IF;
  -- Valida cada UUID e existência antes de qualquer alteração do evento/pares.
  FOR pair_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_pairs) LOOP
    IF pg_catalog.jsonb_typeof(pair_item) <> 'object'
      OR pg_catalog.jsonb_typeof(pair_item->'giver_id') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(pair_item->'receiver_id') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_DRAW'; END IF;
    BEGIN
      g := (pair_item->>'giver_id')::uuid;
      r := (pair_item->>'receiver_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'INVALID_DRAW'; END;
    IF g = r OR NOT EXISTS (SELECT 1 FROM public.as_participants WHERE id = g)
      OR NOT EXISTS (SELECT 1 FROM public.as_participants WHERE id = r) THEN RAISE EXCEPTION 'INVALID_DRAW'; END IF;
  END LOOP;
  SELECT pg_catalog.count(*), pg_catalog.count(DISTINCT (value->>'giver_id')::uuid),
    pg_catalog.count(DISTINCT (value->>'receiver_id')::uuid)
    INTO pair_count, giver_count, receiver_count FROM pg_catalog.jsonb_array_elements(p_pairs);
  IF pair_count <> participant_count OR giver_count <> participant_count OR receiver_count <> participant_count THEN RAISE EXCEPTION 'INVALID_DRAW'; END IF;
  UPDATE public.as_event SET draw_id = new_draw_id, draw_at = pg_catalog.clock_timestamp(), revision = revision + 1 WHERE id = 1;
  INSERT INTO public.as_assignments(giver_id, receiver_id, draw_id)
    SELECT (value->>'giver_id')::uuid, (value->>'receiver_id')::uuid, new_draw_id FROM pg_catalog.jsonb_array_elements(p_pairs);
  RETURN public.as_admin_event();
END;
$$;

CREATE OR REPLACE FUNCTION public.as_draw_results()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.as_event WHERE id = 1 AND draw_id IS NOT NULL) THEN RAISE EXCEPTION 'DRAW_PENDING'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('giver', g.name, 'receiver', r.name)
    ORDER BY g.name, g.id), '[]'::jsonb) INTO result
  FROM public.as_assignments AS a JOIN public.as_participants AS g ON g.id = a.giver_id
  JOIN public.as_participants AS r ON r.id = a.receiver_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.as_reset_draw(p_draw_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.as_event%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.as_event WHERE id = 1 FOR UPDATE;
  IF e.draw_id IS NULL THEN RAISE EXCEPTION 'DRAW_PENDING'; END IF;
  IF e.draw_id IS DISTINCT FROM p_draw_id THEN RAISE EXCEPTION 'STALE_EVENT'; END IF;
  DELETE FROM public.as_assignments WHERE true;
  UPDATE public.as_event SET draw_id = NULL, draw_at = NULL, revision = revision + 1 WHERE id = 1;
  RETURN public.as_admin_event();
END;
$$;

CREATE OR REPLACE FUNCTION public.as_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request_time timestamptz := pg_catalog.clock_timestamp();
  attempt_count integer;
BEGIN
  IF p_key IS NULL OR p_key !~ '^[0-9a-f]{64}$' OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000
    OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  -- Chaves são HMACs: nenhum nome ou IP cru é persistido. Guarda no máximo 48h.
  DELETE FROM public.as_rate_limits WHERE window_started_at < request_time - interval '48 hours';
  INSERT INTO public.as_rate_limits AS stored(key, window_started_at, attempts) VALUES (p_key, request_time, 1)
  ON CONFLICT (key) DO UPDATE SET
    window_started_at = CASE WHEN stored.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= request_time
      THEN request_time ELSE stored.window_started_at END,
    attempts = CASE WHEN stored.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= request_time
      THEN 1 ELSE LEAST(stored.attempts + 1, 10001) END
  RETURNING attempts INTO attempt_count;
  RETURN attempt_count <= p_limit;
END;
$$;

-- v2: preserve existing data/settings, support numeric secrets, names and recovery.
CREATE OR REPLACE FUNCTION public.as_gift_within_limit(p_text text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE matched text[]; raw text; amount numeric;
BEGIN
  FOR matched IN SELECT pg_catalog.regexp_matches(p_text, 'R\$[[:space:]]*([0-9]+([.,][0-9]+)*)', 'gi') LOOP
    raw := matched[1];
    IF raw ~ '^[0-9]{1,3}(\.[0-9]{3})+(,[0-9]{1,2})?$' THEN
      amount := pg_catalog.replace(pg_catalog.replace(raw, '.', ''), ',', '.')::numeric;
    ELSIF raw ~ '^[0-9]+([.,][0-9]{1,2})?$' THEN
      amount := pg_catalog.replace(raw, ',', '.')::numeric;
    ELSE CONTINUE;
    END IF;
    IF amount > 50 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.as_valid_gifts(p_gifts text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(pg_catalog.array_ndims(p_gifts) = 1 AND pg_catalog.cardinality(p_gifts) = 3
    AND (SELECT pg_catalog.count(DISTINCT pg_catalog.lower(public.as_normalize(gift))) = 3
      AND pg_catalog.bool_and(public.as_valid_text(gift, 1, 160) AND public.as_gift_within_limit(gift))
      FROM pg_catalog.unnest(p_gifts) AS g(gift)), false);
$$;
CREATE OR REPLACE FUNCTION public.as_valid_hash(p_hash text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_hash ~ '^scrypt(-v2)?\$32768\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{64}$', false);
$$;
ALTER TABLE public.as_participants ADD COLUMN IF NOT EXISTS code_fingerprint text;
ALTER TABLE public.as_participants DROP CONSTRAINT IF EXISTS as_participants_name_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS as_participants_fingerprint_key ON public.as_participants(code_fingerprint);
-- Original names were unique; keep at most one legacy verifier per name until reset.
CREATE UNIQUE INDEX IF NOT EXISTS as_participants_legacy_name_key ON public.as_participants(name_key) WHERE code_fingerprint IS NULL;
CREATE INDEX IF NOT EXISTS as_participants_name_idx ON public.as_participants(name_key);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.as_participants'::regclass AND conname='as_credential_version') THEN
    ALTER TABLE public.as_participants ADD CONSTRAINT as_credential_version CHECK (
      (code_hash LIKE 'scrypt$%' AND code_fingerprint IS NULL) OR
      (code_hash LIKE 'scrypt-v2$%' AND code_fingerprint IS NOT NULL AND code_fingerprint ~ '^[0-9a-f]{64}$'));
  END IF;
END $$;
-- Existing gifts survive unchanged; revised prices are enforced for future RPC edits/registrations.
CREATE TABLE IF NOT EXISTS public.as_recovery_tokens (
  participant_id uuid PRIMARY KEY REFERENCES public.as_participants(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.as_recovery_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS as_recovery_deny_client ON public.as_recovery_tokens;
CREATE POLICY as_recovery_deny_client ON public.as_recovery_tokens AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON TABLE public.as_recovery_tokens FROM PUBLIC, anon, authenticated, service_role;

-- Remove privileged obsolete entry points rather than retaining bypass overloads.
DROP FUNCTION IF EXISTS public.as_register(text, text[], text);
DROP FUNCTION IF EXISTS public.as_reset_code(uuid, text);
DROP FUNCTION IF EXISTS public.as_find_participant(text);

CREATE OR REPLACE FUNCTION public.as_public_participants()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(pg_catalog.jsonb_agg(name ORDER BY name), '[]'::jsonb) FROM
    (SELECT DISTINCT ON (name_key) name FROM public.as_participants ORDER BY name_key, created_at, id) AS names;
$$;
CREATE OR REPLACE FUNCTION public.as_register(p_name text, p_gifts text[], p_code_hash text, p_fingerprint text, p_code_length integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.as_event%ROWTYPE; clean_name text := public.as_normalize(p_name);
  clean_gifts text[] := public.as_clean_gifts(p_gifts); new_id uuid;
BEGIN
  IF NOT public.as_valid_text(clean_name, 2, 100) OR NOT public.as_valid_gifts(clean_gifts)
    OR NOT public.as_valid_hash(p_code_hash) OR p_code_hash NOT LIKE 'scrypt-v2$%'
    OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_code_length IS NULL OR p_code_length NOT BETWEEN 4 AND 128
    OR pg_catalog.array_ndims(p_gifts) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  SELECT * INTO e FROM public.as_event WHERE id=1 FOR UPDATE;
  IF NOT e.registrations_open OR e.draw_id IS NOT NULL THEN RAISE EXCEPTION 'REGISTRATION_CLOSED'; END IF;
  IF p_code_length = 32 AND EXISTS (SELECT 1 FROM public.as_participants WHERE code_fingerprint IS NULL) THEN RAISE EXCEPTION 'LEGACY_CODE_LENGTH'; END IF;
  IF (SELECT pg_catalog.count(*) FROM public.as_participants) >= 1000 THEN RAISE EXCEPTION 'PARTICIPANT_LIMIT'; END IF;
  INSERT INTO public.as_participants(name,code_hash,code_fingerprint) VALUES(clean_name,p_code_hash,p_fingerprint) RETURNING id INTO new_id;
  INSERT INTO public.as_gifts(participant_id,position,description)
    SELECT new_id,position,gift FROM pg_catalog.unnest(clean_gifts) WITH ORDINALITY AS g(gift,position);
  UPDATE public.as_event SET revision=revision+1 WHERE id=1;
  RETURN new_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_CODE';
END;
$$;
CREATE OR REPLACE FUNCTION public.as_find_participant(p_name text, p_fingerprint text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object('name_key', pg_catalog.lower(public.as_normalize(p_name)), 'candidates',
    COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',p.id,'code_hash',p.code_hash))
      FROM public.as_participants p WHERE p.name_key=pg_catalog.lower(public.as_normalize(p_name))
      AND (p.code_fingerprint=p_fingerprint OR p.code_fingerprint IS NULL)), '[]'::jsonb));
$$;
CREATE OR REPLACE FUNCTION public.as_issue_recovery(p_id uuid, p_token_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE participant_name text;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  PERFORM id FROM public.as_event WHERE id=1 FOR UPDATE;
  SELECT name INTO participant_name FROM public.as_participants WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  INSERT INTO public.as_recovery_tokens(participant_id,token_hash,expires_at)
    VALUES(p_id,p_token_hash,pg_catalog.clock_timestamp()+interval '30 minutes')
    ON CONFLICT(participant_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at;
  RETURN participant_name;
END;
$$;
CREATE OR REPLACE FUNCTION public.as_redeem_recovery(p_token_hash text, p_code_hash text, p_fingerprint text, p_code_length integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE person_id uuid; participant_name text;
BEGIN
  IF NOT public.as_valid_hash(p_code_hash) OR p_code_hash NOT LIKE 'scrypt-v2$%'
    OR p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_code_length IS NULL OR p_code_length NOT BETWEEN 4 AND 128 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  PERFORM id FROM public.as_event WHERE id=1 FOR UPDATE;
  SELECT participant_id INTO person_id FROM public.as_recovery_tokens
    WHERE token_hash=p_token_hash AND expires_at>pg_catalog.clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_RECOVERY'; END IF;
  IF p_code_length = 32 AND EXISTS (SELECT 1 FROM public.as_participants WHERE code_fingerprint IS NULL) THEN RAISE EXCEPTION 'LEGACY_CODE_LENGTH'; END IF;
  -- Even reusing one's current code is rejected: every chosen code must be unused.
  IF EXISTS (SELECT 1 FROM public.as_participants WHERE code_fingerprint=p_fingerprint) THEN RAISE EXCEPTION 'DUPLICATE_CODE'; END IF;
  UPDATE public.as_participants SET code_hash=p_code_hash,code_fingerprint=p_fingerprint WHERE id=person_id RETURNING name INTO participant_name;
  DELETE FROM public.as_recovery_tokens WHERE participant_id=person_id;
  UPDATE public.as_event SET revision=revision+1 WHERE id=1;
  RETURN participant_name;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_CODE';
END;
$$;
CREATE OR REPLACE FUNCTION public.as_clear_database(p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.as_event%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.as_event WHERE id=1 FOR UPDATE;
  IF p_revision IS NULL OR e.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STALE_EVENT'; END IF;
  DELETE FROM public.as_assignments WHERE true;
  DELETE FROM public.as_recovery_tokens WHERE true;
  DELETE FROM public.as_gifts WHERE true;
  DELETE FROM public.as_participants WHERE true;
  UPDATE public.as_event SET draw_id=NULL,draw_at=NULL,registrations_open=true,revision=revision+1 WHERE id=1;
  RETURN public.as_admin_event();
END;
$$;

-- PostgreSQL concede EXECUTE a PUBLIC por padrão. Revogação na mesma transação
-- evita uma janela em que RPCs privilegiadas ficariam públicas.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN SELECT p.oid::pg_catalog.regprocedure AS signature
    FROM pg_catalog.pg_proc AS p JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY['as_admin_event', 'as_check_three_gifts', 'as_clean_gifts', 'as_clear_database', 'as_commit_draw', 'as_delete_participant', 'as_draw_results', 'as_edit_participant', 'as_find_participant', 'as_gift_within_limit', 'as_issue_recovery', 'as_normalize', 'as_participants', 'as_public_event', 'as_public_participants', 'as_rate_limit', 'as_redeem_recovery', 'as_register', 'as_reset_code', 'as_reset_draw', 'as_reveal', 'as_update_event', 'as_valid_gifts', 'as_valid_hash', 'as_valid_text'])
  LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', fn.signature);
  END LOOP;
END;
$$;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.as_public_event(), public.as_admin_event(), public.as_participants(),
  public.as_public_participants(), public.as_register(text,text[],text,text,integer),
  public.as_edit_participant(uuid,text,text[]), public.as_delete_participant(uuid),
  public.as_find_participant(text,text), public.as_reveal(uuid,text),
  public.as_issue_recovery(uuid,text), public.as_redeem_recovery(text,text,text,integer), public.as_clear_database(bigint),
  public.as_update_event(text,text,text,date,boolean,bigint), public.as_commit_draw(jsonb,bigint),
  public.as_draw_results(), public.as_reset_draw(uuid), public.as_rate_limit(text,integer,integer)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
