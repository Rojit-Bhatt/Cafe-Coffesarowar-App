import { useEffect } from "react";
import { useTenant } from "../../context/TenantContext";
import { useCustomerAuth } from "../../context/CustomerAuthContext";

// Rendered once per /:slug/* page (landing, login, register, claim,
// dashboard, ...) — this is what makes global-session recognition apply
// everywhere a customer can enter the app, not just the QR-claim flow.
export function TenantSessionSync() {
  const { tenant } = useTenant();
  const { ensureTenantSession } = useCustomerAuth();

  useEffect(() => {
    if (tenant) {
      ensureTenantSession(tenant.slug, tenant.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.slug, tenant?.id]);

  return null;
}

export default TenantSessionSync;
