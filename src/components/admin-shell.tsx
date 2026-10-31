"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  LayoutDashboard,
  LogOut,
  Settings2,
  Shuffle,
  Users,
} from "lucide-react";
import { api, messageOf } from "@/lib/client-api";
import { Brand } from "@/components/public-shell";
import { Alert, Button } from "@/components/ui";

const navigation = [
  { href: "/admin", title: "Visão geral", Icon: LayoutDashboard },
  { href: "/admin/participantes", title: "Participantes", Icon: Users },
  { href: "/admin/sorteio", title: "Sorteio", Icon: Shuffle },
  { href: "/admin/configuracoes", title: "Configurações", Icon: Settings2 },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/logout", {});
      window.location.assign("/admin/login");
    } catch (reason) {
      setError(messageOf(reason));
      setBusy(false);
    }
  }
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Brand admin />
        <div className="sidebar-label">Seu evento, bem organizado</div>
        <nav aria-label="Navegação da organização">
          {navigation.map(({ href, title, Icon }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "admin-nav-active" : ""}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.7} />
              {title}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="sidebar-public-link" href="/">
            Ver página do evento
            <ArrowUpRight size={16} />
          </Link>
          <p>
            O cuidado com os detalhes
            <br />
            também é um presente.
          </p>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>
            <span className="secure-dot" />
            Área da organização
          </span>
          <Button variant="ghost" busy={busy} onClick={logout}>
            <LogOut size={15} />
            Sair
          </Button>
        </header>
        <main id="main-content" className="admin-content">
          {error && <Alert>{error}</Alert>}
          {children}
        </main>
        <footer className="admin-footer">
          Amigo Secreto · Um Natal entre amigos
        </footer>
      </div>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
