"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Save, Settings2 } from "lucide-react";
import { api, ApiError, messageOf } from "@/lib/client-api";
import type { AdminEvent } from "@/lib/types";
import { useResource } from "@/components/use-resource";
import { Alert, Button, ErrorBlock, LoadingBlock } from "@/components/ui";
import { PageHeading } from "@/components/admin-shell";

export default function SettingsPage() {
  const resource = useResource<AdminEvent>("/api/admin/event");
  const [form, setForm] = useState<AdminEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if (resource.data) setForm(resource.data);
  }, [resource.data]);
  function update<K extends keyof AdminEvent>(key: K, value: AdminEvent[K]) {
    if (form) {
      setForm({ ...form, [key]: value });
      setSuccess("");
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const saved = await api<AdminEvent>("/api/admin/event", {
        name: form.name,
        intro: form.intro,
        home_text: form.home_text,
        event_date: form.event_date || null,
        registrations_open: form.registrations_open,
        revision: form.revision,
      });
      resource.setData(saved);
      setForm(saved);
      setSuccess(
        "Configurações salvas. A página do evento já está atualizada.",
      );
    } catch (reason) {
      setError(messageOf(reason));
      if (reason instanceof ApiError && reason.status === 409) {
        await resource.reload();
        setError(
          `${messageOf(reason)} Recarregamos os dados atuais. Revise as opções e salve novamente.`,
        );
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="O evento com a sua cara"
        title="Configurações"
        description="Ajuste os detalhes e escolha o momento de receber inscrições."
      />
      {resource.loading && !form ? (
        <LoadingBlock />
      ) : resource.error ? (
        <ErrorBlock
          message={resource.error}
          retry={() => void resource.reload()}
        />
      ) : form ? (
        <form onSubmit={save} className="settings-form">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Detalhes do evento</h2>
                <p className="muted small">
                  Estas informações aparecem na página de inscrição.
                </p>
              </div>
              <Settings2 size={22} />
            </div>
            <div className="form-stack">
              <div className="field">
                <label htmlFor="event-name">Nome do evento</label>
                <input
                  id="event-name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="event-intro">Mensagem de boas-vindas</label>
                <textarea
                  id="event-intro"
                  rows={3}
                  value={form.intro}
                  onChange={(e) => update("intro", e.target.value)}
                  required
                  maxLength={500}
                  disabled={busy}
                />
                <p className="field-help">
                  Uma mensagem curta para entrar no clima da celebração.
                </p>
              </div>
              <div className="field">
                <label htmlFor="event-text">Texto da inscrição</label>
                <textarea
                  id="event-text"
                  rows={4}
                  value={form.home_text}
                  onChange={(e) => update("home_text", e.target.value)}
                  required
                  maxLength={1000}
                  disabled={busy}
                />
                <p className="field-help">
                  Inclua orientações úteis, como o valor combinado para os
                  presentes.
                </p>
              </div>
              <div className="field field-date">
                <label htmlFor="event-date">
                  <CalendarDays size={15} />
                  Data da troca de presentes
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={form.event_date || ""}
                  onChange={(e) => update("event_date", e.target.value || null)}
                  disabled={busy}
                />
                <p className="field-help">
                  Opcional. A data é informativa e não encerra inscrições
                  automaticamente.
                </p>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Recebimento de inscrições</h2>
                <p className="muted small">
                  Encerre as inscrições antes de realizar o sorteio.
                </p>
              </div>
            </div>
            <label className="switch-row" htmlFor="registrations-open">
              <div>
                <strong>
                  {form.registrations_open
                    ? "Inscrições abertas"
                    : "Inscrições encerradas"}
                </strong>
                <p>
                  {form.draw_completed
                    ? "Para reabrir as inscrições, reinicie o sorteio primeiro."
                    : "Quando abertas, novas pessoas podem participar pela página do evento."}
                </p>
              </div>
              <span className="switch">
                <input
                  id="registrations-open"
                  type="checkbox"
                  checked={form.registrations_open}
                  onChange={(e) =>
                    update("registrations_open", e.target.checked)
                  }
                  disabled={busy || form.draw_completed}
                />
                <span className="switch-track" />
              </span>
            </label>
          </section>
          {error && <Alert>{error}</Alert>}
          {success && <Alert success>{success}</Alert>}
          <div className="form-actions">
            <Button type="submit" busy={busy}>
              <Save size={17} />
              {busy ? "Salvando…" : "Salvar configurações"}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
