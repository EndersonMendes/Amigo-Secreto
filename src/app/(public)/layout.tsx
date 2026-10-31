import type { ReactNode } from "react";
import { FlowProvider } from "@/components/flow-provider";
import { PublicShell } from "@/components/public-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <FlowProvider>
      <PublicShell>{children}</PublicShell>
    </FlowProvider>
  );
}
