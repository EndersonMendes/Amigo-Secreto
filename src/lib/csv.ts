export function participantsCsv(
  participants: readonly {
    name: string;
    gifts: readonly string[];
    created_at: string;
  }[],
): string {
  const cell = (value: string) =>
    '"' +
    (/^[=+@\-\t\r\n]/.test(value) ? "'" + value : value).replaceAll('"', '""') +
    '"';
  const rows = [
    ["Nome", "Sugestão 1", "Sugestão 2", "Sugestão 3", "Inscrição (UTC)"],
    ...participants.map((p) => [p.name, ...p.gifts, p.created_at]),
  ];
  return (
    "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n"
  );
}
