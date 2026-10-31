-- Apply to the original schema, in place. Safe to run repeatedly.
BEGIN;
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
  DELETE FROM public.as_assignments;
  DELETE FROM public.as_recovery_tokens;
  DELETE FROM public.as_gifts;
  DELETE FROM public.as_participants;
  UPDATE public.as_event SET draw_id=NULL,draw_at=NULL,registrations_open=true,revision=revision+1 WHERE id=1;
  RETURN public.as_admin_event();
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
