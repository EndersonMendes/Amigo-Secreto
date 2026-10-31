import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "./helpers/postgres";
import { PartyService } from "../src/lib/service";
import { testRpc } from "./helpers/rpc";
import { randomBytes } from "node:crypto";
let db: TestDatabase;
let service: PartyService;
const codeSecret = "b".repeat(64);
beforeAll(async () => {
  db = await startTestDatabase();
  service = new PartyService(
    testRpc(() => db),
    randomBytes(32).toString("hex"), codeSecret,
  );
});
afterAll(async () => {
  await db?.stop();
});
describe("serviço completo com PostgreSQL persistente", () => {
  it("inscreve, sorteia, revela só o destinatário, revoga código e persiste após reinício", async () => {
    const first = await service.register({
      code: "0012",
      name: " Ana  Silva ",
      gifts: ["Livro", "Café", "Camisa"],
    });
    expect(first.name).toBe("Ana Silva");
    expect(first).toEqual({ name: "Ana Silva" });
    await expect(
      service.register({ name: "Other Person", code: "0012", gifts: ["a", "b", "c"] }),
    ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });
    await expect(
      service.reveal({ name: first.name, code: "0012" }),
    ).rejects.toMatchObject({ code: "DRAW_PENDING" });
    const second = await service.register({
      name: "Bruno Souza", code: "678901",
      gifts: ["Chocolate", "Meias", "Caneca"],
    });
    const before = await service.adminEvent();
    await expect(
      service.draw({
        confirmation: "REALIZAR SORTEIO",
        revision: before.revision,
      }),
    ).rejects.toMatchObject({ code: "REGISTRATION_OPEN" });
    const { name, intro, home_text, event_date } = before;
    const closed = await service.updateEvent({
      name,
      intro,
      home_text,
      event_date,
      registrations_open: false,
      revision: before.revision,
    });
    await expect(
      service.register({ name: "Carla Souza", code: "3333", gifts: ["a", "b", "c"] }),
    ).rejects.toMatchObject({ code: "REGISTRATION_CLOSED" });
    const drawn = await service.draw({
      confirmation: "REALIZAR SORTEIO",
      revision: closed.revision,
    });
    expect(drawn.draw_completed).toBe(true);
    await expect(
      service.draw({
        confirmation: "REALIZAR SORTEIO",
        revision: drawn.revision,
      }),
    ).rejects.toMatchObject({ code: "DRAW_EXISTS" });
    const result = await service.reveal({ name: first.name, code: "0012" });
    expect(result).toEqual({
      name: second.name,
      gifts: ["Chocolate", "Meias", "Caneca"],
    });
    await expect(
      service.reveal({ name: second.name, code: "0012" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      service.reveal({ name: "Sem Cadastro", code: "0012" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      service.reveal({
        name: first.name,
        code: "00000000-00000000-00000000-00000000",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      service.reveal({
        name: first.name,
        code: "0012",
        participant_id: "different",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const participant = (await service.participants()).find(
      (p) => p.name === first.name,
    )!;
    const reset = await service.resetCode({ id: participant.id });
    expect(await service.reveal({ name: first.name, code: "0012" })).toEqual(result);
    await service.redeemCode({ token: reset.token, code: "9999" });
    await expect(service.reveal({ name: first.name, code: "0012" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(
      await service.reveal({ name: first.name, code: "9999" }),
    ).toEqual(result);
    expect(JSON.stringify(await service.participants())).not.toContain(
      "scrypt",
    );
    const publicEvent = await service.publicEvent();
    expect(Object.keys(publicEvent).sort()).toEqual(
      [
        "draw_completed",
        "event_date",
        "home_text",
        "intro",
        "name",
        "participant_count",
        "registrations_open",
      ].sort(),
    );
    await db.restart();
    service = new PartyService(
      testRpc(() => db),
      randomBytes(32).toString("hex"), codeSecret,
    );
    expect(
      await service.reveal({ name: second.name, code: "678901" }),
    ).toEqual({ name: first.name, gifts: ["Livro", "Café", "Camisa"] });
    expect((await service.adminEvent()).draw_id).toBe(drawn.draw_id);
  });
  it("rate limiting persiste entre instâncias e só armazena HMAC", async () => {
    const secret = randomBytes(32).toString("hex");
    const a = new PartyService(
        testRpc(() => db),
        secret, codeSecret,
      ),
      b = new PartyService(
        testRpc(() => db),
        secret, codeSecret,
      );
    await a.limit("test", "Ana Silva", 2, 900);
    await b.limit("test", " ana silva ", 2, 900);
    await expect(a.limit("test", "ANA SILVA", 2, 900)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
    const keys = (await db.pool.query("SELECT key FROM public.as_rate_limits"))
      .rows;
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((row) => /^[a-f0-9]{64}$/.test(row.key))).toBe(true);
  });
  it("compartilha limite por identidade mesmo com aliases Unicode equivalentes no PostgreSQL", async () => {
    const previous = await service.adminEvent();
    const reset = await service.resetDraw({
      confirmation: "REINICIAR SORTEIO",
      draw_id: previous.draw_id,
    });
    await service.updateEvent({
      name: reset.name,
      intro: reset.intro,
      home_text: reset.home_text,
      event_date: null,
      registrations_open: true,
      revision: reset.revision,
    });
    const person = await service.register({
      name: "IİIİIİ Silva", code: "54321",
      gifts: ["Livro", "Café", "Meias"],
    });
    const alias = "IIIIII Silva";
    const rpc = testRpc(() => db);
    const a = await rpc.call<{ name_key: string }>("as_find_participant", {
      p_name: person.name, p_fingerprint: "0".repeat(64),
    });
    const b = await rpc.call<{ name_key: string }>("as_find_participant", {
      p_name: alias, p_fingerprint: "0".repeat(64),
    });
    expect(a.name_key).toBe(b.name_key);
    for (let i = 0; i < 10; i++)
      await expect(
        service.reveal({
          name: person.name,
          code: "00000000-00000000-00000000-00000000",
        }),
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      service.reveal({ name: alias, code: "54321" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
