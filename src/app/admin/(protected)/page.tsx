"use client";

import Link from "next/link";
import { useState } from "react";
import { ClearDatabase } from "@/components/clear-database";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Gift,
  Settings2,
  Shuffle,
  Users,
} from "lucide-react";
import { useResource } from "@/components/use-resource";
import { Alert, ErrorBlock, LoadingBlock } from "@/components/ui";
import { PageHeading } from "@/components/admin-shell";
import { formatDate } from "@/lib/client-api";
import type { AdminEvent } from "@/lib/types";

export default function DashboardPage() {
  const event = useResource<AdminEvent>("/api/admin/event");
  const [success, setSuccess] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="Um olhar para os preparativos"
        title="Que bom ter você por aqui."
        description="Acompanhe seu evento e prepare a próxima surpresa."
      />
      {success && <Alert success>{success}</Alert>}
      {event.loading ? (
        <LoadingBlock />
      ) : event.error ? (
        <ErrorBlock message={event.error} retry={() => void event.reload()} />
      ) : event.data ? (
        <>
          <section className="event-banner">
            <div>
              <span className="eyebrow">Seu evento</span>
              <h2>{event.data.name}</h2>
              <p>
                <CalendarDays size={16} />
                {formatDate(event.data.event_date)}
              </p>
            </div>
            <Gift size={76} strokeWidth={0.8} aria-hidden="true" />
          </section>
          <div className="stats-grid">
            <article className="stat">
              <Users size={21} />
              <span>Participantes</span>
              <strong>{event.data.participant_count}</strong>
              <Link href="/admin/participantes">
                Ver lista completa
                <ArrowRight size={14} />
              </Link>
            </article>
            <article className="stat">
              <ClipboardList size={21} />
              <span>Inscrições</span>
              <strong className="stat-text">
                {event.data.registrations_open ? "Abertas" : "Encerradas"}
              </strong>
              <Link href="/admin/configuracoes">
                Gerenciar inscrições
                <ArrowRight size={14} />
              </Link>
            </article>
            <article className="stat">
              <Shuffle size={21} />
              <span>Sorteio</span>
              <strong className="stat-text">
                {event.data.draw_completed ? "Realizado" : "Aguardando"}
              </strong>
              <Link href="/admin/sorteio">
                {event.data.draw_completed
                  ? "Ver detalhes"
                  : "Preparar sorteio"}
                <ArrowRight size={14} />
              </Link>
            </article>
          </div>
          <section className="panel preparation-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Tudo pronto para a troca?</span>
                <h2>Um passo de cada vez</h2>
              </div>
              <Settings2 size={22} />
            </div>
            <ol className="checklist">
              <li className="checklist-done">
                <span>
                  <Check size={17} />
                </span>
                <div>
                  <strong>Prepare a página do evento</strong>
                  <p>
                    Personalize o nome, a data e a mensagem para seus amigos.
                  </p>
                </div>
                <Link
                  href="/admin/configuracoes"
                  aria-label="Editar configurações do evento"
                >
                  <ArrowRight size={19} />
                </Link>
              </li>
              <li
                className={
                  event.data.participant_count >= 2 ? "checklist-done" : ""
                }
              >
                <span>
                  {event.data.participant_count >= 2 ? (
                    <Check size={17} />
                  ) : (
                    "2"
                  )}
                </span>
                <div>
                  <strong>Reúna os participantes</strong>
                  <p>
                    Compartilhe a página do evento. São necessárias pelo menos 2
                    pessoas.
                  </p>
                </div>
                <Link
                  href="/admin/participantes"
                  aria-label="Ver participantes"
                >
                  <ArrowRight size={19} />
                </Link>
              </li>
              <li className={event.data.draw_completed ? "checklist-done" : ""}>
                <span>
                  {event.data.draw_completed ? <Check size={17} /> : "3"}
                </span>
                <div>
                  <strong>Encerre as inscrições e faça o sorteio</strong>
                  <p>
                    {event.data.draw_completed
                      ? `Sorteio realizado em ${formatDate(event.data.draw_at, true)}.`
                      : "Confira a lista antes de sortear. Depois, cada pessoa consulta seu resultado."}
                  </p>
                </div>
                <Link href="/admin/sorteio" aria-label="Ir para o sorteio">
                  <ArrowRight size={19} />
                </Link>
              </li>
            </ol>
          </section>
          <ClearDatabase event={event.data} onDone={() => {
            setSuccess("Base de dados limpa com sucesso. As inscrições estão abertas e as configurações foram preservadas.");
            void event.reload();
          }} />
        </>
      ) : null}
    </>
  );
}
