"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Gift,
  Heart,
  LockKeyhole,
  Sparkles,
  X,
} from "lucide-react";
import { useFlow } from "@/components/flow-provider";
import { Button } from "@/components/ui";

export default function ResultPage() {
  const { result, setResult } = useFlow();
  const [opened, setOpened] = useState(false);
  if (!result)
    return (
      <section className="narrow-page">
        <div className="center-card">
          <span className="round-icon">
            <LockKeyhole />
          </span>
          <span className="eyebrow">Um segredo bem guardado</span>
          <h1>
            Sua surpresa
            <br />
            continua por aqui.
          </h1>
          <p>
            Por privacidade, o resultado não fica salvo nesta tela. Use seu nome
            e código para consultá-lo novamente.
          </p>
          <Link href="/consultar" className="button button-primary">
            Consultar meu resultado
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    );
  return (
    <section className="narrow-page">
      <div
        className={`center-card result-card ${opened ? "result-opened" : ""}`}
      >
        <span className="eyebrow">
          <Sparkles size={15} />
          Um pequeno momento de magia
        </span>
        {!opened ? (
          <>
            <div className="gift-reveal-art" aria-hidden="true">
              <span className="gift-reveal-bow" />
              <span className="gift-reveal-lid" />
              <span className="gift-reveal-box" />
              <span className="gift-reveal-ribbon" />
              <span className="gift-spark spark-one">✦</span>
              <span className="gift-spark spark-two">✧</span>
            </div>
            <h1>
              Tem uma surpresa
              <br />
              esperando por você.
            </h1>
            <p>
              Seu amigo secreto já foi escolhido.
              <br />
              Pronto para descobrir?
            </p>
            <Button className="button-full" onClick={() => setOpened(true)}>
              Abrir meu presente
              <Gift size={18} />
            </Button>
          </>
        ) : (
          <div className="revealed-content" role="status" aria-live="polite">
            <span className="round-icon">
              <Heart size={28} strokeWidth={1.5} />
            </span>
            <p className="result-label">Seu amigo secreto é</p>
            <h1 className="recipient-name">{result.name}</h1>
            <div className="ornamental-rule">
              <span />
              <Sparkles size={17} />
              <span />
            </div>
            <h2 className="suggestion-title">
              Um pouco de inspiração para presentear
            </h2>
            <ol className="gift-suggestions">
              {result.gifts.map((gift, index) => (
                <li key={index}>
                  <span>0{index + 1}</span>
                  <p>{gift}</p>
                  <Gift size={17} aria-hidden="true" />
                </li>
              ))}
            </ol>
            <p className="result-wish">
              As sugestões do seu Amigo Secreto servem de inspiração! Lembre-se de respeitar
              nosso limite de <strong>R$ 50,00 </strong> na escolha
              do presente. O mais importante é participar e aproveitar esse momento!
            </p>
          </div>
        )}
        <p className="form-privacy">
          <LockKeyhole size={13} />
          Guarde esse segredo até a troca de presentes.
        </p>
        <Link
          href="/consultar"
          className="button button-ghost button-full"
          onClick={() => setResult(null)}
        >
          <X size={16} />
          Fechar e ocultar resultado
        </Link>
      </div>
    </section>
  );
}
