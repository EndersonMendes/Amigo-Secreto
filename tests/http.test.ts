import { beforeAll, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/errors";
import { handle, readBody } from "../src/lib/http";
vi.mock("../src/lib/auth", () => ({
  requireAdmin: async () => {
    throw new AppError(
      "UNAUTHORIZED",
      401,
      "Entre com a conta administrativa autorizada.",
    );
  },
}));
import * as event from "../src/app/api/admin/event/route";
import * as participants from "../src/app/api/admin/participants/route";
import * as draw from "../src/app/api/admin/draw/route";
import * as clear from "../src/app/api/admin/clear/route";
import * as reset from "../src/app/api/admin/reset/route";
import * as resetCode from "../src/app/api/admin/reset-code/route";
import * as exportRoute from "../src/app/api/admin/export/route";
beforeAll(() => {
  Object.assign(process.env, {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value",
    SUPABASE_SECRET_KEY: "sb_secret_only_test_value",
    ADMIN_EMAIL: "admin@example.com",
    CODE_LOOKUP_SECRET: "b".repeat(64),
    RATE_LIMIT_SECRET: "0".repeat(64),
    APP_URL: "https://natal.example",
  });
});
function request(
  body = "{}",
  origin: string | null = "https://natal.example",
  extra: Record<string, string> = {},
) {
  return new Request("https://natal.example/api/admin/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { origin } : {}),
      ...extra,
    },
    body,
  });
}
describe("proteção HTTP das operações administrativas", () => {
  for (const [name, handler] of Object.entries({
    event: event.GET,
    participants: participants.GET,
    draw: draw.GET,
    export: exportRoute.GET,
  }))
    it(`GET ${name} sem sessão não entrega dados`, async () => {
      const response = await handler();
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "Entre com a conta administrativa autorizada.",
      });
      expect(response.headers.get("cache-control")).toContain("no-store");
    });
  for (const [name, handler] of Object.entries({
    event: event.POST,
    participants: participants.POST,
    draw: draw.POST,
    reset: reset.POST,
    clear: clear.POST,
    resetCode: resetCode.POST,
  }))
    it(`POST ${name} sem sessão não altera dados`, async () => {
      expect((await handler(request())).status).toBe(401);
    });
  it("rejeita CSRF antes de qualquer operação", async () =>
    expect(
      (await event.POST(request("{}", "https://evil.example"))).status,
    ).toBe(403));
  it("rejeita JSON quebrado, mídia e excesso de corpo", async () => {
    await expect(readBody(request("{"))).rejects.toMatchObject({ status: 400 });
    await expect(readBody(request("{}", null))).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      readBody(
        request("{}", "https://natal.example", {
          "Content-Type": "text/plain",
        }),
      ),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readBody(request(JSON.stringify({ value: "a".repeat(17000) }))),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("não expõe erros internos ou segredos no HTTP", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await handle(async () => {
      throw new Error("password=SECRET");
    });
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("SECRET");
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
    log.mockRestore();
  });
});
