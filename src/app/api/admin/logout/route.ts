import { authClient } from "@/lib/auth";
import { handle, json, readBody } from "@/lib/http";
export const runtime = "nodejs";
export function POST(request: Request) {
  return handle(async () => {
    await readBody(request);
    const client = await authClient();
    await client.auth.signOut();
    return json({ ok: true });
  });
}
