"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  RotateCcw,
  Shuffle,
  Users,
} from "lucide-react";
import { api, ApiError, formatDate, messageOf } from "@/lib/client-api";
import type { AdminEvent, DrawPair } from "@/lib/types";
import { useResource } from "@/components/use-resource";
import {
  Alert,
  Button,
  Dialog,
  ErrorBlock,
  LoadingBlock,
} from "@/components/ui";
import { PageHeading } from "@/components/admin-shell";

export default function DrawPage() {
  const event = useResource<AdminEvent>("/api/admin/event");
  const [dialog, setDialog] = useState<"draw" | "reset" | "pairs" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pairs, setPairs] = useState<DrawPair[] | null>(null);
  function openDialog(action: "draw" | "reset" | "pairs") {
    setError("");
    setConfirmation("");
    setDialog(action);
  }
  function closeDialog() {
    setDialog(null);
    setConfirmation("");
    setError("");
  }
  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event.data || !dialog) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (dialog === "pairs") {
        setPairs(await api<DrawPair[]>("/api/admin/draw"));
      } else {
        const updated = await api<AdminEvent>(
          dialog === "draw" ? "/api/admin/draw" : "/api/admin/reset",
          dialog === "draw"
            ? { confirmation, revision: event.data.revision }
            : { confirmation, draw_id: event.data.draw_id },
        );
        event.setData(updated);
        setPairs(null);
        setSuccess(
          dialog === "draw"
            ? "Sorteio realizado! Cada participante já pode consultar seu amigo secreto."
            : "Sorteio reiniciado. Os participantes e códigos foram preservados. Revise as inscrições antes de sortear novamente.",
        );
      }
      closeDialog();
    } catch (reason) {
      setError(messageOf(reason));
      if (reason instanceof ApiError && reason.status === 409) {
        closeDialog();
        setPairs(null);
        await event.reload();
        setError(
          `${messageOf(reason)} Os dados foram atualizados. Revise o evento antes de confirmar novamente.`,
        );
      }
    } finally {
      setBusy(false);
    }
  }
  const current = event.data;
  const ready =
    current && !current.registrations_open && current.participant_count >= 2;
  return (
    <>
      <PageHeading
        eyebrow="A hora da surpresa"
        title="Sorteio"
        description="Confira os preparativos e deixe a sorte aproximar seus amigos."
      />
      {success && <Alert success>{success}</Alert>}
      {error && !dialog && <Alert>{error}</Alert>}
      {event.loading ? (
        <LoadingBlock />
      ) : event.error ? (
        <ErrorBlock message={event.error} retry={() => void event.reload()} />
      ) : current ? (
        <>
          <section
            className={`panel draw-panel ${current.draw_completed ? "draw-completed" : ""}`}
          >
            <span className="round-icon">
              {current.draw_completed ? (
                <Check size={30} />
              ) : (
                <Shuffle size={29} strokeWidth={1.5} />
              )}
            </span>
            <span className="eyebrow">
              {current.draw_completed
                ? "Cada nome encontrou uma surpresa"
                : "Um encontro escolhido pela sorte"}
            </span>
            <h2>
              {current.draw_completed
                ? "O sorteio está pronto."
                : "Vamos espalhar o carinho?"}
            </h2>
            <p className="muted draw-description">
              {current.draw_completed
                ? `Realizado em ${formatDate(current.draw_at, true)}. Avise seus amigos: eles já podem consultar o resultado com o nome e o código pessoal.`
                : "Cada pessoa vai presentear e ser presenteada por alguém diferente. Ninguém tira o próprio nome."}
            </p>
            <div className="draw-facts">
              <span>
                <Users size={17} />
                <strong>{current.participant_count}</strong> participantes
              </span>
              <span>
                <LockKeyhole size={17} />
                {current.draw_completed
                  ? "Resultados disponíveis"
                  : "Consulta individual e privada"}
              </span>
            </div>
            {!current.draw_completed && (
              <>
                <ul className="draw-checks">
                  <li
                    className={
                      current.participant_count >= 2 ? "check-ready" : ""
                    }
                  >
                    <span>
                      {current.participant_count >= 2 ? (
                        <Check size={14} />
                      ) : (
                        "1"
                      )}
                    </span>
                    Pelo menos 2 participantes inscritos
                  </li>
                  <li
                    className={!current.registrations_open ? "check-ready" : ""}
                  >
                    <span>
                      {!current.registrations_open ? <Check size={14} /> : "2"}
                    </span>
                    Inscrições encerradas
                  </li>
                </ul>
                {current.registrations_open && (
                  <p className="small muted">
                    Encerre as inscrições nas{" "}
                    <Link href="/admin/configuracoes" className="text-link">
                      configurações
                    </Link>{" "}
                    para continuar.
                  </p>
                )}
                <Button disabled={!ready} onClick={() => openDialog("draw")}>
                  <Shuffle size={17} />
                  Realizar sorteio
                </Button>
              </>
            )}
            {current.draw_completed && (
              <Link className="button button-primary" href="/consultar">
                Ver página de consulta
                <ArrowRight size={17} />
              </Link>
            )}
          </section>
          {current.draw_completed && (
            <>
              <section className="panel privacy-panel">
                <div>
                  <h2>Resultados da organização</h2>
                  <p className="muted small">
                    A lista completa revela todos os pares. Abra somente se
                    precisar conferir o sorteio.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => (pairs ? setPairs(null) : openDialog("pairs"))}
                >
                  {pairs ? <EyeOff size={17} /> : <Eye size={17} />}
                  {pairs ? "Ocultar resultados" : "Ver todos os pares"}
                </Button>
              </section>
              {pairs && (
                <section className="panel pairs-panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Informação reservada</span>
                      <h2>Pares do sorteio</h2>
                    </div>
                    <Button variant="ghost" onClick={() => setPairs(null)}>
                      <EyeOff size={16} />
                      Ocultar
                    </Button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">
                        Pares do sorteio: quem presenteia e quem recebe
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Quem presenteia</th>
                          <th scope="col">Quem recebe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pairs.map((pair, index) => (
                          <tr key={index}>
                            <td>{pair.giver}</td>
                            <td>
                              <span className="pair-receiver">
                                <ArrowRight size={15} aria-hidden="true" />
                                {pair.receiver}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              <section className="danger-zone">
                <div>
                  <h2>Reiniciar sorteio</h2>
                  <p>
                    Apaga todos os pares desta rodada. Os participantes e seus
                    códigos são preservados.
                  </p>
                </div>
                <Button variant="danger" onClick={() => openDialog("reset")}>
                  <RotateCcw size={16} />
                  Reiniciar sorteio
                </Button>
              </section>
            </>
          )}
        </>
      ) : null}
      {dialog && current && (
        <Dialog
          title={
            dialog === "draw"
              ? "Tudo pronto para sortear?"
              : dialog === "reset"
                ? "Reiniciar este sorteio?"
                : "Revelar todos os pares?"
          }
          onClose={closeDialog}
          busy={busy}
        >
          <form className="form-stack" onSubmit={confirm}>
            {dialog === "draw" ? (
              <>
                <p className="dialog-copy">
                  O sorteio incluirá{" "}
                  <strong>{current.participant_count} participantes</strong>.
                  Nomes e sugestões não poderão ser alterados após esta ação.
                </p>
                <p className="small muted">
                  Confira a lista antes de continuar. Cada pessoa terá acesso
                  apenas ao próprio resultado.
                </p>
              </>
            ) : dialog === "reset" ? (
              <>
                <p className="dialog-copy">
                  Todos os resultados da rodada de{" "}
                  <strong>{formatDate(current.draw_at, true)}</strong> serão
                  apagados. Quem já consultou precisará consultar novamente após
                  um novo sorteio.
                </p>
                <p className="small muted">
                  Esta ação não pode ser desfeita. As inscrições continuarão
                  encerradas até você reabri-las.
                </p>
              </>
            ) : (
              <p className="dialog-copy">
                Você verá quem cada participante tirou. Esta informação é
                reservada à organização. Deseja revelar a lista completa agora?
              </p>
            )}
            {dialog !== "pairs" && (
              <div className="field">
                <label htmlFor="draw-confirmation">
                  Digite{" "}
                  <strong>
                    {dialog === "draw"
                      ? "REALIZAR SORTEIO"
                      : "REINICIAR SORTEIO"}
                  </strong>{" "}
                  para confirmar
                </label>
                <input
                  id="draw-confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  required
                />
              </div>
            )}
            {error && <Alert>{error}</Alert>}
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={closeDialog}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant={dialog === "reset" ? "danger" : "primary"}
                busy={busy}
                disabled={
                  dialog !== "pairs" &&
                  confirmation !==
                    (dialog === "draw"
                      ? "REALIZAR SORTEIO"
                      : "REINICIAR SORTEIO")
                }
              >
                {dialog === "draw"
                  ? "Confirmar sorteio"
                  : dialog === "reset"
                    ? "Apagar esta rodada"
                    : "Sim, revelar todos os pares"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
