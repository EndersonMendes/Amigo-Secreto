"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { api, messageOf } from "@/lib/client-api";
import { Brand } from "@/components/public-shell";
import { WinterArt } from "@/components/winter-art";
import { Alert, Button } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/admin/login", { email, password });
      setPassword("");
      window.location.assign("/admin");
    } catch (reason) {
      setError(messageOf(reason));
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="login-page">
      <section className="login-decoration">
        <Brand />
        <div>
          <span className="eyebrow">A magia começa nos bastidores</span>
          <h1>
            Você organiza.
            <br />
            <em>O carinho acontece.</em>
          </h1>
          <p>
            Um lugar para cuidar de cada detalhe
            <br />
            da sua troca de presentes.
          </p>
          <WinterArt />
        </div>
        <span className="small muted">
          Amigo Secreto · Um Natal entre amigos
        </span>
      </section>
      <section className="login-form-wrap">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} />
          Voltar para o evento
        </Link>
        <div className="login-form">
          <span className="round-icon">
            <LockKeyhole size={24} />
          </span>
          <span className="eyebrow">Bem-vindo aos bastidores</span>
          <h2>Acesso da organização</h2>
          <p className="muted">
            Entre com sua conta de administrador para cuidar do evento.
          </p>
          <form onSubmit={login} className="form-stack">
            <div className="field">
              <label htmlFor="admin-email">E-mail</label>
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                required
                maxLength={254}
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-password">Senha</label>
              <div className="password-field">
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={256}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <Alert>{error}</Alert>}
            <Button className="button-full" type="submit" busy={busy}>
              {busy ? "Verificando acesso…" : "Entrar na organização"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="support-note">
            Acesso restrito à conta autorizada para este evento.
          </p>
        </div>
      </section>
    </main>
  );
}
