import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { useAdminSettings } from "../../hooks/useAdminSettings";
import { VerifyEmailGate } from "./VerifyEmailGate";
import { SuspendedOverlay } from "./SuspendedOverlay";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const { data: settings, isLoading: settingsLoading, isError: settingsError, error: settingsErrorObj } = useAdminSettings();
  const suspended = (settingsErrorObj as (Error & { code?: string }) | null)?.code === "TENANT_SUSPENDED";

  // Latched, not read live: AdminLayout (rendered as `children` below) also
  // calls useAdminSettings() itself, so mounting/unmounting it in direct
  // response to this same query's transient state creates a feedback loop
  // — AdminLayout's fresh observer re-triggers a background refetch of the
  // already-errored query, which flips this query's loading state again,
  // which would unmount AdminLayout again, which mounts a fresh observer...
  // Latching means once we've identified a suspended tenant, the blurred
  // children stay mounted continuously regardless of later flicker.
  const [suspendedLatched, setSuspendedLatched] = useState(false);
  useEffect(() => {
    if (suspended) setSuspendedLatched(true);
    else if (settings) setSuspendedLatched(false);
  }, [suspended, settings]);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "business_admin")) {
      navigate(slug ? `/${slug}/admin/login` : "/");
    }
  }, [user, isLoading, navigate, slug]);

  // A cached token can outlive the session it names (backend data reset,
  // token expiry). Without this, a stale token stuck the guard in a
  // permanent "Verifying credentials" loop — the settings fetch kept
  // 401ing while the guard kept trusting the stale localStorage user.
  // A SUSPENDED tenant is deliberately excluded here — that case shows the
  // blur overlay below instead of logging the admin out.
  useEffect(() => {
    if (settingsError && user && !suspended && !suspendedLatched) {
      logout();
      navigate(slug ? `/${slug}/admin/login` : "/");
    }
  }, [settingsError, user, suspended, suspendedLatched, logout, navigate, slug]);

  if (isLoading || (user && user.role === "business_admin" && settingsLoading && !suspended && !suspendedLatched)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212]">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#EBE6DF] animate-pulse">
          Verifying credentials...
        </div>
      </div>
    );
  }

  if (!user || user.role !== "business_admin") {
    return null;
  }

  if (suspended || suspendedLatched) {
    return (
      <div className="relative min-h-screen">
        <div className="pointer-events-none select-none blur-sm">{children}</div>
        <SuspendedOverlay onLogout={() => { logout(); navigate(slug ? `/${slug}/admin/login` : "/"); }} />
      </div>
    );
  }

  if (settings && !settings.adminEmailVerified) {
    return <VerifyEmailGate />;
  }

  return <>{children}</>;
}
