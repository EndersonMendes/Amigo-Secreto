import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validateAccessCode, validateParticipant } from "../src/lib/client-api";

const fixture = vi.hoisted(() => ({
  event: { name: "Natal", intro: "Boas festas", home_text: "Participe", event_date: null,
    registrations_open: true, draw_completed: true, participant_count: 3 },
  names: ["Ana", "João", "Maria Silva"],
  error: "",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../src/components/flow-provider", () => ({ useFlow: () => ({ setResult: vi.fn(), setRegistration: vi.fn() }) }));
vi.mock("../src/components/use-resource", () => ({
  useResource: (path: string) => ({ data: path === "/api/participants" ? fixture.names : fixture.event,
    loading: false, error: fixture.error, reload: vi.fn() }),
}));
import ConsultPage from "../src/app/(public)/consultar/page";
import HomePage from "../src/app/(public)/page";
import { AccessCodeFields } from "../src/components/access-code-fields";

describe("formulários públicos", () => {
  beforeEach(() => { fixture.error = ""; fixture.event.draw_completed = true; fixture.names = ["Ana", "João", "Maria Silva"]; });
  it("renderiza a seleção com nomes vindos da API e exige código separado", () => {
    const html = renderToStaticMarkup(createElement(ConsultPage));
    expect(html).toContain('<select id="consult-name"');
    expect(html).toContain('<option value="Maria Silva">Maria Silva</option>');
    expect(html).toContain('type="password"');
    expect(html).toContain('name="code"');
    expect(html).toContain("Nomes iguais aparecem uma vez");
    expect(html).not.toContain('name="id"');
    expect(html).not.toContain("scrypt");
  });
  it("lista vazia não permite enviar uma consulta sem participante", () => {
    fixture.names = [];
    const html = renderToStaticMarkup(createElement(ConsultPage));
    expect(html).toContain("Ainda não há participantes cadastrados");
    expect(html).not.toContain('<form');
  });
  it("falha na carga mostra erro e opção de tentar novamente", () => {
    fixture.error = "Falha ao carregar participantes";
    const html = renderToStaticMarkup(createElement(ConsultPage));
    expect(html).toContain(fixture.error);
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain('<form');
  });
  it("cadastro mantém três sugestões e informa limite por presente e código escolhido", () => {
    fixture.event.draw_completed = false;
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html.match(/name="gift-[0-2]"/g)).toHaveLength(3);
    expect(html).toContain("R$ 50,00 por presente");
    expect(html).toContain("Guarde-o");
    expect(html).toContain('name="code-confirmation"');
  });
  it("campos secretos preservam zeros iniciais e oferecem teclado numérico sem type=number", () => {
    const html = renderToStaticMarkup(createElement(AccessCodeFields, {
      code: "0012", confirmation: "0012", setCode: vi.fn(), setConfirmation: vi.fn(),
    }));
    expect(html).toContain('value="0012"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('minLength="4"');
    expect(html).not.toContain('type="number"');
  });
});

describe("validação no formulário", () => {
  it("aceita números e códigos maiores preservando zeros, rejeita texto/espaços e divergência", () => {
    for (const code of ["0000", "0123456789", "1".repeat(128)]) expect(validateAccessCode(code, code)).toBeNull();
    for (const code of ["123", " 1234", "1234 ", "12-34", "1e10", "１２３４", "1".repeat(129)]) expect(validateAccessCode(code, code)).toBeTruthy();
    expect(validateAccessCode("0012", "0013")).toContain("não coincidem");
  });
  it("aplica R$50 a cada sugestão, mantendo exatamente três diferentes", () => {
    expect(validateParticipant("Ana", ["Livro R$ 50,00", "Caneca R$ 50", "Meias R$ 50.00"])).toBeNull();
    expect(validateParticipant("Ana", ["Livro R$ 50,01", "Caneca", "Meias"])).toContain("R$ 50,00");
    expect(validateParticipant("Ana", ["Livro", "Livro", "Meias"])).toBeTruthy();
    expect(validateParticipant("Ana", ["Livro", "Meias"])).toBeTruthy();
  });
});
