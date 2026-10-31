import { it, expect } from "vitest";
import {
  isAuthorizedAdmin,
  trustedIp,
  assertOrigin,
} from "../src/lib/security";
it("admin requer usuário confirmado e e-mail autorizado", () => {
  expect(isAuthorizedAdmin(null, "admin@example.com")).toBe(false);
  expect(
    isAuthorizedAdmin(
      { email: "x@example.com", email_confirmed_at: "now" },
      "admin@example.com",
    ),
  ).toBe(false);
  expect(
    isAuthorizedAdmin({ email: "admin@example.com" }, "admin@example.com"),
  ).toBe(false);
  expect(
    isAuthorizedAdmin(
      { email: "ADMIN@example.com", email_confirmed_at: "now" },
      "admin@example.com",
    ),
  ).toBe(true);
});
it("não confia no X-Forwarded-For de visitante fora da Vercel", () => {
  expect(trustedIp(new Headers({ "x-forwarded-for": "1.2.3.4" }), false)).toBe(
    "shared",
  );
  expect(
    trustedIp(
      new Headers({
        "x-forwarded-for": "1.2.3.4",
        "x-vercel-forwarded-for": "2.3.4.5",
      }),
      true,
    ),
  ).toBe("2.3.4.5");
  expect(
    trustedIp(new Headers({ "x-vercel-forwarded-for": "invalid" }), true),
  ).toBe("shared");
});
it("bloqueia requisições mutantes de outra origem ou sem Origin", () => {
  for (const origin of [null, "https://evil.test", "null"])
    expect(() => assertOrigin(origin, "https://natal.example")).toThrow();
  expect(() =>
    assertOrigin("https://natal.example", "https://natal.example"),
  ).not.toThrow();
});
