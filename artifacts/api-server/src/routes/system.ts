import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";
import { isMultiCompanyMode, getDefaultCompanyId } from "../lib/system-config";

const router: IRouter = Router();

// GET /system/config — PUBLIC (no auth). Lets the login screen know whether to
// run in shared SaaS mode (generic branding) or dedicated single-company mode
// (show the fixed company name, no company selection). This is presentation
// only; real access control lives in the login handler + tenant middleware.
router.get("/system/config", async (_req, res): Promise<void> => {
  // Identity/branding config must not be cached across deployments.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  const multiCompanyMode = isMultiCompanyMode();
  const defaultCompanyId = getDefaultCompanyId();

  let company: { id: number; name: string } | null = null;
  if (!multiCompanyMode && defaultCompanyId != null) {
    const [c] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, defaultCompanyId));
    if (c) company = { id: c.id, name: c.name };
  }

  res.json({ multiCompanyMode, company });
});

export default router;
