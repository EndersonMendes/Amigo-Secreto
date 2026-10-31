import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  startTestDatabase,
  nativePostgres,
  type TestDatabase,
  type TestClient as PoolClient,
} from "./helpers/postgres";

const HASH_A = `scrypt-v2$32768$8$1$${"a".repeat(32)}$${"b".repeat(64)}`;
const HASH_B = `scrypt-v2$32768$8$1$${"c".repeat(32)}$${"d".repeat(64)}`;
const fingerprint = (name: string) => createHash("sha256").update(name.normalize("NFC").trim().replace(/\s+/gu," ").toLowerCase()).digest("hex");
const GIFTS = ["Livro", "Chocolate", "Caneca"];
type Event = {
  revision: number;
  registrations_open: boolean;
  draw_completed: boolean;
  draw_id: string | null;
  participant_count: number;
};

describe("PostgreSQL real: contratos, concorrência e permissões", () => {
  let db: TestDatabase;

  async function rpc<T = unknown>(
    name: string,
    parameters: unknown[] = [],
    client?: PoolClient,
  ): Promise<T> {
    const connection = client ?? (await db.pool.connect());
    try {
      if (!client) await connection.query("SET ROLE service_role");
      const placeholders = parameters
        .map((_, index) => `$${index + 1}`)
        .join(",");
      return (
        await connection.query(
          `SELECT public.${name}(${placeholders}) AS value`,
          parameters,
        )
      ).rows[0].value as T;
    } finally {
      if (!client) {
        await connection.query("RESET ROLE");
        connection.release();
      }
    }
  }
  const event = () => rpc<Event>("as_admin_event");
  const register = (name: string, gifts = GIFTS, hash = HASH_A) =>
    rpc<string>("as_register", [name, gifts, hash, fingerprint(name), 4]);
  async function setOpen(open: boolean, revision?: number) {
    return rpc<Event>("as_update_event", [
      "Natal",
      "Introdução",
      "Boas festas!",
      "2026-12-25",
      open,
      revision ?? (await event()).revision,
    ]);
  }
  async function prepareDraw() {
    const ids = [
      await register("Ana"),
      await register("Bruno"),
      await register("Carla"),
    ];
    await setOpen(false);
    const pairs = [
      { giver_id: ids[0], receiver_id: ids[1] },
      { giver_id: ids[1], receiver_id: ids[2] },
      { giver_id: ids[2], receiver_id: ids[0] },
    ];
    return { ids, pairs, revision: (await event()).revision };
  }
  const commit = (pairs: unknown, revision: number, client?: PoolClient) =>
    rpc<Event>("as_commit_draw", [JSON.stringify(pairs), revision], client);
  async function waitForDatabaseLock(pid: number) {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      const activity = await db.pool.query(
        "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
        [pid],
      );
      if (activity.rows[0]?.wait_event_type === "Lock") return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(
      `A sessão PostgreSQL ${pid} não chegou ao bloqueio concorrente esperado.`,
    );
  }

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 120_000);
  afterAll(async () => {
    await db?.stop();
  }, 30_000);
  beforeEach(async () => {
    const existing = await db.pool.query(
      "SELECT to_regclass('public.as_event') AS table_name",
    );
    if (!existing.rows[0].table_name) return;
    await db.pool
      .query(`TRUNCATE public.as_assignments, public.as_gifts, public.as_participants, public.as_recovery_tokens, public.as_rate_limits;
      UPDATE public.as_event SET name='Amigo Secreto de Natal', intro='Celebre com a gente', home_text='Boas festas!',
      event_date=NULL, registrations_open=true, draw_id=NULL, draw_at=NULL, revision=0 WHERE id=1;`);
  });

  it("instala o contrato RPC privado em PostgreSQL", async () => {
    const result = await db.pool.query(
      "SELECT to_regprocedure('public.as_register(text,text[],text,text,integer)')::text AS signature",
    );
    expect(result.rows[0].signature).toBe("as_register(text,text[],text,text,integer)");
  });

  it("normaliza nomes NFC/espaços e permite homônimos e mantém nomes canônicos", async () => {
    const id = await register("  Jose\u0301\u00a0 da  Silva  ");
    await expect(register("JOSÉ DA SILVA")).rejects.toThrow("DUPLICATE_CODE");
    expect(await rpc("as_find_participant", [" joSE\u0301 da Silva ", fingerprint("José da Silva")])).toEqual(
      { name_key: "josé da silva", candidates: [{ id, code_hash: HASH_A }] },
    );
    const participants =
      await rpc<{ name: string; gifts: string[]; code_hash?: string }[]>(
        "as_participants",
      );
    expect(participants).toHaveLength(1);
    expect(participants[0].name).toBe("José da Silva");
    expect(participants[0].gifts).toEqual(GIFTS);
    expect(participants[0]).not.toHaveProperty("code_hash");
  });

  it.each([
    ["", GIFTS, HASH_A],
    ["A", GIFTS, HASH_A],
    ["x".repeat(101), GIFTS, HASH_A],
    ["Ana", ["Livro", "Chocolate"], HASH_A],
    ["Ana", ["Livro", "", "Caneca"], HASH_A],
    ["Ana", ["Livro", " livro ", "Caneca"], HASH_A],
    ["Ana", ["a".repeat(161), "B", "C"], HASH_A],
    ["Ana", GIFTS, "plaintext-secret"],
    ["Ana", ["Cafe\u0301", "CAFÉ", "Caneca"], HASH_A],
  ])(
    "rejeita entrada inválida no próprio banco (%s)",
    async (name, gifts, hash) => {
      await expect(
        register(name as string, gifts as string[], hash as string),
      ).rejects.toThrow("INVALID_INPUT");
      expect((await event()).participant_count).toBe(0);
    },
  );

  it("normaliza presentes e não publica nomes nem hashes no evento público", async () => {
    await register("Ana", ["  Livro\nnovo ", "Cafe\u0301", "Meias"]);
    const publicEvent = await rpc<Record<string, unknown>>("as_public_event");
    expect(publicEvent.participant_count).toBe(1);
    expect(publicEvent).not.toHaveProperty("revision");
    expect(publicEvent).not.toHaveProperty("draw_id");
    expect(JSON.stringify(publicEvent)).not.toContain("Ana");
    expect(JSON.stringify(publicEvent)).not.toContain(HASH_A);
    expect(
      (await rpc<{ gifts: string[] }[]>("as_participants"))[0].gifts,
    ).toEqual(["Livro novo", "Café", "Meias"]);
  });

  it("fecha inscrições, valida a revisão e rejeita inscrição posterior", async () => {
    await register("Ana");
    await expect(setOpen(false, 0)).rejects.toThrow("STALE_EVENT");
    await setOpen(false);
    await expect(register("Bruno")).rejects.toThrow("REGISTRATION_CLOSED");
    await expect(
      rpc("as_update_event", [
        "",
        "",
        "",
        null,
        true,
        (await event()).revision,
      ]),
    ).rejects.toThrow("INVALID_INPUT");
  });

  it.skipIf(!nativePostgres)(
    "serializa inscrição bloqueada atrás do encerramento",
    async () => {
      const closer = await db.pool.connect();
      const waiting = await db.pool.connect();
      try {
        const pid = (await waiting.query("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid as number;
        await closer.query("BEGIN");
        await closer.query(
          "SELECT id FROM public.as_event WHERE id=1 FOR UPDATE",
        );
        const registering = rpc(
          "as_register",
          ["Bruno", GIFTS, HASH_A, fingerprint("Bruno"), 4],
          waiting,
        ).then(
          () => "unexpected-success",
          (error) => error.message,
        );
        await waitForDatabaseLock(pid);
        await rpc(
          "as_update_event",
          ["Natal", "Introdução", "Boas festas!", null, false, 0],
          closer,
        );
        await closer.query("COMMIT");
        expect(await registering).toBe("REGISTRATION_CLOSED");
        expect((await event()).participant_count).toBe(0);
      } finally {
        await closer.query("ROLLBACK");
        closer.release();
        waiting.release();
      }
    },
  );

  it.skipIf(!nativePostgres)(
    "inscrição confirmada primeiro torna o encerramento antigo obsoleto",
    async () => {
      const registering = await db.pool.connect();
      const waiting = await db.pool.connect();
      try {
        const pid = (await waiting.query("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid as number;
        await registering.query("BEGIN");
        await rpc("as_register", ["Ana", GIFTS, HASH_A, fingerprint("Ana"), 4], registering);
        const closing = rpc(
          "as_update_event",
          ["Natal", "Introdução", "Boas festas!", null, false, 0],
          waiting,
        ).then(
          () => "unexpected-success",
          (error) => error.message,
        );
        await waitForDatabaseLock(pid);
        await registering.query("COMMIT");
        expect(await closing).toBe("STALE_EVENT");
        expect((await event()).registrations_open).toBe(true);
      } finally {
        await registering.query("ROLLBACK");
        registering.release();
        waiting.release();
      }
    },
  );

  it("aceita uma única inscrição concorrente para o mesmo fingerprint", async () => {
    const attempts = await Promise.allSettled([
      register("Ana"),
      register(" ANA "),
      register("ana"),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.status === "rejected"),
    ).toHaveLength(2);
    expect((await event()).participant_count).toBe(1);
  });

  it("impede sorteio com inscrições abertas ou menos de duas pessoas", async () => {
    await expect(commit([], 0)).rejects.toThrow("REGISTRATION_OPEN");
    await register("Ana");
    await setOpen(false);
    await expect(commit([], (await event()).revision)).rejects.toThrow(
      "TOO_FEW_PARTICIPANTS",
    );
    await expect(rpc("as_draw_results")).rejects.toThrow("DRAW_PENDING");
  });

  it("sorteia duas pessoas com troca obrigatória e sugestões em tabela própria", async () => {
    const ana = await register("Ana");
    const bruno = await register("Bruno");
    await setOpen(false);
    await commit(
      [
        { giver_id: ana, receiver_id: bruno },
        { giver_id: bruno, receiver_id: ana },
      ],
      (await event()).revision,
    );
    expect(await rpc("as_reveal", [ana, HASH_A])).toEqual({
      name: "Bruno",
      gifts: GIFTS,
    });
    expect(await rpc("as_reveal", [bruno, HASH_A])).toEqual({
      name: "Ana",
      gifts: GIFTS,
    });
    expect(
      (
        await db.pool.query(
          "SELECT count(*)::int AS count FROM public.as_gifts",
        )
      ).rows[0].count,
    ).toBe(6);
  });

  it("rejeita controles invisíveis restantes no nome e nas sugestões", async () => {
    await expect(register("Ana\u0001")).rejects.toThrow("INVALID_INPUT");
    await expect(
      register("Ana", ["Livro\u0007", "Caneca", "Chocolate"]),
    ).rejects.toThrow("INVALID_INPUT");
  });

  it("rejeita pares incompletos, repetidos, próprios, externos e formato inválido sem gravar", async () => {
    const { ids, pairs, revision } = await prepareDraw();
    const invalid = [
      pairs.slice(0, 2),
      [...pairs, pairs[0]],
      [{ giver_id: ids[0], receiver_id: ids[0] }, pairs[1], pairs[2]],
      [pairs[0], { giver_id: ids[1], receiver_id: ids[0] }, pairs[2]],
      [
        {
          giver_id: "00000000-0000-4000-8000-000000000000",
          receiver_id: ids[1],
        },
        pairs[1],
        pairs[2],
      ],
      [{ giver_id: "invalid", receiver_id: ids[1] }, pairs[1], pairs[2]],
      { pairs },
      null,
    ];
    for (const value of invalid)
      await expect(commit(value, revision)).rejects.toThrow("INVALID_DRAW");
    expect(
      (
        await db.pool.query(
          "SELECT count(*)::int AS count FROM public.as_assignments",
        )
      ).rows[0].count,
    ).toBe(0);
    expect((await event()).draw_completed).toBe(false);
  });

  it("confirma uma bijeção integral, revela somente o destinatário e bloqueia alterações", async () => {
    const { ids, pairs, revision } = await prepareDraw();
    const drawn = await commit(pairs, revision);
    expect(drawn.draw_completed).toBe(true);
    expect(drawn.draw_id).toMatch(/^[\da-f-]{36}$/);
    expect(await rpc("as_reveal", [ids[0], HASH_A])).toEqual({
      name: "Bruno",
      gifts: GIFTS,
    });
    expect(await rpc("as_reveal", [ids[0], HASH_B])).toBeNull();
    expect(await rpc("as_draw_results")).toEqual([
      { giver: "Ana", receiver: "Bruno" },
      { giver: "Bruno", receiver: "Carla" },
      { giver: "Carla", receiver: "Ana" },
    ]);
    await expect(
      rpc("as_edit_participant", [ids[0], "Anabela", GIFTS]),
    ).rejects.toThrow("DRAW_EXISTS");
    await expect(rpc("as_delete_participant", [ids[0]])).rejects.toThrow(
      "DRAW_EXISTS",
    );
    await expect(setOpen(true)).rejects.toThrow("DRAW_EXISTS");
    await expect(commit(pairs, drawn.revision)).rejects.toThrow("DRAW_EXISTS");
  });

  it("revalida o hash atual ao revelar após redefinição de código", async () => {
    const { ids, pairs, revision } = await prepareDraw();
    await commit(pairs, revision);
    const oldLookup = await rpc<{ candidates: { id: string; code_hash: string }[] }>(
      "as_find_participant",
      ["Ana", fingerprint("Ana")],
    );
    const oldRevision = (await event()).revision;
    expect(await rpc("as_issue_recovery", [ids[0], "a".repeat(64)])).toBe("Ana");
    expect(await rpc("as_redeem_recovery", ["a".repeat(64), HASH_B, "b".repeat(64), 4])).toBe("Ana");
    expect((await event()).revision).toBe(oldRevision + 1);
    expect(
      await rpc("as_reveal", [oldLookup.candidates[0].id, oldLookup.candidates[0].code_hash]),
    ).toBeNull();
    expect(await rpc("as_reveal", [ids[0], HASH_B])).toEqual({
      name: "Bruno",
      gifts: GIFTS,
    });
  });

  it.skipIf(!nativePostgres)(
    "confirma apenas uma de duas transações de sorteio concorrentes",
    async () => {
      const { pairs, revision } = await prepareDraw();
      const first = await db.pool.connect();
      const waiting = await db.pool.connect();
      try {
        const pid = (await waiting.query("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid as number;
        await first.query("BEGIN");
        const committed = await commit(pairs, revision, first);
        const second = commit(pairs, revision, waiting).then(
          () => "unexpected-success",
          (error) => error.message,
        );
        await waitForDatabaseLock(pid);
        await first.query("COMMIT");
        expect(await second).toBe("DRAW_EXISTS");
        expect((await event()).draw_id).toBe(committed.draw_id);
        expect(
          (
            await db.pool.query(
              "SELECT count(*)::int AS count FROM public.as_assignments",
            )
          ).rows[0].count,
        ).toBe(3);
      } finally {
        await first.query("ROLLBACK");
        first.release();
        waiting.release();
      }
    },
  );

  it("uma edição concorrente invalida o conjunto de participantes já calculado", async () => {
    const { ids, pairs, revision } = await prepareDraw();
    await rpc("as_edit_participant", [ids[0], "Anabela", GIFTS]);
    await expect(commit(pairs, revision)).rejects.toThrow("STALE_EVENT");
    await rpc("as_delete_participant", [ids[2]]);
    expect((await event()).participant_count).toBe(2);
    await expect(rpc("as_delete_participant", [ids[2]])).rejects.toThrow(
      "NOT_FOUND",
    );
  });

  it("reinicia apenas a rodada atual, preserva participantes/códigos e invalida confirmações antigas", async () => {
    const { ids, pairs, revision } = await prepareDraw();
    const drawn = await commit(pairs, revision);
    await expect(
      rpc("as_reset_draw", ["00000000-0000-4000-8000-000000000000"]),
    ).rejects.toThrow("STALE_EVENT");
    const reset = await rpc<Event>("as_reset_draw", [drawn.draw_id]);
    expect(reset.draw_completed).toBe(false);
    expect(reset.participant_count).toBe(3);
    expect(reset.registrations_open).toBe(false);
    expect(await rpc("as_find_participant", ["Ana", fingerprint("Ana")])).toEqual({
      name_key: "ana", candidates: [{ id: ids[0], code_hash: HASH_A }],
    });
    await expect(rpc("as_reveal", [ids[0], HASH_A])).rejects.toThrow(
      "DRAW_PENDING",
    );
    await expect(commit(pairs, revision)).rejects.toThrow("STALE_EVENT");
    const nextDraw = await commit(pairs, reset.revision);
    expect(nextDraw.draw_id).not.toBe(drawn.draw_id);
    await expect(rpc("as_reset_draw", [drawn.draw_id])).rejects.toThrow(
      "STALE_EVENT",
    );
  });

  it("impõe o limite operacional de mil participantes dentro da transação", async () => {
    await db.pool.query(
      `WITH added AS (INSERT INTO public.as_participants(name, code_hash, code_fingerprint)
      SELECT 'Pessoa ' || n, $2, lpad(n::text,64,'0') FROM generate_series(1, 1000) n RETURNING id)
      INSERT INTO public.as_gifts(participant_id, position, description)
      SELECT added.id, g.position, g.gift FROM added CROSS JOIN unnest($1::text[]) WITH ORDINALITY AS g(gift,position)`,
      [GIFTS, HASH_A],
    );
    await expect(register("Pessoa extra")).rejects.toThrow("PARTICIPANT_LIMIT");
    expect((await event()).participant_count).toBe(1000);
  });

  it("impõe exatamente três sugestões e unicidade inclusive em gravação SQL direta", async () => {
    await expect(
      db.pool.query(
        "INSERT INTO public.as_participants(name,code_hash,code_fingerprint) VALUES($1,$2,'0000000000000000000000000000000000000000000000000000000000000000')",
        ["Sem sugestões", HASH_A],
      ),
    ).rejects.toThrow("INVALID_INPUT");
    expect((await event()).participant_count).toBe(0);
    const id = await register("Ana");
    await expect(
      db.pool.query(
        "DELETE FROM public.as_gifts WHERE participant_id=$1 AND position=1",
        [id],
      ),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      db.pool.query(
        "UPDATE public.as_gifts SET description=$1 WHERE participant_id=$2 AND position=2",
        ["LIVRO", id],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      db.pool.query(
        "UPDATE public.as_gifts SET position=4 WHERE participant_id=$1 AND position=3",
        [id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    expect(
      (await rpc<{ gifts: string[] }[]>("as_participants"))[0].gifts,
    ).toEqual(GIFTS);
  });

  it("constraints impedem destinatário duplicado, autorrevelação e participante inexistente", async () => {
    const { ids, pairs, revision } = await prepareDraw();
    await commit(pairs, revision);
    await expect(
      db.pool.query(
        "UPDATE public.as_assignments SET receiver_id=giver_id WHERE giver_id=$1",
        [ids[0]],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.pool.query(
        "UPDATE public.as_assignments SET receiver_id=$1 WHERE giver_id=$2",
        [ids[1], ids[2]],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      db.pool.query(
        "UPDATE public.as_assignments SET receiver_id=$1 WHERE giver_id=$2",
        ["00000000-0000-4000-8000-000000000000", ids[2]],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    expect((await rpc<unknown[]>("as_draw_results")).length).toBe(3);
  });

  it("reaplicar instalação preserva inscrições, códigos e resultados", async () => {
    const { ids, pairs, revision } = await prepareDraw();
    const drawn = await commit(pairs, revision);
    await db.pool.query(
      await readFile(path.join(process.cwd(), "supabase/schema.sql"), "utf8"),
    );
    expect((await event()).draw_id).toBe(drawn.draw_id);
    expect(await rpc("as_reveal", [ids[0], HASH_A])).toEqual({
      name: "Bruno",
      gifts: GIFTS,
    });
  });

  it("nega leitura/escrita e execução de qualquer RPC a anon e authenticated", async () => {
    const client = await db.pool.connect();
    const tables = [
      "as_event",
      "as_participants",
      "as_gifts",
      "as_assignments",
      "as_rate_limits",
      "as_recovery_tokens",
    ];
    try {
      for (const role of ["anon", "authenticated"]) {
        await client.query(`SET ROLE ${role}`);
        for (const table of tables) {
          await expect(
            client.query(`SELECT * FROM public.${table}`),
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            client.query(`DELETE FROM public.${table}`),
          ).rejects.toMatchObject({ code: "42501" });
        }
        await expect(
          client.query("SELECT public.as_public_event()"),
        ).rejects.toMatchObject({ code: "42501" });
        await expect(
          client.query("SELECT public.as_register($1,$2,$3,$4,$5)", [
            "Ana",
            GIFTS,
            HASH_A, fingerprint("Ana"), 4,
          ]),
        ).rejects.toMatchObject({ code: "42501" });
        await client.query("RESET ROLE");
        const functions = await client.query(
          `SELECT proname, has_function_privilege($1, p.oid, 'execute') AS allowed
          FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'as\\_%' ESCAPE '\\'`,
          [role],
        );
        expect(functions.rows.length).toBeGreaterThan(10);
        expect(functions.rows.filter((fn) => fn.allowed)).toEqual([]);
      }
      const rls = await client.query(
        `SELECT relname, relrowsecurity FROM pg_class WHERE relname=ANY($1::text[])`,
        [tables],
      );
      expect(rls.rows.every((table) => table.relrowsecurity)).toBe(true);
      const policies = await client.query(
        `SELECT tablename FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1::text[])`,
        [tables],
      );
      expect(
        new Set(policies.rows.map((policy) => policy.tablename)).size,
      ).toBe(6);
      await client.query("SET ROLE service_role");
      for (const table of tables)
        await expect(
          client.query(`SELECT * FROM public.${table}`),
        ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await client.query("RESET ROLE");
      client.release();
    }
  });

  it("RLS continua negando acesso mesmo se privilégios de tabela forem concedidos por engano", async () => {
    await register("Ana");
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "GRANT SELECT, INSERT ON public.as_participants TO anon, authenticated",
      );
      for (const role of ["anon", "authenticated"]) {
        await client.query(`SET LOCAL ROLE ${role}`);
        expect(
          (await client.query("SELECT * FROM public.as_participants")).rows,
        ).toEqual([]);
        await client.query("RESET ROLE");
      }
      await client.query("SET LOCAL ROLE anon");
      await expect(
        client.query(
          "INSERT INTO public.as_participants(name,code_hash,code_fingerprint) VALUES($1,$2,'0000000000000000000000000000000000000000000000000000000000000000')",
          ["Bruno", HASH_A],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("aplica rate limit atômico persistente e renova janelas vencidas", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () =>
        rpc<boolean>("as_rate_limit", ["a".repeat(64), 5, 60]),
      ),
    );
    expect(attempts.filter(Boolean)).toHaveLength(5);
    await db.pool.query(
      "UPDATE public.as_rate_limits SET window_started_at=clock_timestamp()-interval '2 minutes'",
    );
    expect(await rpc("as_rate_limit", ["a".repeat(64), 5, 60])).toBe(true);
    await expect(
      rpc("as_rate_limit", ["raw-ip-address", 5, 60]),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(rpc("as_rate_limit", ["a".repeat(64), 0, 60])).rejects.toThrow(
      "INVALID_INPUT",
    );
  });

  it("preserva evento, participantes, resultado e rate limit após parada/reinício real do PostgreSQL", async () => {
    const { ids, pairs, revision } = await prepareDraw();
    const drawn = await commit(pairs, revision);
    await rpc("as_rate_limit", ["b".repeat(64), 1, 3600]);
    await db.restart();
    expect((await event()).draw_id).toBe(drawn.draw_id);
    expect((await event()).participant_count).toBe(3);
    expect(await rpc("as_reveal", [ids[0], HASH_A])).toEqual({
      name: "Bruno",
      gifts: GIFTS,
    });
    expect(await rpc("as_rate_limit", ["b".repeat(64), 1, 3600])).toBe(false);
  }, 30_000);
});
