import { describe, it, expect } from "vitest";
import { generateDerangement, assertDistribution } from "../src/lib/draw";
import { generateCode, hashCode, verifyCode } from "../src/lib/codes";
import { participantInput, normalizeText } from "../src/lib/validation";
import { participantsCsv } from "../src/lib/csv";

describe("permutação sem pontos fixos", () => {
  it("bloqueia 0, 1 e IDs duplicados", () => {
    for (const ids of [[], ["a"], ["a", "a"]])
      expect(() => generateDerangement(ids)).toThrow();
  });
  for (const n of [2, 3, 4, 5, 10, 100, 1000])
    it(`preserva toda distribuição com ${n} pessoas`, () => {
      const ids = Array.from({ length: n }, (_, i) => String(i));
      for (let k = 0; k < 100; k++) {
        const pairs = generateDerangement(ids);
        expect(pairs).toHaveLength(n);
        expect(new Set(pairs.map((p) => p.giver_id)).size).toBe(n);
        expect(new Set(pairs.map((p) => p.receiver_id)).size).toBe(n);
        expect(pairs.every((p) => p.giver_id !== p.receiver_id)).toBe(true);
        expect(() => assertDistribution(ids, pairs)).not.toThrow();
      }
    });
  it("troca os dois participantes", () =>
    expect(generateDerangement(["a", "b"])).toEqual([
      { giver_id: "a", receiver_id: "b" },
      { giver_id: "b", receiver_id: "a" },
    ]));
  it("rejeita distribuição incompleta, externa, repetida ou autoatribuição", () => {
    const ids = ["a", "b", "c"];
    for (const pairs of [
      [],
      [{ giver_id: "a", receiver_id: "a" }],
      [
        { giver_id: "a", receiver_id: "b" },
        { giver_id: "b", receiver_id: "a" },
        { giver_id: "c", receiver_id: "b" },
      ],
      [
        { giver_id: "a", receiver_id: "b" },
        { giver_id: "b", receiver_id: "x" },
        { giver_id: "c", receiver_id: "a" },
      ],
    ])
      expect(() => assertDistribution(ids, pairs)).toThrow();
  });
});
describe("códigos individuais", () => {
  it("gera códigos criptográficos com 128 bits e sem repetições na amostra", () => {
    const codes = Array.from({ length: 1000 }, generateCode);
    expect(new Set(codes).size).toBe(1000);
    expect(codes.every((c) => /^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/.test(c))).toBe(
      true,
    );
  });
  it("usa salt individual e valida código correto, incorreto e formato inválido", async () => {
    const code = generateCode();
    const a = await hashCode(code);
    const b = await hashCode(code);
    expect(a).not.toBe(b);
    expect(a).not.toContain(code);
    expect(await verifyCode(code, a)).toBe(true);
    expect(await verifyCode(code.toLowerCase().replaceAll("-", " "), a)).toBe(
      true,
    );
    expect(await verifyCode(generateCode(), a)).toBe(false);
    expect(await verifyCode("xxx", a)).toBe(false);
    expect(await verifyCode(code, "invalid")).toBe(false);
  });
});
describe("validação", () => {
  const good = {
    code: "0012",
    name: "  João   da Silva  ",
    gifts: [" Livro ", " Café ", "Camisa"],
  };
  it("normaliza nomes e presentes", () =>
    expect(participantInput.parse(good)).toEqual({
      code: "0012",
      name: "João da Silva",
      gifts: ["Livro", "Café", "Camisa"],
    }));
  it("normaliza Unicode", () =>
    expect(normalizeText(" Jose\u0301\u00a0 Silva ")).toBe("José Silva"));
  for (const gifts of [
    [],
    ["a", "b"],
    ["a", "b", "c", "d"],
    ["a", " ", "c"],
    ["Café", " café ", "Livro"],
    ["a".repeat(161), "b", "c"],
  ])
    it(`rejeita sugestões inválidas ${JSON.stringify(gifts).slice(0, 50)}`, () =>
      expect(participantInput.safeParse({ ...good, gifts }).success).toBe(
        false,
      ));
  it("rejeita nomes vazios e controle", () => {
    for (const name of [" ", "A", "x".repeat(101), "Ana\u0000Silva"])
      expect(participantInput.safeParse({ ...good, name }).success).toBe(false);
  });
});
it("CSV protege fórmulas e escapa separadores, aspas e linhas", () => {
  const csv = participantsCsv([
    {
      name: "=1+1",
      gifts: ['texto; "aspas"', "+SUM(A1:A2)", "Livro"],
      created_at: "2026-01-01T00:00:00Z",
    },
  ]);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain('"texto; ""aspas"""');
  expect(csv).toContain('"\'+SUM(A1:A2)"');
  expect(csv).not.toContain("code_hash");
});

describe("códigos numéricos escolhidos e preços explícitos", () => {
  it("aceita quatro a 128 dígitos ASCII sem remover zeros", async () => {
    const { newCodeInput } = await import("../src/lib/validation");
    for (const code of ["0000", "00123", "9".repeat(128)]) expect(newCodeInput.parse(code)).toBe(code);
    for (const code of ["", "123", "1".repeat(129), "12 34", "1234 ", " 1234", "12-34", "١٢٣٤", "１２３４", "123a"])
      expect(newCodeInput.safeParse(code).success).toBe(false);
  });
  it("protege códigos curtos com pepper independente, salt e domínio próprio", async () => {
    const { hashNumericCode, codeFingerprint } = await import("../src/lib/codes");
    const secret = "a".repeat(64);
    const hash = await hashNumericCode("0001", secret);
    expect(hash).not.toBe(await hashNumericCode("0001", secret));
    expect(hash).toMatch(/^scrypt-v2\$/);
    expect(await verifyCode("0001", hash, secret)).toBe(true);
    for (const code of ["1", "0002", " 0001", "0001 ", "00-01"])
      expect(await verifyCode(code, hash, secret)).toBe(false);
    expect(await verifyCode("0001", hash, "b".repeat(64))).toBe(false);
    expect(codeFingerprint("0001", secret)).not.toBe(codeFingerprint("00001", secret));
    expect(codeFingerprint("0001", secret)).not.toBe(codeFingerprint("0001", "b".repeat(64)));
  });
  it("limita cada sugestão R$50 e aceita soma de três presentes de R$50", async () => {
    const { giftWithinLimit } = await import("../src/lib/gift-limit");
    for (const text of ["Livro", "Café R$ 50", "Meias R$50,00", "Caneca r$ 50.00", "R$ 0,01"])
      expect(giftWithinLimit(text)).toBe(true);
    for (const text of ["R$50,01", "R$50.01", "R$ 51", "R$1.000", "R$ 1.000,00", "De R$ 20 até R$ 70"])
      expect(giftWithinLimit(text)).toBe(false);
    expect(participantInput.safeParse({ name: "Ana", code: "1234", gifts: ["Livro R$50", "Caneca R$50", "Café R$50"] }).success).toBe(true);
  });
});
