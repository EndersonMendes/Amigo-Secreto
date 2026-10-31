"use client";

import Link from "next/link";
import { Check, ArrowRight, ShieldCheck } from "lucide-react";
import { useFlow } from "@/components/flow-provider";
import { CodeCard } from "@/components/code-card";

export default function RegistrationCompletePage() {
  const { registration, setRegistration } = useFlow();
  if (!registration)
    return (
      <section className="narrow-page">
        <div className="center-card">
          <span className="round-icon">
            <ShieldCheck />
          </span>
          <span className="eyebrow">Seu código é pessoal</span>
          <h1>Vamos continuar?</h1>
          <p>
            O código escolhido aparece somente ao concluir a inscrição. Se você já se
            inscreveu, consulte o resultado com o nome e o código que guardou.
          </p>
          <p className="small muted">
            Perdeu o código? Peça à organização um link para escolher outro código.
          </p>
          <Link href="/consultar" className="button button-primary">
            Ir para a consulta
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    );
  return (
    <section className="narrow-page">
      <div className="center-card">
        <span className="round-icon success-icon">
          <Check size={30} />
        </span>
        <span className="eyebrow">Você faz parte dessa história</span>
        <h1>Presença confirmada!</h1>
        <p>
          <strong>{registration.name}</strong>, agora é só guardar seu código e
          esperar a hora da surpresa.
        </p>
        <CodeCard name={registration.name} code={registration.code} />
        <div className="note">
          <ShieldCheck size={19} aria-hidden="true" />
          <p>
            Seu nome e código dão acesso ao seu resultado. Não compartilhe. Ao
            sair desta tela, o código deixa de ser exibido.
          </p>
        </div>
        <Link
          className="button button-primary button-full"
          href="/consultar"
          onClick={() => setRegistration(null)}
        >
          Já guardei meu código
          <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}
