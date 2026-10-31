import Link from "next/link";
import { ArrowLeft, Gift } from "lucide-react";

export default function NotFound() {
  return (
    <main id="main-content" className="standalone-state">
      <span className="round-icon">
        <Gift size={28} />
      </span>
      <span className="eyebrow">Parece que a surpresa está em outro lugar</span>
      <h1>Página não encontrada.</h1>
      <p className="muted">
        Este endereço não faz parte do evento. Volte ao início para continuar.
      </p>
      <Link className="button button-primary" href="/">
        <ArrowLeft size={17} />
        Voltar ao início
      </Link>
    </main>
  );
}
