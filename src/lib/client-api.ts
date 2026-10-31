"use client";

import { giftWithinLimit } from "./gift-limit";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "Não foi possível conectar. Verifique sua conexão e tente novamente.",
      0,
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 401 &&
      path.startsWith("/api/admin/") &&
      !path.endsWith("/login")
    ) {
      window.location.assign("/admin/login");
    }
    throw new ApiError(
      payload?.error ||
        "Não foi possível concluir. Tente novamente em instantes.",
      response.status,
    );
  }
  if (!payload || !("data" in payload))
    throw new ApiError(
      "O servidor enviou uma resposta inesperada. Tente novamente.",
      502,
    );
  return payload.data as T;
}

export function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir esta ação.";
}

export function formatDate(value: string | null, withTime = false): string {
  if (!value) return "Data a definir";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "Data a definir";
  return new Intl.DateTimeFormat(
    "pt-BR",
    withTime
      ? { dateStyle: "short", timeStyle: "short" }
      : { day: "numeric", month: "long", year: "numeric" },
  ).format(date);
}

export function validateParticipant(
  name: string,
  gifts: string[],
): string | null {
  const cleanName = name.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (cleanName.length < 2 || cleanName.length > 100)
    return "Informe seu nome completo, com 2 a 100 caracteres.";
  const normalized = gifts.map((gift) =>
    gift.normalize("NFC").trim().replace(/\s+/gu, " "),
  );
  if (
    normalized.length !== 3 ||
    normalized.some((gift) => gift.length < 1 || gift.length > 160)
  )
    return "Preencha as três sugestões, com até 160 caracteres cada.";
  if (
    new Set(normalized.map((gift) => gift.toLocaleLowerCase("pt-BR"))).size !==
    3
  )
    return "Escolha três sugestões diferentes de presente.";
  if (normalized.some((gift) => !giftWithinLimit(gift)))
    return "Escolha sugestões de até R$ 50,00 por presente. Ajuste o valor informado.";
  return null;
}

export function validateAccessCode(code: string, confirmation: string): string | null {
  if (!/^[0-9]{4,128}$/.test(code))
    return "Escolha um código com 4 a 128 números, sem letras ou espaços.";
  if (code !== confirmation) return "Os códigos não coincidem. Confira os dois campos.";
  return null;
}
