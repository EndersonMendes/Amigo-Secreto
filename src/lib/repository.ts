import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { databaseError } from "./errors";
export interface Rpc {
  call<T>(name: string, args?: Record<string, unknown>): Promise<T>;
}
export function createRepository(): Rpc {
  const config = env();
  // Este cliente nunca recebe cookies nem tokens de usuários.
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return {
    async call<T>(name: string, args: Record<string, unknown> = {}) {
      const { data, error } = await client.rpc(name, args);

if (error) {
  console.error("[ERRO SUPABASE RPC]", {
    function: name,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  throw databaseError(error.message);
}

return data as T;
    },
  };
}
