import { backend } from "@/lib/backend";
import { requireAdmin } from "@/lib/auth";
import { handle, privateHeaders } from "@/lib/http";
import { participantsCsv } from "@/lib/csv";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET() {
  return handle(async () => {
    await requireAdmin();
    const csv = participantsCsv(await backend().participants());
    return new Response(csv, {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="participantes-amigo-secreto.csv"',
      },
    });
  });
}
