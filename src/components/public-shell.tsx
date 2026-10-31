"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, LockKeyhole, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function Brand({ admin = false }: { admin?: boolean }) {
  return (
    <Link
      href={admin ? "/admin" : "/"}
      className="brand"
      aria-label={
        admin
          ? "Amigo secreto, painel de organização"
          : "Amigo secreto, página inicial"
      }
    >
      <span className="brand-mark">
        <Gift size={23} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span>
        amigo secreto
        <small>{admin ? "ÁREA DA ORGANIZAÇÃO" : "UM NATAL ENTRE AMIGOS"}</small>
      </span>
    </Link>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <div className="announcement">
        <Sparkles size={13} aria-hidden="true" />
        <span>Pequenos presentes. Grandes memórias.</span>
        <Sparkles size={13} aria-hidden="true" />
      </div>
      <header className="public-header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Navegação principal">
            <Link
              className={pathname === "/" ? "nav-active" : ""}
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
            >
              Participar
            </Link>
            <Link
              className={pathname === "/consultar" ? "nav-active" : ""}
              href="/consultar"
              aria-current={pathname === "/consultar" ? "page" : undefined}
            >
              Meu amigo secreto <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content">{children}</main>
      <footer className="public-footer container">
        <span>Feito para celebrar a alegria de presentear.</span>
        <Link href="/admin/login">
          <LockKeyhole size={13} aria-hidden="true" />
          Área da organização
        </Link>
      </footer>
    </>
  );
}
