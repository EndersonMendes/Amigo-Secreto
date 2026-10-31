import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Amigo Secreto de Natal", template: "%s | Amigo Secreto" },
  description:
    "Um Natal entre amigos. Participe, compartilhe suas sugestões de presente e descubra seu amigo secreto com privacidade.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#main-content">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
