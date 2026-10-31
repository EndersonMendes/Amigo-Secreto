"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui";

export function CodeCard({ name, code }: { name: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`Nome: ${name}\nCódigo: ${code}`);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <div className="code-card">
      <div className="eyebrow">
        <KeyRound size={14} aria-hidden="true" />
        Seu código pessoal
      </div>
      <code className="secret-code">{code}</code>
      <Button variant="secondary" onClick={copy}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Nome e código copiados" : "Copiar nome e código"}
      </Button>
      {copied && (
        <span className="sr-only" role="status">
          Nome e código copiados para a área de transferência.
        </span>
      )}
      {copyError && (
        <p className="field-help" role="alert">
          Não foi possível copiar. Selecione o código acima e copie manualmente.
        </p>
      )}
      <p className="small muted">
        Guarde em um lugar seguro. Ele não será exibido novamente e é necessário
        para ver seu amigo secreto.
      </p>
    </div>
  );
}
