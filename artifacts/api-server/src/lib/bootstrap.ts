import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { logger } from "./logger";

const SCHEMA_FILE_NAME = "production-schema.sql";
const SEED_FILE_NAME = "production-seed-data.sql";

const DEFAULT_ADMIN = {
  username: "admin",
  passwordHash: "admin123",
  role: "admin",
  name: "Administrator",
} as const;

/**
 * Walk up from each start directory looking for a repo-root file. Returns the
 * first match. This makes the lookup robust across the local dev cwd
 * (artifacts/api-server) and the production container cwd (/app).
 */
function locateRepoFile(fileName: string): string | null {
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
      const candidate = path.join(dir, fileName);
      if (existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return null;
}

function locateSchemaFile(): string | null {
  const override = process.env.PRODUCTION_SCHEMA_PATH;
  if (override) {
    return existsSync(override) ? path.resolve(override) : null;
  }
  return locateRepoFile(SCHEMA_FILE_NAME);
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

/**
 * One-time business-data seed. Loads production-seed-data.sql (the development
 * company-8 dataset) ONLY when the products table is empty, so a freshly
 * provisioned production database comes up populated with real data instead of
 * a blank slate. Every statement in the file is conflict-safe (ON CONFLICT DO
 * NOTHING / user upserts) and the whole load runs inside a single transaction,
 * so it is safe to ship and a no-op once data exists.
 */
async function seedBusinessDataIfEmpty(client: pg.Client): Promise<void> {
  const productsReg = await client.query<{ reg: string | null }>(
    "SELECT to_regclass('public.products') AS reg;",
  );
  if (productsReg.rows[0]?.reg == null) {
    logger.info("products table missing; skipping data seed");
    return;
  }

  const countResult = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM public.products;",
  );
  const productCount = Number(countResult.rows[0]?.count ?? "0");
  if (productCount > 0) {
    logger.info(
      { productCount },
      "Business data already present; skipping data seed",
    );
    return;
  }

  const seedPath = locateRepoFile(SEED_FILE_NAME);
  if (!seedPath) {
    logger.warn(
      { seedFile: SEED_FILE_NAME },
      "Seed file not found; leaving database empty",
    );
    return;
  }

  logger.info({ seedPath }, "Products table empty; loading business data seed");
  const rawSql = readFileSync(seedPath, "utf8");
  const sql = stripPsqlMetaCommands(rawSql);
  await client.query("BEGIN;");
  try {
    await client.query(sql);
    await client.query("COMMIT;");
    logger.info("Business data seed loaded successfully");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  }
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

    await seedBusinessDataIfEmpty(client);
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
