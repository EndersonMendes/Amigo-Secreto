import "server-only";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { AppError } from "./errors";
import { assertOrigin } from "./security";
import { env } from "./env";
export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export function json(data: unknown, status = 200) {
  return Response.json({ data }, { status, headers: privateHeaders });
}
export async function readBody(request: Request): Promise<unknown> {
  assertOrigin(request.headers.get("origin"), env().APP_URL);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new AppError(
      "CONTENT_TYPE",
      415,
      "Envie os dados pelo formulário do site.",
    );
  const limit = 16 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new AppError(
      "BODY_SIZE",
      413,
      "O formulário ultrapassou o limite de tamanho.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("BODY", 400, "Preencha o formulário.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > limit) {
        await reader.cancel();
        throw new AppError(
          "BODY_SIZE",
          413,
          "O formulário ultrapassou o limite de tamanho.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("BODY", 400, "Não foi possível ler os dados enviados.");
  }
}
export async function handle(
  action: () => Promise<Response>,
): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof AppError)
      return Response.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            ...privateHeaders,
            ...(error.status === 429
              ? { "Retry-After": String(error.retryAfter ?? 900) }
              : {}),
          },
        },
      );
    if (error instanceof ZodError)
      return Response.json(
        { error: error.issues[0]?.message ?? "Confira os dados informados." },
        { status: 400, headers: privateHeaders },
      );
    // Não registrar corpo, credenciais, mensagens de SDK ou stack com dados privados.
    console.error("Falha interna no evento", randomUUID());
    return Response.json(
      {
        error: "Não foi possível concluir agora. Tente novamente em instantes.",
      },
      { status: 503, headers: privateHeaders },
    );
  }
}
