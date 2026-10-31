import { authClient } from "@/lib/auth";
import { backend } from "@/lib/backend";
import { env } from "@/lib/env";
import { handle, json, readBody } from "@/lib/http";
import { isAuthorizedAdmin, trustedIp } from "@/lib/security";
import { loginInput } from "@/lib/validation";
import { AppError } from "@/lib/errors";
export const runtime = "nodejs";
export function POST(request: Request) {
  return handle(async () => {
    const input = await readBody(request);
    const service = backend();
    await service.limit("login-ip", trustedIp(request.headers), 10, 900);
    const { email, password } = loginInput.parse(input);
    await service.limit("login-email", email, 10, 900);
    const client = await authClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !isAuthorizedAdmin(data.user, env().ADMIN_EMAIL)) {
      if (data.session) await client.auth.signOut();
      throw new AppError(
        "UNAUTHORIZED",
        401,
        "E-mail ou senha inválidos, ou conta sem acesso administrativo.",
      );
    }
    return json({ ok: true });
  });
}
