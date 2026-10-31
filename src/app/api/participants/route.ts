import { backend } from "@/lib/backend";
import { handle, json } from "@/lib/http";
export const runtime = "nodejs";
export function GET() {
  return handle(async () => json(await backend().publicParticipants()));
}
