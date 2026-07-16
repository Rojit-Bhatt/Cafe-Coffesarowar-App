// Every customer- and admin-facing tenant URL is two segments:
// /[company]/[outlet]/... — an outlet slug is only unique within its company,
// so a path can never be built from one slug alone.
//
// Build them here rather than interpolating by hand at ~30 call sites: one
// place to change, and a missing company segment becomes a type error rather
// than a URL that silently resolves to the wrong outlet (or to a company's
// redirect).
export function tenantPath(company: string, outlet: string, sub = ""): string {
  const base = `/${company}/${outlet}`;
  if (!sub) return base;
  return `${base}/${sub.replace(/^\/+/, "")}`;
}

// Absolute form, for QR codes and emails — anything that leaves the app and
// has to survive on its own.
export function tenantUrl(origin: string, company: string, outlet: string, sub = ""): string {
  return `${origin}${tenantPath(company, outlet, sub)}`;
}
