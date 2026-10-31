import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { PGlite } from "@electric-sql/pglite";

export const nativePostgres =
  process.env.TEST_DATABASE_ENGINE === "native" ||
  (process.env.TEST_DATABASE_ENGINE !== "wasm" && process.getuid?.() !== 0);
export interface TestClient {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
}
export interface TestPool {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  connect(): Promise<TestClient>;
  end(): Promise<void>;
}

async function startWasmDatabase(directory: string) {
  let engine = new PGlite(path.join(directory, "data"));
  let queue = Promise.resolve();
  const lock = async () => {
    const previous = queue;
    let unlock!: () => void;
    queue = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await previous;
    return unlock;
  };
  const query = async (
    text: string,
    values?: unknown[],
  ): Promise<QueryResult> => {
    const result = values?.length
      ? await engine.query<QueryResultRow>(text, values)
      : (await engine.exec(text)).at(-1);
    return {
      rows: (result?.rows ?? []) as QueryResultRow[],
      rowCount: result?.affectedRows ?? 0,
      command: "",
      oid: 0,
      fields: [],
    };
  };
  const pool: TestPool = {
    async query(text, values) {
      const unlock = await lock();
      try {
        return await query(text, values);
      } finally {
        unlock();
      }
    },
    async connect() {
      const unlock = await lock();
      return { query, release: unlock };
    },
    async end() {
      await engine.close();
    },
  };
  return {
    pool,
    async restart() {
      await engine.close();
      engine = new PGlite(path.join(directory, "data"));
      await engine.waitReady;
    },
    async stop() {
      await engine.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

/** An actual, isolated PostgreSQL cluster; never uses the application's database. */
export async function startTestDatabase(schemaPath = "supabase/schema.sql") {
  if (nativePostgres && process.getuid?.() === 0) {
    throw new Error(
      "PostgreSQL exige usuário sem privilégios. Execute os testes com setpriv --reuid=nobody --regid=nogroup --clear-groups node node_modules/vitest/vitest.mjs run.",
    );
  }
  const directory = await mkdtemp(path.join(tmpdir(), "amigo-postgres-"));
  const database = nativePostgres
    ? await startNativeDatabase(directory)
    : await startWasmDatabase(directory);
  try {
    await database.pool.query(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
    `);
    const schema = await readFile(
      path.join(process.cwd(), schemaPath),
      "utf8",
    ).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    if (schema) await database.pool.query(schema);
    return database;
  } catch (error) {
    await database.stop();
    throw error;
  }
}

async function startNativeDatabase(directory: string) {
  const port = await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as net.AddressInfo;
      server.close(() => resolve(address.port));
    });
  });
  const postgres = new EmbeddedPostgres({
    databaseDir: path.join(directory, "data"),
    user: "postgres",
    password: "ephemeral-test-password",
    port,
    persistent: true,
    createPostgresUser: false,
    // PG18 builtin C.UTF-8 gives Unicode simple case mapping independently of
    // installed OS locales. Keep other locale categories on portable C.
    initdbFlags: [
      "--encoding=UTF8",
      "--locale=C",
      "--lc-messages=C",
      "--locale-provider=builtin",
      "--builtin-locale=C.UTF-8",
    ],
    onLog: () => undefined,
    onError: () => undefined,
  });
  const makePool = () =>
    new Pool({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password: "ephemeral-test-password",
      database: "postgres",
      max: 32,
    });
  await postgres.initialise();
  await postgres.start();
  const database = {
    pool: makePool() as TestPool,
    async restart() {
      await database.pool.end();
      await postgres.stop();
      await postgres.start();
      database.pool = makePool();
    },
    async stop() {
      await database.pool.end();
      await postgres.stop();
      await rm(directory, { recursive: true, force: true });
    },
  };
  return database;
}

export type TestDatabase = Awaited<ReturnType<typeof startTestDatabase>>;
