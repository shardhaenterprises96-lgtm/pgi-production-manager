// Deployment-level configuration that decides whether this instance runs as a
// shared multi-tenant SaaS (company chosen per-user at login) or as a dedicated
// single-company install (locked to one company, e.g. handed to "Shradha
// Enterprises"). Driven by environment variables so the SAME codebase can be
// deployed in either mode without code changes.
//
//   MULTI_COMPANY_MODE = "true" (default) | "false"
//   DEFAULT_COMPANY_ID = <numeric company id>   (used only in dedicated mode)
//
// SECURITY: the frontend reads this config to adjust the login screen, but it is
// NEVER trusted for access control. Enforcement happens in the login handler and
// in every data route via the session companyId — see lib/tenant.ts.

export function isMultiCompanyMode(): boolean {
  const raw = (process.env.MULTI_COMPANY_MODE ?? "true").trim().toLowerCase();
  // Anything other than an explicit "false"/"0"/"no" keeps the default SaaS mode.
  return raw !== "false" && raw !== "0" && raw !== "no";
}

export function getDefaultCompanyId(): number | null {
  const raw = process.env.DEFAULT_COMPANY_ID;
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

// Single source of truth for "may this account be served by this deployment?".
// Used both at login and on every authenticated request (defense in depth).
//
// FAIL-CLOSED: in dedicated mode, if DEFAULT_COMPANY_ID is missing/invalid we
// deny all non-super_admin accounts rather than silently allowing everyone — a
// misconfigured dedicated install must never fall back to open multi-tenant
// access. The platform super_admin is always allowed so the operator can fix it.
export function isAccountAllowedHere(role: string, companyId: number | null): boolean {
  if (isMultiCompanyMode()) return true;
  if (role === "super_admin") return true;
  const defaultCompanyId = getDefaultCompanyId();
  if (defaultCompanyId == null) return false;
  return companyId === defaultCompanyId;
}
