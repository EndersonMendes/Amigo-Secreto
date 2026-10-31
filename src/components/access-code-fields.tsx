"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui";

export function AccessCodeFields({ code, confirmation, setCode, setConfirmation, disabled = false }: {
  code: string;
  confirmation: string;
  setCode: (value: string) => void;
  setConfirmation: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <fieldset className="access-code-fields" disabled={disabled}>
      <legend>Escolha seu código de acesso</legend>
      <p id={`${id}-help`} className="field-help">
        Escolha um código com no mínimo 4 dígitos.
        <strong> GUARDE SEU CÓDIGO!</strong> Ele será necessário para consultar quem você tirou no amigo secreto.
        A organização não consegue recuperar seu código.
      </p>
      <div className="field">
        <label htmlFor={`${id}-code`}>Seu código de acesso</label>
        <input id={`${id}-code`} name="code" type={visible ? "text" : "password"}
          inputMode="numeric" pattern="[0-9]{4,128}" minLength={4} maxLength={128}
          autoComplete="new-password" required value={code}
          onChange={(e) => setCode(e.target.value)} aria-describedby={`${id}-help`} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-confirm`}>Repita seu código</label>
        <input id={`${id}-confirm`} name="code-confirmation" type={visible ? "text" : "password"}
          inputMode="numeric" pattern="[0-9]{4,128}" minLength={4} maxLength={128}
          autoComplete="new-password" required value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)} />
      </div>
      <Button type="button" variant="ghost" aria-pressed={visible} onClick={() => setVisible(!visible)}>
        {visible ? "Ocultar código" : "Mostrar código"}
      </Button>
    </fieldset>
  );
}
