import "server-only";
import { isIP } from "node:net";
import { AppError } from "./errors";
export function isAuthorizedAdmin(
  user: { email?: string; email_confirmed_at?: string | null } | null,
  allowedEmail: string,
): boolean {
  return !!(
    user?.email_confirmed_at &&
    allowedEmail &&
    user.email?.toLowerCase() === allowedEmail.toLowerCase()
  );
}
export function trustedIp(
  headers: Headers,
  isVercel = process.env.VERCEL === "1",
): string {
  if (!isVercel) return "shared";
  const value = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  return value && isIP(value) ? value : "shared";
}
export function assertOrigin(origin: string | null, appUrl: string): void {
  if (!origin || origin !== new URL(appUrl).origin)
    throw new AppError(
      "ORIGIN",
      403,
      "Requisição não permitida. Reabra o site pelo endereço oficial.",
    );
}
