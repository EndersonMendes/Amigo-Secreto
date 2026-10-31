"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Registration, Result } from "@/lib/types";

type RegistrationReceipt = Registration & { code: string };

type Flow = {
  registration: RegistrationReceipt | null;
  setRegistration: (value: RegistrationReceipt | null) => void;
  result: Result | null;
  setResult: (value: Result | null) => void;
};
const FlowContext = createContext<Flow | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<RegistrationReceipt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/inscricao-concluida") setRegistration(null);
    if (pathname !== "/resultado") setResult(null);
  }, [pathname]);
  return (
    <FlowContext.Provider
      value={{ registration, setRegistration, result, setResult }}
    >
      {children}
    </FlowContext.Provider>
  );
}

export function useFlow() {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error("O fluxo precisa de um provedor.");
  return flow;
}
