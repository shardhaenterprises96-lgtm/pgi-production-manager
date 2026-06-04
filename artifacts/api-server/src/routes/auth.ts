import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  usersTable,
  rolePermissionsTable,
} from "@workspace/db";
import {
  LoginBody,
  GetRolePermissionsResponse,
  UpdateRolePermissionsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Identity/session responses must NEVER be cached by the browser or proxies.
// Without this, the browser caches the authenticated `/auth/me` 200 (Express
// adds an ETag but no Cache-Control), so after a user clears their cookie the
// stale user object is served from disk cache and the SPA wrongly believes it
// is still authenticated. no-store forces a fresh request every time.
router.use("/auth", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Simple password check (in prod use bcrypt - spec says admin123, pass123)
function checkPassword(plain: string, hash: string): boolean {
  return plain === hash;
}

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user || !checkPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Subscription gating: if this user belongs to a tenant company, block login
  // when that company's subscription is expired or suspended. Admins are exempt
  // so the system owner can always manage the platform.
  if (user.role !== "admin" && user.companyId != null) {
    const subRes = await pool.query(
      `SELECT subscription_status, subscription_end_date
       FROM subscriptions
       WHERE company_id = $1
       ORDER BY subscription_end_date DESC
       LIMIT 1`,
      [user.companyId]
    );
    const sub = subRes.rows[0];
    const expired =
      !sub ||
      sub.subscription_status === "suspended" ||
      sub.subscription_status === "expired" ||
      new Date(sub.subscription_end_date) < new Date();
    if (expired) {
      res.status(403).json({
        error: "Your subscription has expired. Please contact administrator.",
      });
      return;
    }
  }

  // Store session — entityId is critical for salesman attribution & ledger scoping.
  (req as any).session = {
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    entityId: user.entityId ?? null,
  };

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    customerId: user.entityId ?? null,
  });
});

// POST /auth/logout
router.post("/auth/logout", async (_req, res): Promise<void> => {
  // Must clearCookie explicitly — sendStatus(204) bypasses the res.json patch
  // that normally handles cookie clearing.
  res.clearCookie("session", { path: "/" });
  res.sendStatus(204);
});

// GET /auth/me
router.get("/auth/me", async (req, res): Promise<void> => {
  const session = (req as any).session;
  if (!session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    customerId: user.entityId ?? null,
  });
});

// GET /auth/permissions
router.get("/auth/permissions", async (_req, res): Promise<void> => {
  const perms = await db.select().from(rolePermissionsTable);
  res.json(GetRolePermissionsResponse.parse(perms));
});

// PUT /auth/permissions
router.put("/auth/permissions", async (req, res): Promise<void> => {
  const parsed = UpdateRolePermissionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  for (const perm of parsed.data.permissions) {
    const existing = await db
      .select()
      .from(rolePermissionsTable)
      .where(
        and(
          eq(rolePermissionsTable.role, perm.role),
          eq(rolePermissionsTable.feature, perm.feature)
        )
      );

    if (existing.length > 0) {
      await db
        .update(rolePermissionsTable)
        .set({ allowed: perm.allowed })
        .where(
          and(
            eq(rolePermissionsTable.role, perm.role),
            eq(rolePermissionsTable.feature, perm.feature)
          )
        );
    } else {
      await db.insert(rolePermissionsTable).values({
        role: perm.role,
        feature: perm.feature,
        allowed: perm.allowed,
      });
    }
  }

  const updated = await db.select().from(rolePermissionsTable);
  res.json(updated);
});

export default router;
