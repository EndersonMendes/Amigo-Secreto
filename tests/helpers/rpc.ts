import type { Rpc } from "../../src/lib/repository";
import { databaseError } from "../../src/lib/errors";
import type { TestDatabase } from "./postgres";
/** Adaptador de testes para executar as mesmas RPCs no PostgreSQL isolado. */
export function testRpc(database: () => TestDatabase): Rpc {
  return {
    async call<T>(name: string, args: Record<string, unknown> = {}) {
      if (
        !/^as_[a-z_]+$/.test(name) ||
        Object.keys(args).some((k) => !/^p_[a-z_]+$/.test(k))
      )
        throw new Error("RPC inválida");
      const keys = Object.keys(args);
      const values = Object.values(args).map((v) =>
        Array.isArray(v) && v.some((i) => typeof i === "object")
          ? JSON.stringify(v)
          : v,
      );
      try {
        const r = await database().pool.query(
          `SELECT public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(",")}) AS value`,
          values,
        );
        return r.rows[0].value as T;
      } catch (error) {
        throw databaseError((error as Error).message);
      }
    },
  };
}
