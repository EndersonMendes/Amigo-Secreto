import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
