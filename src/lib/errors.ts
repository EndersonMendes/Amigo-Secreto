export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}
const errors: Record<string, [number, string]> = {
  DUPLICATE_NAME: [
    409,
    "Este nome já está cadastrado. Use seu nome completo ou procure o administrador.",
  ],
  LEGACY_CODE_LENGTH: [409, "Enquanto houver códigos antigos, escolha 4 a 31 ou 33 a 128 dígitos. Peça ao administrador links de redefinição para migrar os códigos antigos."],
  DUPLICATE_CODE: [409, "Este código já está em uso. Escolha outro código."],
  INVALID_RECOVERY: [401, "Link de redefinição inválido, usado ou expirado. Peça um novo ao administrador."],
  INVALID_INPUT: [400, "Confira os campos preenchidos e tente novamente."],
  REGISTRATION_CLOSED: [409, "As inscrições estão encerradas."],
  DRAW_EXISTS: [
    409,
    "O sorteio já foi realizado. Os resultados foram preservados.",
  ],
  DRAW_PENDING: [409, "O sorteio ainda não foi realizado. Volte mais tarde."],
  REGISTRATION_OPEN: [
    409,
    "Encerre as inscrições antes de realizar o sorteio.",
  ],
  TOO_FEW_PARTICIPANTS: [409, "São necessários pelo menos dois participantes."],
  STALE_EVENT: [
    409,
    "O evento foi atualizado. Recarregue a página antes de confirmar.",
  ],
  INVALID_DRAW: [
    409,
    "Não foi possível validar o sorteio. Nenhum resultado foi alterado.",
  ],
  NOT_FOUND: [404, "Cadastro não encontrado. Recarregue a página."],
  PARTICIPANT_LIMIT: [
    409,
    "O limite de 1.000 participantes deste evento foi atingido.",
  ],
};
export function databaseError(message: string): AppError {
  const entry = errors[message];
  return entry
    ? new AppError(message, ...entry)
    : new AppError(
        "UNAVAILABLE",
        503,
        "O serviço está indisponível no momento. Tente novamente em instantes.",
      );
}
export const invalidCredentials = () =>
  new AppError(
    "INVALID_CREDENTIALS",
    401,
    "Nome ou código inválidos. Confira os dados e tente novamente.",
  );
