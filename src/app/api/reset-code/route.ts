import { backend } from "@/lib/backend";
import { handle, json, readBody } from "@/lib/http";
import { trustedIp } from "@/lib/security";
export const runtime = "nodejs";
export function POST(request: Request) {
  return handle(async () => {
    const input = await readBody(request);
    const service = backend();
    await service.limit("recover-ip", trustedIp(request.headers), 20, 900);
    return json(await service.redeemCode(input));
  });
}
