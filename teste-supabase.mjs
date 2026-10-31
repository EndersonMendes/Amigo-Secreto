import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";

// Node 24 lê .env.local sem exigir a dependência adicional dotenv.
try { loadEnvFile(".env.local"); }
catch (error) { if (error.code !== "ENOENT") throw error; }

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error("Preencha SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local antes de testar.");
  process.exitCode = 1;
} else {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await supabase.rpc("as_public_event");
    if (error || !data) {
      console.error("Falha na consulta. Confira o projeto, as chaves e o SQL instalado no Supabase.");
      process.exitCode = 1;
    } else {
      console.log("CONEXÃO E RPC FUNCIONANDO! Participantes:", data.participant_count);
    }
  } catch {
    console.error("Falha de conexão com o Supabase. Confira a rede e a configuração local.");
    process.exitCode = 1;
  }
}
