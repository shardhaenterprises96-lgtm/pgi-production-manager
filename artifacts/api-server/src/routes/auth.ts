import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
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

  // Store session — entityId is critical for salesman attribution & ledger scoping
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
