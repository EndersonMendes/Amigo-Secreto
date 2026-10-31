"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, messageOf } from "@/lib/client-api";

export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      const result = await api<T>(path, undefined, current.signal);
      if (!current.signal.aborted) setData(result);
      return result;
    } catch (reason) {
      if (!current.signal.aborted) setError(messageOf(reason));
      return null;
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
    return () => controller.current?.abort();
  }, [reload]);
  return { data, setData, error, loading, reload };
}
