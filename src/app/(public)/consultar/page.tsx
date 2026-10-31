"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Gift, KeyRound } from "lucide-react";
import { api, messageOf } from "@/lib/client-api";
import type { PublicEvent, Result } from "@/lib/types";
import { useFlow } from "@/components/flow-provider";
import { useResource } from "@/components/use-resource";
import { Alert, Button, ErrorBlock, LoadingBlock } from "@/components/ui";

export default function ConsultPage() {
  const event = useResource<PublicEvent>("/api/event");
  const participants = useResource<string[]>("/api/participants");
  const { setResult } = useFlow();
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function reveal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!name || !participants.data?.includes(name)) {
      setError("Selecione seu nome na lista.");
      return;
    }
    if (!code || code.length > 128) {
      setError("Digite seu código de acesso.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<Result>("/api/reveal", { name, code });
      setCode("");
      setResult(result);
      router.push("/resultado");
    } catch (reason) {
      setError(messageOf(reason));
      setBusy(false);
    }
  }
  return (
    <section className="narrow-page">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} />
        Voltar para o início
      </Link>
      <div className="center-card consult-card">
        <span className="round-icon">
          <Gift size={29} strokeWidth={1.5} />
        </span>
        <span className="eyebrow">O segredo está quase revelado</span>
        <h1>
          Quem será seu
          <br />
          <em>amigo secreto?</em>
        </h1>
        <p>
          Selecione seu nome e digite seu código pessoal. A surpresa é só
          sua.
        </p>
        {event.loading || participants.loading ? (
          <LoadingBlock />
        ) : event.error || participants.error ? (
          <ErrorBlock message={event.error || participants.error} retry={() => { void event.reload(); void participants.reload(); }} />
        ) : event.data && !event.data.draw_completed ? (
          <div className="pending-state">
            <KeyRound size={23} aria-hidden="true" />
            <h2>Ainda estamos guardando o segredo.</h2>
            <p>
              O sorteio ainda não foi realizado. Guarde seu código e volte
              quando a organização avisar.
            </p>
            <Button variant="secondary" onClick={() => { void event.reload(); void participants.reload(); }}>
              Verificar novamente
            </Button>
          </div>
        ) : !participants.data?.length ? (
          <p className="pending-state">Ainda não há participantes cadastrados.</p>
        ) : (
          <form onSubmit={reveal} className="form-stack text-left">
            <div className="field">
              <label htmlFor="consult-name">Selecione seu nome</label>
              <select id="consult-name" name="name" value={name}
                onChange={(e) => { setName(e.target.value); setCode(""); setError(""); }}
                required disabled={busy} aria-describedby="name-help">
                <option value="" disabled>Selecione seu nome</option>
                {participants.data.map((person) => <option key={person} value={person}>{person}</option>)}
              </select>
              <p id="name-help" className="field-help">
                Nomes iguais aparecem uma vez. Seu código identifica sua inscrição.
              </p>
            </div>
            <div className="field">
              <label htmlFor="consult-code">Digite seu código de acesso</label>
              <input
                id="consult-code"
                name="code"
                type="password"
                className="code-input"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Cole seu código aqui"
                required
                maxLength={128}
                disabled={busy}
                aria-describedby="code-help"
              />
              <p id="code-help" className="field-help">
                Use o código que você escolheu ao se inscrever. Códigos antigos também continuam válidos.
              </p>
            </div>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" busy={busy} className="button-full">
              {busy
                ? "Consultando seu sorteio…"
                : "Consultar meu amigo secreto"}
              <ArrowRight size={17} />
            </Button>
          </form>
        )}
        <p className="support-note">
          Não encontra seu código? Fale com a organização para receber um link e escolher outro código.
        </p>
      </div>
    </section>
  );
}
