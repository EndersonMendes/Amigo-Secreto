import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PartyService } from "../src/lib/service";
import { hashCode, recoveryHash, codeFingerprint } from "../src/lib/codes";
import { testRpc } from "./helpers/rpc";
import { startTestDatabase, nativePostgres, type TestDatabase } from "./helpers/postgres";
const SECRET = "b".repeat(64);
const GIFTS = ["Livro R$50", "Café R$50,00", "Meias R$50.00"];
const HASH = `scrypt-v2$32768$8$1$${"a".repeat(32)}$${"b".repeat(64)}`;

describe("migração do original sem perda de dados", () => {
  let db: TestDatabase;
  beforeAll(async () => { db = await startTestDatabase("tests/fixtures/schema-v1.sql"); });
  afterAll(async () => { await db?.stop(); });
  it("aplica duas vezes, preserva dados, configurações, Auth, resultados e códigos legados", async () => {
    const rpc = testRpc(() => db);
    const oldCode = "11111111-11111111-11111111-11111111";
    const hash = await hashCode(oldCode);
    const id = await rpc.call<string>("as_register", { p_name: "Ana", p_gifts: ["Produto antigo R$99", "Café", "Meias"], p_code_hash: hash });
    const other = await rpc.call<string>("as_register", { p_name: "Bruno", p_gifts: GIFTS, p_code_hash: await hashCode("AAAAAAAA-AAAAAAAA-AAAAAAAA-AAAAAAAA") });
    await db.pool.query("CREATE SCHEMA auth; CREATE TABLE auth.users(id text PRIMARY KEY); INSERT INTO auth.users VALUES('admin-preserved'); CREATE FUNCTION public.unrelated_function() RETURNS int LANGUAGE sql AS 'SELECT 7'; GRANT EXECUTE ON FUNCTION public.unrelated_function() TO anon;");
    const event = await rpc.call<{ revision: number }>("as_admin_event");
    const closed = await rpc.call<{ revision: number }>("as_update_event", { p_name: "Festa especial", p_intro: "Texto personalizado", p_home_text: "Mensagem original", p_event_date: "2026-12-20", p_open: false, p_revision: event.revision });
    await rpc.call("as_commit_draw", { p_pairs: [{ giver_id: id, receiver_id: other }, { giver_id: other, receiver_id: id }], p_revision: closed.revision });
    const before = await rpc.call("as_admin_event");
    const migration = await readFile("supabase/migrations/20261031_numeric_codes_and_clear.sql", "utf8");
    await db.pool.query(migration);
    await db.pool.query(migration);
    const service = new PartyService(rpc, "a".repeat(64), SECRET);
    expect(await service.adminEvent()).toEqual(before);
    expect((await service.participants())[0]).toMatchObject({ id, gifts: ["Produto antigo R$99", "Café", "Meias"] });
    expect((await db.pool.query("SELECT * FROM auth.users")).rows).toEqual([{ id: "admin-preserved" }]);
    expect((await db.pool.query("SELECT has_function_privilege('anon','public.unrelated_function()','execute') AS allowed")).rows[0].allowed).toBe(true);
    expect(await service.reveal({ name: "ana", code: oldCode })).toEqual({ name: "Bruno", gifts: GIFTS });
    expect(await service.reveal({ name: "Bruno", code: "aaaaaaaa aaaaaaaa aaaaaaaa aaaaaaaa" })).toEqual({ name: "Ana", gifts: ["Produto antigo R$99", "Café", "Meias"] });
    for (const signature of ["public.as_register(text,text[],text)", "public.as_reset_code(uuid,text)", "public.as_find_participant(text)"])
      expect((await db.pool.query("SELECT to_regprocedure($1) AS fn", [signature])).rows[0].fn).toBeNull();
    const privileges = await db.pool.query("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname LIKE 'as\\_%' ESCAPE '\\' AND (has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute'))");
    expect(privileges.rows).toEqual([]);
    const recovery = await service.resetCode({ id });
    await expect(service.redeemCode({ token: recovery.token, code: "1".repeat(32) })).rejects.toMatchObject({ code: "LEGACY_CODE_LENGTH" });
    await service.redeemCode({ token: recovery.token, code: "0011" });
    await expect(service.reveal({ name: "Ana", code: oldCode })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(await service.reveal({ name: "Ana", code: "0011" })).toEqual({ name: "Bruno", gifts: GIFTS });
    const drawn = await service.adminEvent();
    const reset = await service.resetDraw({ confirmation: "REINICIAR SORTEIO", draw_id: drawn.draw_id });
    await service.updateEvent({ name: reset.name, intro: reset.intro, home_text: reset.home_text, event_date: reset.event_date, registrations_open: true, revision: reset.revision });
    await expect(service.register({ name: "Carla", code: "2".repeat(32), gifts: GIFTS })).rejects.toMatchObject({ code: "LEGACY_CODE_LENGTH" });
    const current = await service.adminEvent();
    await service.clearDatabase({ confirmation: "LIMPAR BASE DE DADOS", revision: current.revision });
    expect((await db.pool.query("SELECT * FROM auth.users")).rows).toEqual([{ id: "admin-preserved" }]);
    expect(await service.register({ name: "Carla", code: "2".repeat(32), gifts: GIFTS })).toEqual({ name: "Carla" });

  });
});

describe("novo ciclo e recuperação transacionais", () => {
  let db: TestDatabase;
  let service: PartyService;
  beforeAll(async () => { db = await startTestDatabase(); service = new PartyService(testRpc(() => db), "a".repeat(64), SECRET); });
  afterAll(async () => { await db?.stop(); });
  beforeEach(async () => {
    const e = await service.adminEvent();
    await service.clearDatabase({ confirmation: "LIMPAR BASE DE DADOS", revision: e.revision });
    await db.pool.query("DELETE FROM public.as_rate_limits");
  });
  async function drawTwo() {
    await service.register({ name: "Ana", code: "0012", gifts: GIFTS });
    await service.register({ name: "Bruno", code: "987654", gifts: GIFTS });
    const e = await service.adminEvent();
    const c = await service.updateEvent({ name: "Festa persistida", intro: "Texto personalizado", home_text: "Bem-vindos!", event_date: "2026-12-25", registrations_open: false, revision: e.revision });
    return service.draw({ confirmation: "REALIZAR SORTEIO", revision: c.revision });
  }
  it("permite homônimos, só publica nomes distintos e autentica por nome + código", async () => {
    await service.register({ name: "José Silva", code: "0001", gifts: GIFTS });
    await service.register({ name: " JOSE\u0301 SILVA ", code: "0002", gifts: ["Chocolate", "Camisa", "Caneca"] });
    expect(await service.publicParticipants()).toEqual(["José Silva"]);
    const list = await service.participants();
    expect(list).toHaveLength(2);
    expect(JSON.stringify(list)).not.toMatch(/code|fingerprint|scrypt|token/);
    const e = await service.adminEvent();
    const c = await service.updateEvent({ name: e.name, intro: e.intro, home_text: e.home_text, event_date: e.event_date, registrations_open: false, revision: e.revision });
    await service.draw({ confirmation: "REALIZAR SORTEIO", revision: c.revision });
    expect((await service.reveal({ name: "José Silva", code: "0001" })).gifts).toEqual(["Chocolate", "Camisa", "Caneca"]);
    expect((await service.reveal({ name: "JOSÉ SILVA", code: "0002" })).gifts).toEqual(GIFTS);
    await expect(service.reveal({ name: "José Silva", code: "0003" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("reserva códigos globalmente e aceita zeros iniciais e 128 dígitos", async () => {
    await service.register({ name: "Ana", code: "0012", gifts: GIFTS });
    await expect(service.register({ name: "Bruno", code: "0012", gifts: GIFTS })).rejects.toMatchObject({ code: "DUPLICATE_CODE" });
    await service.register({ name: "Bruno", code: "00012", gifts: GIFTS });
    await service.register({ name: "Carla", code: "9".repeat(128), gifts: GIFTS });
    const values = (await db.pool.query("SELECT code_hash,code_fingerprint FROM public.as_participants")).rows;
    expect(values.every(v => v.code_hash.startsWith("scrypt-v2$") && /^[a-f0-9]{64}$/.test(v.code_fingerprint))).toBe(true);
    expect(values[0].code_fingerprint).toBe(codeFingerprint("0012", SECRET));
  });
  it("recovery é hash-only, 30min, substituível, uso único, sem alterar código antes de resgate", async () => {
    await drawTwo();
    const person = (await service.participants()).find(p => p.name === "Ana")!;
    const a = await service.resetCode({ id: person.id });
    expect(Object.keys(a).sort()).toEqual(["name", "token"]);
    expect(a.token).toMatch(/^[a-f0-9]{64}$/);
    const stored = (await db.pool.query("SELECT token_hash,extract(epoch FROM expires_at-clock_timestamp()) AS seconds FROM public.as_recovery_tokens")).rows[0];
    expect(stored.token_hash).toBe(recoveryHash(a.token));
    expect(Number(stored.seconds)).toBeGreaterThan(1790);
    expect(Number(stored.seconds)).toBeLessThanOrEqual(1800);
    expect((await service.reveal({ name: "Ana", code: "0012" })).name).toBe("Bruno");
    const b = await service.resetCode({ id: person.id });
    await expect(service.redeemCode({ token: a.token, code: "7777" })).rejects.toMatchObject({ code: "INVALID_RECOVERY" });
    await expect(service.redeemCode({ token: b.token, code: "987654" })).rejects.toMatchObject({ code: "DUPLICATE_CODE" });
    expect(await service.redeemCode({ token: b.token, code: "7777" })).toEqual({ name: "Ana" });
    await expect(service.redeemCode({ token: b.token, code: "8888" })).rejects.toMatchObject({ code: "INVALID_RECOVERY" });
    await expect(service.reveal({ name: "Ana", code: "0012" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect((await service.reveal({ name: "Ana", code: "7777" })).name).toBe("Bruno");
    const c = await service.resetCode({ id: person.id });
    await db.pool.query("UPDATE public.as_recovery_tokens SET expires_at=clock_timestamp()-interval '1 second'");
    await expect(service.redeemCode({ token: c.token, code: "8888" })).rejects.toMatchObject({ code: "INVALID_RECOVERY" });
  });
  it("limpeza exige revisão/confirmation, preserva configuração e rate limits, apaga todo ciclo e permite novo sorteio", async () => {
    const e = await drawTwo();
    const person = (await service.participants())[0];
    const recovery = await service.resetCode({ id: person.id });
    await service.limit("kept", "counter", 1, 900);
    expect(() => service.clearDatabase({ confirmation: "wrong", revision: e.revision })).toThrow();
    await expect(service.clearDatabase({ confirmation: "LIMPAR BASE DE DADOS", revision: e.revision - 1 })).rejects.toMatchObject({ code: "STALE_EVENT" });
    const cleared = await service.clearDatabase({ confirmation: "LIMPAR BASE DE DADOS", revision: e.revision });
    expect(cleared).toEqual({ ...e, draw_id: null, draw_at: null, draw_completed: false, participant_count: 0, registrations_open: true, revision: e.revision + 1 });
    for (const table of ["as_participants", "as_gifts", "as_assignments", "as_recovery_tokens"])
      expect((await db.pool.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n).toBe(0);
    await expect(service.limit("kept", "counter", 1, 900)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(service.redeemCode({ token: recovery.token, code: "6666" })).rejects.toMatchObject({ code: "INVALID_RECOVERY" });
    await expect(service.reveal({ name: "Ana", code: "0012" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(service.clearDatabase({ confirmation: "LIMPAR BASE DE DADOS", revision: e.revision })).rejects.toMatchObject({ code: "STALE_EVENT" });
    const newDraw = await drawTwo();
    expect(newDraw.draw_id).not.toBe(e.draw_id);
    expect((await service.reveal({ name: "Ana", code: "0012" })).name).toBe("Bruno");
  });
  it("falha injetada após DELETE reverte participantes, presentes, códigos, tokens, resultados e evento", async () => {
    const e = await drawTwo();
    const person = (await service.participants())[0];
    await service.resetCode({ id: person.id });
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      for (const table of ["as_event", "as_participants", "as_gifts", "as_assignments", "as_recovery_tokens", "as_rate_limits"])
        result[table] = (await db.pool.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS data FROM public.${table} t`)).rows[0].data;
      return result;
    };
    const before = await snapshot();
    await db.pool.query("CREATE FUNCTION public.fail_clear_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER fail_clear BEFORE UPDATE ON public.as_event FOR EACH ROW EXECUTE FUNCTION public.fail_clear_test();");
    try { await expect(service.clearDatabase({ confirmation: "LIMPAR BASE DE DADOS", revision: e.revision })).rejects.toMatchObject({ code: "UNAVAILABLE" }); }
    finally { await db.pool.query("DROP TRIGGER fail_clear ON public.as_event; DROP FUNCTION public.fail_clear_test();"); }
    expect(await snapshot()).toEqual(before);
  });
  it("exclusão individual invalida token e edições aplicam limite de presente", async () => {
    await service.register({ name: "Ana", code: "1234", gifts: GIFTS });
    const person = (await service.participants())[0];
    const recovery = await service.resetCode({ id: person.id });
    await expect(service.editParticipant({ action: "edit", id: person.id, name: "Ana", gifts: ["Livro R$50,01", "Café", "Meias"] })).rejects.toThrow();
    await service.editParticipant({ action: "delete", id: person.id });
    await expect(service.redeemCode({ token: recovery.token, code: "4321" })).rejects.toMatchObject({ code: "INVALID_RECOVERY" });
  });
  it("RPCs rejeitam preços explícitos acima do limite sem depender do navegador", async () => {
    const rpc = testRpc(() => db);
    for (const price of ["50,01", "50.01", "51", "1.000", "1.000,00"])
      await expect(rpc.call("as_register", { p_name: "Ana", p_gifts: [`Livro R$${price}`, "Café", "Meias"], p_code_hash: HASH, p_fingerprint: "0".repeat(64), p_code_length: 4 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await service.adminEvent()).participant_count).toBe(0);
  });
  it.skipIf(!nativePostgres)("limpeza bloqueia revelação antiga e só uma redenção concorrente pode vencer", async () => {
    const e = await drawTwo();
    const person = (await service.participants())[0];
    const issued = await service.resetCode({ id: person.id });
    const attempts = await Promise.allSettled([
      service.redeemCode({ token: issued.token, code: "1111" }),
      service.redeemCode({ token: issued.token, code: "2222" }),
    ]);
    expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(a => a.status === "rejected")).toHaveLength(1);
    const hash = (await db.pool.query("SELECT code_hash FROM public.as_participants WHERE id=$1", [person.id])).rows[0].code_hash;
    const clearing = await db.pool.connect();
    const waiting = await db.pool.connect();
    try {
      await clearing.query("BEGIN");
      const revision = (await service.adminEvent()).revision;
      await clearing.query("SELECT public.as_clear_database($1)", [revision]);
      const pid = (await waiting.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      const reveal = waiting.query("SELECT public.as_reveal($1,$2) AS value", [person.id, hash]);
      const deadline = Date.now() + 3000;
      let locked = false;
      while (Date.now() < deadline) {
        if ((await db.pool.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0].wait_event_type === "Lock") { locked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(locked).toBe(true);
      await clearing.query("COMMIT");
      expect((await reveal).rows[0].value).toBeNull();
      expect((await service.adminEvent()).revision).toBeGreaterThan(e.revision);
    } finally {
      await clearing.query("ROLLBACK");
      clearing.release(); waiting.release();
    }
  });
  it.skipIf(!nativePostgres)("duas conexões reservando o mesmo código só confirmam uma inscrição", async () => {
    const result = await Promise.allSettled([service.register({ name: "Ana", code: "5555", gifts: GIFTS }), service.register({ name: "Bruno", code: "5555", gifts: GIFTS })]);
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter(r => r.status === "rejected")).toHaveLength(1);
    expect((await service.adminEvent()).participant_count).toBe(1);
  });
});
