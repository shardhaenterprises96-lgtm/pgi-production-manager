import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import JSZip from "jszip";
import { db, usersTable, pool } from "@workspace/db";
import { UpdateBackupSettingsBody } from "@workspace/api-zod";
import { getCompanyId } from "../lib/tenant";
import { getCurrentCompany } from "../lib/company";
import { COMPANY_TABLES } from "../lib/company-data";

const router: IRouter = Router();

const BACKUP_FORMAT = "shradha-erp-backup";
const BACKUP_VERSION = 1;

// Admin-only guard, identical in spirit to the one in settings.ts: re-reads the
// user row so a stale/disabled admin session cannot reach these routes.
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = (req as any).session;
  if (!session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  if (!current || !current.isActive || current.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

function mapSettings(row: any) {
  return {
    dailyEnabled: row?.daily_enabled ?? false,
    weeklyEnabled: row?.weekly_enabled ?? false,
    monthlyEnabled: row?.monthly_enabled ?? false,
    lastDailyAt: row?.last_daily_at ? new Date(row.last_daily_at).toISOString() : null,
    lastWeeklyAt: row?.last_weekly_at ? new Date(row.last_weekly_at).toISOString() : null,
    lastMonthlyAt: row?.last_monthly_at ? new Date(row.last_monthly_at).toISOString() : null,
  };
}

async function resolveSettings(companyId: number) {
  const r = await pool.query(`SELECT * FROM backup_settings WHERE company_id = $1`, [companyId]);
  return mapSettings(r.rows[0]);
}

// Build the complete, tenant-scoped backup package object. Every table in
// COMPANY_TABLES is read with WHERE company_id so the package can only ever
// contain the caller's own company data.
async function buildBackupPackage(req: Request, companyId: number): Promise<{
  pkg: Record<string, unknown>;
  counts: Record<string, number>;
}> {
  const company = await getCurrentCompany(companyId);
  const session = (req as any).session;

  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of COMPANY_TABLES) {
    // Table names come from a fixed allow-list constant, never user input.
    const r = await pool.query(`SELECT * FROM ${table} WHERE company_id = $1 ORDER BY id`, [companyId]);
    tables[table] = r.rows;
    counts[table] = r.rows.length;
  }

  const pkg = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    companyId,
    companyName: company?.name ?? null,
    createdAt: new Date().toISOString(),
    createdBy: { userId: session?.userId ?? null, name: session?.name ?? null },
    counts,
    tables,
  };
  return { pkg, counts };
}

// GET /system/backup-settings — automatic-backup cadence preferences (admin only).
router.get("/system/backup-settings", requireAdmin, async (req, res): Promise<void> => {
  const companyId = getCompanyId(req);
  res.json(await resolveSettings(companyId));
});

// PUT /system/backup-settings — update cadence preferences (admin only). NOTE:
// this only persists the preference; the scheduler that acts on it is delivered
// in a later batch.
router.put("/system/backup-settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateBackupSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const session = (req as any).session;
  const companyId = getCompanyId(req);

  const current = await pool.query(`SELECT * FROM backup_settings WHERE company_id = $1`, [companyId]);
  const merged = {
    daily_enabled: parsed.data.dailyEnabled ?? current.rows[0]?.daily_enabled ?? false,
    weekly_enabled: parsed.data.weeklyEnabled ?? current.rows[0]?.weekly_enabled ?? false,
    monthly_enabled: parsed.data.monthlyEnabled ?? current.rows[0]?.monthly_enabled ?? false,
  };

  await pool.query(
    `INSERT INTO backup_settings (company_id, daily_enabled, weekly_enabled, monthly_enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (company_id) DO UPDATE SET
       daily_enabled = EXCLUDED.daily_enabled,
       weekly_enabled = EXCLUDED.weekly_enabled,
       monthly_enabled = EXCLUDED.monthly_enabled,
       updated_at = NOW()`,
    [companyId, merged.daily_enabled, merged.weekly_enabled, merged.monthly_enabled],
  );
  await pool.query(
    `INSERT INTO audit_log (company_id, action, description, user_id, user_name, metadata)
     VALUES ($1, 'backup_settings_updated', $2, $3, $4, $5)`,
    [
      companyId,
      "Automatic backup preferences updated",
      session?.userId ?? 1,
      session?.name ?? "Unknown",
      JSON.stringify(merged),
    ],
  );

  res.json(await resolveSettings(companyId));
});

// GET /system/backups — backup history (admin only).
router.get("/system/backups", requireAdmin, async (req, res): Promise<void> => {
  const companyId = getCompanyId(req);
  const r = await pool.query(
    `SELECT * FROM backups WHERE company_id = $1 ORDER BY created_at DESC, id DESC`,
    [companyId],
  );
  res.json(
    r.rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      sizeBytes: Number(row.size_bytes ?? 0),
      type: row.type,
      tableCounts: row.table_counts ?? {},
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: new Date(row.created_at).toISOString(),
    })),
  );
});

// GET /system/backup/download?format=zip|json — generate a manual backup and
// stream it to the admin's browser. This is a file download (not JSON), so it is
// implemented as a plain authenticated route rather than a generated hook; the
// signed session cookie authenticates the same-origin request. A history row is
// logged (type='manual', storage_key=null — the file is not retained server-side).
router.get("/system/backup/download", requireAdmin, async (req, res): Promise<void> => {
  const companyId = getCompanyId(req);
  const session = (req as any).session;
  const format = req.query.format === "json" ? "json" : "zip";

  const { pkg, counts } = await buildBackupPackage(req, companyId);
  const json = JSON.stringify(pkg, null, 2);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const baseName = `shradha-backup-${companyId}-${stamp}`;

  let body: Buffer;
  let fileName: string;
  let contentType: string;
  if (format === "json") {
    body = Buffer.from(json, "utf8");
    fileName = `${baseName}.json`;
    contentType = "application/json";
  } else {
    const zip = new JSZip();
    zip.file(`${baseName}.json`, json);
    body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    fileName = `${baseName}.zip`;
    contentType = "application/zip";
  }

  await pool.query(
    `INSERT INTO backups (company_id, file_name, storage_key, size_bytes, type, table_counts, created_by, created_by_name)
     VALUES ($1, $2, NULL, $3, 'manual', $4, $5, $6)`,
    [companyId, fileName, body.length, JSON.stringify(counts), session?.userId ?? 1, session?.name ?? "Unknown"],
  );
  await pool.query(
    `INSERT INTO audit_log (company_id, action, description, user_id, user_name, metadata)
     VALUES ($1, 'backup_created', $2, $3, $4, $5)`,
    [
      companyId,
      `Manual backup downloaded (${fileName}, ${body.length} bytes)`,
      session?.userId ?? 1,
      session?.name ?? "Unknown",
      JSON.stringify({ format, fileName, sizeBytes: body.length, counts }),
    ],
  );

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", String(body.length));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).end(body);
});

export default router;
