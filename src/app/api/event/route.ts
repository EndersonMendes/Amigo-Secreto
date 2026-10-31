import { backend } from "@/lib/backend";
import { handle, json } from "@/lib/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET() {
  return handle(async () => json(await backend().publicEvent()));
}
