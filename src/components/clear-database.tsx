"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { api, messageOf } from "@/lib/client-api";
import type { AdminEvent } from "@/lib/types";
import { Alert, Button, Dialog } from "@/components/ui";

export function ClearDatabase({ event, onDone }: { event: AdminEvent; onDone: () => void }) {
  const [revision, setRevision] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function close() { setRevision(null); setConfirmation(""); setError(""); }
  async function clear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (revision === null || confirmation !== "LIMPAR BASE DE DADOS") return;
    setBusy(true); setError("");
    try {
      await api<AdminEvent>("/api/admin/clear", { confirmation, revision });
      close(); onDone();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  return (
    <section className="panel danger-zone clear-database">
      <div>
        <h2>Limpar base de dados</h2>
        <p>Apague as inscrições e os resultados para começar uma nova rodada.
          O nome, a data e as personalizações do evento serão mantidos.</p>
      </div>
      <Button variant="danger" onClick={() => setRevision(event.revision)}>
        <Trash2 size={17} aria-hidden="true" /> LIMPAR BASE DE DADOS
      </Button>
      {revision !== null && (
        <Dialog title="Limpar base de dados?" onClose={close} busy={busy}>
          <form onSubmit={clear} className="form-stack">
            <p>Esta ação apagará todos os participantes cadastrados, códigos de acesso
              armazenados, sugestões de presentes, links de redefinição e resultados do sorteio.</p>
            <p><strong>Não será possível recuperar esses dados pelo sistema.</strong>{" "}
              As inscrições serão reabertas para novos cadastros e um novo sorteio.
              As configurações do evento e a conta administrativa serão preservadas.</p>
            <div className="field">
              <label htmlFor="clear-confirmation">Digite LIMPAR BASE DE DADOS para confirmar</label>
              <input id="clear-confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off" required disabled={busy} />
            </div>
            {error && <Alert>{error}</Alert>}
            <div className="dialog-actions">
              <Button type="button" variant="secondary" disabled={busy} onClick={close}>Cancelar</Button>
              <Button type="submit" variant="danger" busy={busy} disabled={confirmation !== "LIMPAR BASE DE DADOS"}>
                Apagar dados e reabrir inscrições
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
