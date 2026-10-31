"use client";

import { useId } from "react";
import type { Gifts } from "@/lib/types";

export function ParticipantFields({
  name,
  gifts,
  setName,
  setGifts,
  disabled = false,
  admin = false,
}: {
  name: string;
  gifts: Gifts;
  setName: (name: string) => void;
  setGifts: (gifts: Gifts) => void;
  disabled?: boolean;
  admin?: boolean;
}) {
  const id = useId();
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-name`}>
          {admin ? "Nome completo" : "Seu nome completo"}{" "}
          <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${id}-name`}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          placeholder="Como seus amigos conhecem você?"
          disabled={disabled}
          aria-describedby={`${id}-name-help`}
        />
        <p id={`${id}-name-help`} className="field-help">
          {admin
            ? "Este nome aparecerá na lista de consulta do resultado."
            : "Seu nome aparecerá na lista para você selecionar na consulta."}
        </p>
      </div>
      <fieldset className="gift-fields" disabled={disabled}>
        <legend>
          {admin ? "Sugestões de presente" : "O que você gostaria de ganhar?"}{" "}
          <span aria-hidden="true">*</span>
        </legend>
        <p className="field-help">
          Três ideias diferentes para ajudar quem tirar você.
        </p>
        <p className="gift-budget-note">
          Na hora de escolher seus presentes, lembre-se de que nosso limite é de{" "}
          <strong>R$ 50,00</strong>. Assim, todos conseguem participar
          e aproveitar a brincadeira!
        </p>
        {gifts.map((gift, index) => (
          <div className="gift-input" key={index}>
            <span aria-hidden="true">0{index + 1}</span>
            <label className="sr-only" htmlFor={`${id}-gift-${index}`}>
              Sugestão de presente {index + 1}
            </label>
            <input
              id={`${id}-gift-${index}`}
              name={`gift-${index}`}
              value={gift}
              onChange={(event) => {
                const next = [...gifts] as Gifts;
                next[index] = event.target.value;
                setGifts(next);
              }}
              required
              maxLength={160}
              placeholder={
                [
                  "Ex.: um livro de romance",
                  "Ex.: uma caneca da minha série favorita",
                  "Ex.: uma carteira nova",
                ][index]
              }
            />
          </div>
        ))}
      </fieldset>
    </>
  );
}
