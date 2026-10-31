"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Save, Trash2 } from "lucide-react";
import { api, messageOf, validateParticipant } from "@/lib/client-api";
import type { Gifts, Participant } from "@/lib/types";
import { Alert, Button, Dialog } from "@/components/ui";
import { ParticipantFields } from "@/components/participant-fields";

export type ParticipantAction = "edit" | "delete" | "reset";

export function ParticipantDialog({
  participant,
  action,
  onClose,
  onDone,
}: {
  participant: Participant;
  action: ParticipantAction;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState(participant.name);
  const [gifts, setGifts] = useState<Gifts>(participant.gifts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<{ name: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (action === "edit") {
      const invalid = validateParticipant(name, gifts);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    setBusy(true);
    try {
      if (action === "reset") {
        const result = await api<{ name: string; token: string }>("/api/admin/reset-code", {
          id: participant.id,
        });
        setRecovery({ name: result.name, link: `${window.location.origin}/redefinir-codigo#token=${encodeURIComponent(result.token)}` });
      } else {
        await api(
          "/api/admin/participants",
          action === "edit"
            ? { action, id: participant.id, name, gifts }
            : { action, id: participant.id },
        );
        onDone(
          action === "edit"
            ? "Participante atualizado."
            : "Participante excluído.",
        );
      }
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        recovery
          ? "Link para escolher outro código"
          : {
              edit: "Editar participante",
              delete: "Excluir participante?",
              reset: "Permitir a troca de código?",
            }[action]
      }
      onClose={onClose}
      busy={busy}
    >
      {recovery ? (
        <>
          <p className="muted">Entregue este link somente a <strong>{recovery.name}</strong>,
            após confirmar a identidade da pessoa. Ela escolherá um novo código sem que você precise conhecê-lo.</p>
          <div className="field">
            <label htmlFor="recovery-link">Link temporário, válido por 30 minutos</label>
            <textarea id="recovery-link" readOnly value={recovery.link} rows={4} onFocus={(e) => e.target.select()} />
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="dialog-actions">
            <Button variant="secondary" onClick={async () => {
              try { await navigator.clipboard.writeText(recovery.link); setCopied(true); setError(""); }
              catch { setError("Não foi possível copiar. Selecione e copie o link manualmente."); }
            }}>{copied ? "Link copiado" : "Copiar link"}</Button>
            <Button onClick={() => onDone("Link de redefinição criado. O código será alterado quando o participante usar o link.")}>Concluir</Button>
          </div>
          <p className="small muted">O link funciona uma vez e deixa de aparecer ao fechar esta janela.
            O código atual continua válido até a troca ser concluída.</p>
        </>
      ) : (
        <form onSubmit={submit} className="form-stack">
          {action === "edit" ? (
            <ParticipantFields
              admin
              name={name}
              gifts={gifts}
              setName={setName}
              setGifts={setGifts}
              disabled={busy}
            />
          ) : (
            <p className="dialog-copy">
              {action === "delete" ? (
                <>
                  Você vai excluir <strong>{participant.name}</strong> da lista.
                  A inscrição e o código de acesso serão removidos. Esta ação
                  não pode ser desfeita.
                </>
              ) : (
                <>
                  Você vai gerar um link temporário para <strong>{participant.name}</strong>{" "}
                  escolher outro código. Links anteriores de redefinição deixarão de funcionar.
                  O painel não exibe o código atual nem o novo.
                </>
              )}
            </p>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={action === "delete" ? "danger" : "primary"}
              busy={busy}
            >
              {action === "edit" ? (
                <Save size={16} />
              ) : action === "delete" ? (
                <Trash2 size={16} />
              ) : (
                <KeyRound size={16} />
              )}
              {action === "edit"
                ? "Salvar alterações"
                : action === "delete"
                  ? "Sim, excluir participante"
                  : "Gerar link de redefinição"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
