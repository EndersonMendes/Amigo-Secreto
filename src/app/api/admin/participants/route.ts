import { backend } from "@/lib/backend";
import { requireAdmin } from "@/lib/auth";
import { handle, json, readBody } from "@/lib/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET() {
  return handle(async () => {
    await requireAdmin();
    return json(await backend().participants());
  });
}
export function POST(request: Request) {
  return handle(async () => {
    const input = await readBody(request);
    await requireAdmin();
    return json(await backend().editParticipant(input));
  });
}
