"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { AccessCodeFields } from "@/components/access-code-fields";
import { CodeCard } from "@/components/code-card";
import { Alert, Button, LoadingBlock } from "@/components/ui";
import { api, messageOf, validateAccessCode } from "@/lib/client-api";
import type { Registration } from "@/lib/types";

export default function ResetCodePage() {
  const initialized = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [receipt, setReceipt] = useState<(Registration & { code: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    // Fragmento nunca é enviado ao servidor; retire-o também do histórico local.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    setToken(value);
    setReady(true);
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const invalid = validateAccessCode(code, confirmation);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      const result = await api<Registration>("/api/reset-code", { token, code });
      setReceipt({ ...result, code });
      setCode(""); setConfirmation(""); setToken(null);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  return (
    <section className="narrow-page">
      <div className="center-card">
        <span className="round-icon"><KeyRound size={28} /></span>
        <span className="eyebrow">Seu acesso à surpresa</span>
        <h1>{receipt ? "Código atualizado!" : "Escolha um novo código"}</h1>
        {!ready ? <LoadingBlock /> : receipt ? (
          <>
            <p><strong>{receipt.name}</strong>, seu código anterior deixou de funcionar. Guarde o novo código.</p>
            <CodeCard name={receipt.name} code={receipt.code} />
            <Link href="/consultar" className="button button-primary" onClick={() => setReceipt(null)}>
              Já guardei. Consultar meu amigo secreto
            </Link>
          </>
        ) : !token ? (
          <>
            <p>Abra o link completo enviado pela organização. Por segurança, ele fica disponível nesta tela somente até você sair ou recarregar a página.</p>
            <Link href="/consultar" className="button button-secondary">Ir para a consulta</Link>
          </>
        ) : (
          <form onSubmit={submit} className="form-stack text-left">
            <p>Este link vale por 30 minutos e pode ser usado uma vez. Seu código atual será substituído quando você confirmar.</p>
            <AccessCodeFields code={code} confirmation={confirmation} setCode={setCode}
              setConfirmation={setConfirmation} disabled={busy} />
            {error && <Alert>{error}</Alert>}
            <Button type="submit" busy={busy} className="button-full">Salvar meu novo código</Button>
          </form>
        )}
      </div>
    </section>
  );
}
