"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  KeyRound,
  Pencil,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useResource } from "@/components/use-resource";
import {
  Alert,
  Button,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
} from "@/components/ui";
import { PageHeading } from "@/components/admin-shell";
import {
  ParticipantDialog,
  type ParticipantAction,
} from "@/components/participant-dialog";
import { formatDate } from "@/lib/client-api";
import type { AdminEvent, Participant } from "@/lib/types";

const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

export default function ParticipantsPage() {
  const participants = useResource<Participant[]>("/api/admin/participants");
  const event = useResource<AdminEvent>("/api/admin/event");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{
    participant: Participant;
    action: ParticipantAction;
  } | null>(null);
  const [success, setSuccess] = useState("");
  const filtered = useMemo(
    () =>
      (participants.data || []).filter((person) =>
        searchable(person.name).includes(searchable(search)),
      ),
    [participants.data, search],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const shownPage = Math.min(page, pageCount);
  const visible = filtered.slice((shownPage - 1) * 20, shownPage * 20);
  const loading = participants.loading || event.loading;
  const error = participants.error || event.error;
  const locked = event.data?.draw_completed ?? true;
  function done(message: string) {
    setSelected(null);
    setSuccess(message);
    void participants.reload();
    void event.reload();
  }
  return (
    <>
      <PageHeading
        eyebrow="As pessoas fazem a festa"
        title="Participantes"
        description="Confira inscrições, sugestões de presentes e ajude na redefinição do acesso."
      >
        {participants.data && (
          <a
            className="button button-secondary"
            href="/api/admin/export"
            download
          >
            <Download size={16} />
            Exportar CSV
          </a>
        )}
      </PageHeading>
      {success && <Alert success>{success}</Alert>}
      {locked && event.data && (
        <div className="note">
          <Users size={18} />
          <p>
            O sorteio já foi realizado. Nomes e presentes estão protegidos
            contra alterações. Você ainda pode gerar um link para redefinir o acesso.
          </p>
        </div>
      )}
      {loading ? (
        <LoadingBlock label="Carregando participantes…" />
      ) : error ? (
        <ErrorBlock
          message={error}
          retry={() => {
            void participants.reload();
            void event.reload();
          }}
        />
      ) : (
        <section className="panel participants-panel">
          <div className="list-toolbar">
            <div>
              <h2>
                Lista de participantes{" "}
                <span className="count-badge">
                  {participants.data?.length || 0}
                </span>
              </h2>
              <p className="muted small">
                Cada nome, uma boa surpresa por vir.
              </p>
            </div>
            <div className="search-field">
              <Search size={17} aria-hidden="true" />
              <label className="sr-only" htmlFor="participant-search">
                Buscar participante por nome
              </label>
              <input
                id="participant-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nome…"
              />
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              title={
                search
                  ? "Nenhum nome encontrado"
                  : "A lista está esperando seus amigos"
              }
            >
              {search
                ? "Experimente outra parte do nome ou limpe a busca."
                : "Compartilhe a página do evento e acompanhe as inscrições por aqui."}
            </EmptyState>
          ) : (
            <>
              <div className="table-scroll">
                <table role="table" className="participants-table">
                  <caption className="sr-only">
                    Participantes do amigo secreto
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Participante</th>
                      <th scope="col">Sugestões de presente</th>
                      <th scope="col">Inscrição</th>
                      <th scope="col" className="actions-cell">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((person, index) => (
                      <tr key={person.id}>
                        <td data-label="Participante">
                          <div className="person-cell">
                            <span
                              className={`avatar avatar-${index % 3}`}
                              aria-hidden="true"
                            >
                              {person.name
                                .split(/\s+/)
                                .filter(Boolean)
                                .map((part) => Array.from(part)[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <strong>{person.name}</strong>
                          </div>
                        </td>
                        <td data-label="Presentes">
                          <details className="gift-details">
                            <summary>Ver 3 sugestões</summary>
                            <ol>
                              {person.gifts.map((gift, i) => (
                                <li key={i}>{gift}</li>
                              ))}
                            </ol>
                          </details>
                        </td>
                        <td data-label="Inscrição" className="muted small">
                          {formatDate(person.created_at)}
                        </td>
                        <td data-label="Ações" className="actions-cell">
                          <div className="table-actions">
                            <button
                              className="icon-button"
                              disabled={locked}
                              title={
                                locked
                                  ? "Edição indisponível após o sorteio"
                                  : `Editar ${person.name}`
                              }
                              aria-label={`Editar ${person.name}`}
                              onClick={() =>
                                setSelected({
                                  participant: person,
                                  action: "edit",
                                })
                              }
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              title={`Redefinir acesso de ${person.name}`}
                              aria-label={`Gerar link de redefinição para ${person.name}`}
                              onClick={() =>
                                setSelected({
                                  participant: person,
                                  action: "reset",
                                })
                              }
                            >
                              <KeyRound size={16} />
                            </button>
                            <button
                              className="icon-button icon-danger"
                              disabled={locked}
                              title={
                                locked
                                  ? "Exclusão indisponível após o sorteio"
                                  : `Excluir ${person.name}`
                              }
                              aria-label={`Excluir ${person.name}`}
                              onClick={() =>
                                setSelected({
                                  participant: person,
                                  action: "delete",
                                })
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span className="muted small">
                  {filtered.length}{" "}
                  {filtered.length === 1
                    ? "participante encontrado"
                    : "participantes encontrados"}
                </span>
                <div>
                  <Button
                    variant="ghost"
                    disabled={shownPage === 1}
                    onClick={() => setPage(shownPage - 1)}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={17} />
                  </Button>
                  <span className="small">
                    {shownPage} de {pageCount}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={shownPage === pageCount}
                    onClick={() => setPage(shownPage + 1)}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={17} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      {selected && (
        <ParticipantDialog
          key={`${selected.participant.id}-${selected.action}`}
          participant={selected.participant}
          action={selected.action}
          onClose={() => setSelected(null)}
          onDone={done}
        />
      )}
    </>
  );
}
