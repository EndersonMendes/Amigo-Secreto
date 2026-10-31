import { beforeAll, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({
  user: null as null | { email: string; email_confirmed_at?: string },
  error: null as null | Error,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: identity.user },
        error: identity.error,
      }),
    },
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));
import { requireAdmin } from "../src/lib/auth";
beforeAll(() =>
  Object.assign(process.env, {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value",
    SUPABASE_SECRET_KEY: "sb_secret_only_test_value",
    ADMIN_EMAIL: "admin@example.com",
    CODE_LOOKUP_SECRET: "b".repeat(64),
    RATE_LIMIT_SECRET: "0".repeat(64),
    APP_URL: "https://natal.example",
  }),
);
it("nega sessão ausente, conta não autorizada, e-mail não confirmado e erro de autenticação", async () => {
  for (const user of [
    null,
    { email: "person@example.com", email_confirmed_at: "now" },
    { email: "admin@example.com" },
  ]) {
    identity.user = user;
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  }
  identity.user = { email: "admin@example.com", email_confirmed_at: "now" };
  identity.error = new Error("invalid token");
  await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  identity.error = null;
});
it("permite somente identidade confirmada pelo provedor e autorizada", async () => {
  identity.user = { email: "admin@example.com", email_confirmed_at: "now" };
  expect(await requireAdmin()).toEqual(identity.user);
});
