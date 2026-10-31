"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="standalone-state">
      <span className="eyebrow">Uma pequena pausa nos preparativos</span>
      <h1>Não foi possível carregar.</h1>
      <p className="muted">
        O serviço pode estar indisponível ou aguardando configuração. Tente
        novamente em instantes. Se continuar, avise a organização.
      </p>
      <Button onClick={reset}>
        <RefreshCw size={17} />
        Tentar novamente
      </Button>
      <Link className="back-link" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
