import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PartyService } from "../src/lib/service";
import { startTestDatabase, type TestDatabase } from "./helpers/postgres";
import { testRpc } from "./helpers/rpc";
import { AppError } from "../src/lib/errors";
const fixture = vi.hoisted(() => ({
  service: null as unknown as PartyService,
  authorized: false,
}));
vi.mock("../src/lib/backend", () => ({ backend: () => fixture.service }));
vi.mock("../src/lib/auth", () => ({
  requireAdmin: async () => {
    if (!fixture.authorized)
      throw new AppError("UNAUTHORIZED", 401, "Não autorizado");
    return { id: "test-admin" };
  },
}));
import { POST as register } from "../src/app/api/register/route";
import { POST as reveal } from "../src/app/api/reveal/route";
import { GET as publicEvent } from "../src/app/api/event/route";
import { POST as updateEvent } from "../src/app/api/admin/event/route";
import { POST as draw, GET as pairs } from "../src/app/api/admin/draw/route";
import { GET as exportCsv } from "../src/app/api/admin/export/route";
let db: TestDatabase;
const request = (value: unknown) =>
  new Request("https://natal.example/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://natal.example",
    },
    body: JSON.stringify(value),
  });
beforeAll(async () => {
  Object.assign(process.env, {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value",
    SUPABASE_SECRET_KEY: "sb_secret_only_test_value",
    ADMIN_EMAIL: "admin@example.com",
    CODE_LOOKUP_SECRET: "b".repeat(64),
    RATE_LIMIT_SECRET: "a".repeat(64),
    APP_URL: "https://natal.example",
  });
  db = await startTestDatabase();
  fixture.service = new PartyService(
    testRpc(() => db),
    "a".repeat(64), "b".repeat(64),
  );
});
afterAll(async () => {
  await db?.stop();
});
it("executa inscrição e consulta pelas rotas HTTP reais, com banco real e sessão administrativa de teste isolada", async () => {
  const invalid = await register(
    request({ name: "Ana Costa", gifts: ["Livro", "Livro", "Meia"] }),
  );
  expect(invalid.status).toBe(400);
  const people: { name: string; code: string }[] = [];
  for (const name of ["Ana Costa", "Bruno Alves", "Carla Sousa"]) {
    const code = String(1000 + people.length);
    const response = await register(
      request({ name, code, gifts: ["Livro", "Meias", "Camisa"] }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const data = (await response.json()).data;
    expect(data).toEqual({ name });
    people.push({ ...data, code });
  }
  const duplicate = await register(
    request({ name: "Other Person", code: "1000", gifts: ["a", "b", "c"] }),
  );
  expect(duplicate.status).toBe(409);
  expect((await reveal(request(people[0]))).status).toBe(409);
  const p = await publicEvent();
  expect((await p.json()).data.participant_count).toBe(3);
  expect((await pairs()).status).toBe(401);
  fixture.authorized = true;
  const e = await fixture.service.adminEvent();
  const closed = await updateEvent(
    request({
      name: e.name,
      intro: e.intro,
      home_text: e.home_text,
      event_date: e.event_date,
      registrations_open: false,
      revision: e.revision,
    }),
  );
  expect(closed.status).toBe(200);
  const revision = (await closed.json()).data.revision;
  const result = await draw(
    request({ confirmation: "REALIZAR SORTEIO", revision }),
  );
  expect(result.status).toBe(200);
  expect(
    (await draw(request({ confirmation: "REALIZAR SORTEIO", revision })))
      .status,
  ).toBe(409);
  for (const person of people) {
    const response = await reveal(request(person));
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.name).not.toBe(person.name);
    expect(Object.keys(data).sort()).toEqual(["gifts", "name"]);
    expect(data.gifts).toHaveLength(3);
  }
  const wrong = await reveal(
    request({ name: people[1].name, code: people[0].code }),
  );
  expect(wrong.status).toBe(401);
  expect((await pairs()).status).toBe(200);
  const csv = await exportCsv();
  expect(csv.status).toBe(200);
  const text = await csv.text();
  expect(text).toContain("Ana Costa");
  expect(text).not.toContain("scrypt");
  expect(text).not.toContain(people[0].code);
  fixture.authorized = false;
  expect((await exportCsv()).status).toBe(401);
});

it("rota pública só com nomes, recuperação privada e limpeza protegida por sessão, CSRF, confirmação e revisão", async () => {
  const { GET: names } = await import("../src/app/api/participants/route");
  const { POST: clear } = await import("../src/app/api/admin/clear/route");
  const { POST: issue } = await import("../src/app/api/admin/reset-code/route");
  const { POST: redeem } = await import("../src/app/api/reset-code/route");
  const response = await names();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await response.json()).data).toEqual(["Ana Costa", "Bruno Alves", "Carla Sousa"]);
  const e = await fixture.service.adminEvent();
  const body = { confirmation: "LIMPAR BASE DE DADOS", revision: e.revision };
  fixture.authorized = false;
  expect((await clear(request(body))).status).toBe(401);
  fixture.authorized = true;
  const badOrigin = new Request("https://natal.example/api/admin/clear", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://evil.example" }, body: JSON.stringify(body) });
  expect((await clear(badOrigin)).status).toBe(403);
  expect((await clear(request({ ...body, confirmation: "yes" }))).status).toBe(400);
  expect((await clear(request({ ...body, revision: e.revision - 1 }))).status).toBe(409);
  const person = (await fixture.service.participants())[0];
  const reset = await issue(request({ id: person.id }));
  expect(reset.status).toBe(200);
  const capability = (await reset.json()).data;
  expect(Object.keys(capability).sort()).toEqual(["name", "token"]);
  expect(JSON.stringify(capability)).not.toContain("code");
  const updated = await redeem(request({ token: capability.token, code: "0055" }));
  expect(updated.status).toBe(200);
  expect((await updated.json()).data).toEqual({ name: person.name });
  expect((await redeem(request({ token: capability.token, code: "0066" }))).status).toBe(401);
  const current = await fixture.service.adminEvent();
  const cleared = await clear(request({ ...body, revision: current.revision }));
  expect(cleared.status).toBe(200);
  expect((await cleared.json()).data).toMatchObject({ participant_count: 0, registrations_open: true, draw_completed: false });
  expect((await (await names()).json()).data).toEqual([]);
  expect((await reveal(request({ name: person.name, code: "0055" }))).status).toBe(401);
  fixture.authorized = false;
});
