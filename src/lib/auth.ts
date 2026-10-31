import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";
import { AppError } from "./errors";
import { isAuthorizedAdmin } from "./security";
export async function authClient() {
  const config = env();
  const jar = await cookies();
  return createServerClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(config.APP_URL).protocol === "https:",
        path: "/",
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server Components não escrevem cookies; proxy renova a sessão. */
          }
        },
      },
    },
  );
}
export async function requireAdmin() {
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !isAuthorizedAdmin(user, env().ADMIN_EMAIL))
    throw new AppError(
      "UNAUTHORIZED",
      401,
      "Entre com a conta administrativa autorizada.",
    );
  return user!;
}
export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED")
      redirect("/admin/login");
    throw error;
  }
}
