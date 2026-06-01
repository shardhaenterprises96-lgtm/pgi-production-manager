import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { logger } from "./logger";

const SCHEMA_FILE_NAME = "production-schema.sql";

const DEFAULT_ADMIN = {
  username: "admin",
  passwordHash: "admin123",
  role: "admin",
  name: "Administrator",
} as const;

/**
 * Walk up from each start directory looking for the schema file. Returns the
 * first match. This makes the lookup robust across the local dev cwd
 * (artifacts/api-server) and the production container cwd (/app).
 */
function locateSchemaFile(): string | null {
  const override = process.env.PRODUCTION_SCHEMA_PATH;
  if (override) {
    return existsSync(override) ? path.resolve(override) : null;
  }

  const startDirs = new Set<string>([process.cwd()]);
  try {
    if (typeof __dirname === "string") startDirs.add(__dirname);
  } catch {
    // __dirname unavailable; ignore.
  }

  for (const start of startDirs) {
    let dir = path.resolve(start);
    // Walk up to the filesystem root.
    for (;;) {
      const candidate = path.join(dir, SCHEMA_FILE_NAME);
      if (existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return null;
}

/**
 * pg_dump emits psql meta-commands (e.g. \restrict, \unrestrict) that are not
 * valid SQL when sent over the wire via node-postgres. Strip any line that
 * begins with a backslash so the remaining statements execute cleanly.
 */
function stripPsqlMetaCommands(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("\\"))
    .join("\n");
}

async function usersTableExists(client: pg.Client): Promise<boolean> {
  const result = await client.query<{ reg: string | null }>(
    "SELECT to_regclass('public.users') AS reg;",
  );
  return result.rows[0]?.reg != null;
}

async function applySchema(client: pg.Client): Promise<void> {
  const schemaPath = locateSchemaFile();
  if (!schemaPath) {
    throw new Error(
      `Cannot bootstrap database: ${SCHEMA_FILE_NAME} not found. Set PRODUCTION_SCHEMA_PATH to its absolute path.`,
    );
  }

  logger.info({ schemaPath }, "Database is empty; applying schema");
  const rawSql = readFileSync(schemaPath, "utf8");
  const sql = stripPsqlMetaCommands(rawSql);
  await client.query(sql);
  logger.info("Database schema applied successfully");
}

async function ensureDefaultAdmin(client: pg.Client): Promise<void> {
  const result = await client.query(
    `INSERT INTO public.users (username, password_hash, role, name, is_active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (username) DO NOTHING
     RETURNING id;`,
    [
      DEFAULT_ADMIN.username,
      DEFAULT_ADMIN.passwordHash,
      DEFAULT_ADMIN.role,
      DEFAULT_ADMIN.name,
    ],
  );

  if ((result.rowCount ?? 0) > 0) {
    logger.info(
      { username: DEFAULT_ADMIN.username },
      "Default admin user created",
    );
  } else {
    logger.info(
      { username: DEFAULT_ADMIN.username },
      "Default admin user already exists; skipping",
    );
  }
}

/**
 * Idempotent startup bootstrap. Connects with a dedicated client (so the schema
 * dump's session-level SET statements never leak into the shared pool), creates
 * all tables from the schema file when the database is empty, and ensures the
 * default admin user exists. Never throws — failures are logged so the server
 * can still start and surface its health endpoint.
 */
export async function ensureDatabaseReady(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    logger.error("DATABASE_URL is not set; skipping database bootstrap");
    return;
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    if (await usersTableExists(client)) {
      logger.info("Database already initialized (users table present)");
    } else {
      await applySchema(client);
    }

    await ensureDefaultAdmin(client);
  } catch (err) {
    logger.error({ err }, "Database bootstrap failed");
  } finally {
    try {
      await client.end();
    } catch (endErr) {
      logger.error({ err: endErr }, "Failed to close bootstrap DB client");
    }
  }
}
