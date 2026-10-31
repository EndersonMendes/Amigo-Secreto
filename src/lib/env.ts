import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
  ADMIN_EMAIL: z.email(),
  RATE_LIMIT_SECRET: z.string().regex(/^[a-f0-9]{64}$/i),
  CODE_LOOKUP_SECRET: z.string().regex(/^[a-f0-9]{64}$/i),
  APP_URL: z.url(),
});
export function env() {
  const result = schema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    RATE_LIMIT_SECRET: process.env.RATE_LIMIT_SECRET,
    CODE_LOOKUP_SECRET: process.env.CODE_LOOKUP_SECRET,
    APP_URL: process.env.APP_URL,
  });
  if (!result.success || result.data.CODE_LOOKUP_SECRET.toLowerCase() === result.data.RATE_LIMIT_SECRET.toLowerCase())
    throw new AppError(
      "SETUP_REQUIRED",
      503,
      "O evento ainda não está disponível. Peça ao administrador para conferir a configuração.",
    );
  if (
    process.env.NODE_ENV === "production" &&
    !["localhost", "127.0.0.1"].includes(
      new URL(result.data.APP_URL).hostname,
    ) &&
    !result.data.APP_URL.startsWith("https://")
  )
    throw new AppError(
      "SETUP_REQUIRED",
      503,
      "O endereço do evento precisa usar HTTPS.",
    );
  return result.data;
}
