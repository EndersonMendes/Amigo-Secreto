import { backend } from "@/lib/backend";
import { requireAdmin } from "@/lib/auth";
import { handle, json, readBody } from "@/lib/http";
export const runtime = "nodejs";
export function POST(request: Request) {
  return handle(async () => {
    const input = await readBody(request);
    await requireAdmin();
    return json(await backend().resetCode(input));
  });
}
