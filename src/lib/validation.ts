import { z } from "zod";
import { giftWithinLimit } from "./gift-limit";
export const MAX_CODE_DIGITS = 128;
export const newCodeInput = z.string().regex(/^[0-9]{4,128}$/, "Escolha um código de 4 a 128 dígitos (somente 0–9).");
export const normalizeText = (value: string) =>
  value.normalize("NFC").replace(/\s+/gu, " ").trim();
const text = (min: number, max: number, label: string) =>
  z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(min, `${label}: preencha pelo menos ${min} caracteres.`)
        .max(max, `${label}: use até ${max} caracteres.`)
        .refine(
          (v) => !/[\u0000-\u001f\u007f-\u009f]/u.test(v),
          "Remova caracteres de controle.",
        ),
    );
export const participantDetailsInput = z
  .object({
    name: text(2, 100, "Nome"),
    gifts: z
      .tuple([
        text(1, 160, "Presente 1").refine(giftWithinLimit, "Cada presente deve custar até R$ 50."),
        text(1, 160, "Presente 2").refine(giftWithinLimit, "Cada presente deve custar até R$ 50."),
        text(1, 160, "Presente 3").refine(giftWithinLimit, "Cada presente deve custar até R$ 50."),
      ])
      .refine(
        (g) => new Set(g.map((v) => v.toLowerCase())).size === 3,
        "Informe três sugestões diferentes.",
      ),
  })
  .strict();
export const participantInput = participantDetailsInput.extend({ code: newCodeInput }).strict();
export const clearInput = z.object({ confirmation: z.literal("LIMPAR BASE DE DADOS"), revision: z.number().int().nonnegative() }).strict();
export const recoverInput = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), code: newCodeInput }).strict();
export const revealInput = z
  .object({ name: text(2, 100, "Nome"), code: z.string().min(1).max(128) })
  .strict();
export const idInput = z.object({ id: z.uuid() }).strict();
export const eventInput = z
  .object({
    name: text(2, 100, "Nome do evento"),
    intro: text(1, 500, "Mensagem"),
    home_text: text(1, 1000, "Texto da página"),
    event_date: z.union([z.iso.date(), z.null()]),
    registrations_open: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const editInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("edit"),
      id: z.uuid(),
      ...participantDetailsInput.shape,
    })
    .strict(),
  z.object({ action: z.literal("delete"), id: z.uuid() }).strict(),
]);
export const drawInput = z
  .object({
    confirmation: z.literal("REALIZAR SORTEIO"),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const resetInput = z
  .object({ confirmation: z.literal("REINICIAR SORTEIO"), draw_id: z.uuid() })
  .strict();
export const loginInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    password: z.string().min(1).max(256),
  })
  .strict();
