"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Gift,
  LockKeyhole,
  Sparkles,
  Users,
} from "lucide-react";
import {
  api,
  formatDate,
  messageOf,
  validateParticipant,
  validateAccessCode,
} from "@/lib/client-api";
import type { Gifts, PublicEvent, Registration } from "@/lib/types";
import { useResource } from "@/components/use-resource";
import { useFlow } from "@/components/flow-provider";
import { WinterArt } from "@/components/winter-art";
import { AccessCodeFields } from "@/components/access-code-fields";
import { ParticipantFields } from "@/components/participant-fields";
import { Alert, Button, ErrorBlock, LoadingBlock } from "@/components/ui";

export default function HomePage() {
  const event = useResource<PublicEvent>("/api/event");
  const router = useRouter();
  const { setRegistration } = useFlow();
  const [name, setName] = useState("");
  const [gifts, setGifts] = useState<Gifts>(["", "", ""]);
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const invalid = validateParticipant(name, gifts) || validateAccessCode(code, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const registration = await api<Registration>("/api/register", {
        name,
        gifts,
        code,
      });
      setRegistration({ ...registration, code });
      setCode("");
      setConfirmation("");
      router.push("/inscricao-concluida");
    } catch (reason) {
      setError(messageOf(reason));
      void event.reload();
      setBusy(false);
    }
  }
  const open = event.data?.registrations_open && !event.data.draw_completed;
  return (
    <div className="container home">
      <div className="home-layout">
        <section className="hero">
          <div className="eyebrow">
            <span className="gold-line" />O espírito do Natal está nos detalhes
          </div>
          <h1>
            O melhor presente
            <br />é estar <em>junto.</em>
          </h1>
          <p className="hero-description">
            {event.data?.intro ||
              "Uma troca de carinho, uma boa surpresa e mais um motivo para celebrar entre amigos."}
          </p>
          <WinterArt />
          <div className="hero-caption">
            <span />
            Um segredo. Muitas boas surpresas.
            <span />
          </div>
        </section>
        <section
          className="registration-card"
          aria-labelledby="registration-title"
        >
          <div className="card-accent" />
          <div className="card-heading">
            <span className="eyebrow">Reserve seu lugar na troca</span>
            <h2 id="registration-title">
              {event.data?.name || "Amigo Secreto de Natal"}
            </h2>
          </div>
          {event.loading && !event.data ? (
            <LoadingBlock />
          ) : event.error ? (
            <ErrorBlock
              message={event.error}
              retry={() => void event.reload()}
            />
          ) : event.data ? (
            <>
              <div className="event-facts">
                <span>
                  <CalendarDays size={15} aria-hidden="true" />
                  {formatDate(event.data.event_date)}
                </span>
                <span
                  className={`status ${open ? "status-open" : "status-closed"}`}
                >
                  <span className="status-dot" />
                  {event.data.draw_completed
                    ? "Sorteio realizado"
                    : open
                      ? "Inscrições abertas"
                      : "Inscrições encerradas"}
                </span>
              </div>
              <p className="card-description">{event.data.home_text}</p>
              {open ? (
                <form onSubmit={register} className="form-stack">
                  <ParticipantFields
                    name={name}
                    gifts={gifts}
                    setName={setName}
                    setGifts={setGifts}
                    disabled={busy}
                  />
                  <AccessCodeFields code={code} confirmation={confirmation}
                    setCode={setCode} setConfirmation={setConfirmation} disabled={busy} />
                  {error && <Alert>{error}</Alert>}
                  <Button type="submit" className="button-full" busy={busy}>
                    {busy ? "Confirmando inscrição…" : "Quero participar"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </Button>
                  <div className="privacy-copy">
                    <p className="form-privacy">
                      <LockKeyhole size={13} aria-hidden="true" />
                      Seu resultado é protegido por um código pessoal.
                    </p>
                    <p className="field-help">
                      A organização pode consultar os cadastros e os pares do
                      sorteio.
                    </p>
                  </div>
                </form>
              ) : (
                <div className="registration-closed">
                  <Gift size={31} strokeWidth={1.4} aria-hidden="true" />
                  <h3>
                    {event.data.draw_completed
                      ? "A surpresa já está esperando."
                      : "Estamos preparando a surpresa."}
                  </h3>
                  <p>
                    {event.data.draw_completed
                      ? "Se você já se inscreveu, selecione seu nome e use seu código para descobrir quem vai presentear."
                      : "As inscrições estão encerradas. Aguarde a organização realizar o sorteio."}
                  </p>
                  <Link href="/consultar" className="button button-primary">
                    Consultar meu amigo
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              )}
              <div className="card-bottom">
                <Users size={15} aria-hidden="true" />
                <span>
                  {event.data.participant_count}{" "}
                  {event.data.participant_count === 1
                    ? "pessoa participando"
                    : "pessoas participando"}
                </span>
              </div>
            </>
          ) : null}
        </section>
      </div>
      <section className="how-it-works" aria-labelledby="how-title">
        <div className="how-heading">
          <Sparkles size={16} aria-hidden="true" />
          <h2 id="how-title">A magia acontece assim</h2>
        </div>
        <ol className="steps">
          <li>
            <span className="step-number">01</span>
            <div>
              <h3>Entre na brincadeira</h3>
              <p>Conte seu nome, dê três ideias e escolha seu código.</p>
            </div>
          </li>
          <li>
            <span className="step-number">02</span>
            <div>
              <h3>Guarde seu código</h3>
              <p>Ele é sua chave pessoal para a surpresa.</p>
            </div>
          </li>
          <li>
            <span className="step-number">03</span>
            <div>
              <h3>Descubra e surpreenda</h3>
              <p>Após o sorteio, veja quem você vai presentear.</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
