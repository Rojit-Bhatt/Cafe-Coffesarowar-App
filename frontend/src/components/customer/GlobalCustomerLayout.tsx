import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { QrCode, Bell, Compass, Store } from "lucide-react";
import toast from "react-hot-toast";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { PLATFORM_NAME } from "../../lib/platform";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { GlobalScannerModal } from "./GlobalScannerModal";
import { useMyTenants } from "../../hooks/useMyTenants";

// The global (cross-tenant) customer app shell for /explore + /explore/mine —
// parallel to CustomerLayout.tsx but with no active TenantProvider/tenant
// JWT: it guards on the global CustomerAccount session only, and its bottom
// nav has just 2 tabs (no center scan FAB — the scanner lives in the top bar
// here, matching the per-tenant header's convention).
export function GlobalCustomerLayout() {
  const { globalAccount, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scanOpen, setScanOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  // Also warms the query cache Explore.tsx's "My Places" row and
  // ExploreMine.tsx both read from, so navigating between tabs is instant.
  const { isError: myTenantsError } = useMyTenants();

  useEffect(() => {
    if (!globalAccount) {
      navigate("/customer-login");
    }
  }, [globalAccount, navigate]);

  // A stale/expired/revoked global session token would otherwise strand the
  // customer here forever (globalAccount is just cached localStorage data,
  // never itself proof the token still verifies) — mirrors AdminGuard's
  // revalidate-on-401 pattern.
  useEffect(() => {
    if (myTenantsError && globalAccount) {
      logout();
      navigate("/customer-login");
    }
  }, [myTenantsError, globalAccount, logout, navigate]);

  if (!globalAccount) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
      </div>
    );
  }

  const activeTab = location.pathname === "/explore/mine" ? "mine" : "home";

  return (
    <div className="flex min-h-screen w-full items-start justify-center bg-[var(--bg)] px-0 py-0 sm:px-4 sm:py-8">
      <div className="flex min-h-screen w-full max-w-full flex-col overflow-hidden border-[var(--line)] bg-[var(--surface)] sm:min-h-[85vh] sm:max-w-[420px] sm:rounded-[40px] sm:border sm:shadow-xl">
        <GlobalScannerModal open={scanOpen} onClose={() => setScanOpen(false)} />

        <ConfirmDialog
          open={confirmLogoutOpen}
          onOpenChange={setConfirmLogoutOpen}
          title="Log out?"
          description="You'll need to sign in again to see your businesses."
          confirmLabel="Log out"
          confirmColor="var(--brand)"
          onConfirm={() => {
            logout();
            navigate("/customer-login");
          }}
        />

        <header className="flex flex-shrink-0 items-center justify-between px-5 pt-5">
          <span className="font-display text-xl font-bold" style={{ color: "var(--brand)" }}>
            {PLATFORM_NAME}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScanOpen(true)}
              aria-label="Scan a business's QR code"
              className="stamp-interactive flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--ink)]"
            >
              <QrCode className="h-4 w-4" />
            </button>
            <button
              onClick={() => toast("No notifications yet.")}
              aria-label="Notifications"
              className="stamp-interactive flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-container)] text-[var(--ink)]"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirmLogoutOpen(true)}
              aria-label="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "var(--brand)" }}
            >
              {(globalAccount.name || "?").charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>

        <footer className="relative flex-shrink-0 px-4 pb-5 pt-2">
          <div className="shadow-ambient relative mx-auto flex max-w-md items-center justify-around rounded-full bg-[var(--surface)] px-5 py-2">
            <Link
              to="/explore"
              className={`flex min-h-[44px] flex-col items-center justify-center gap-1 p-2 transition-colors ${
                activeTab === "home" ? "text-[var(--brand)]" : "text-[var(--soft)] hover:text-[var(--brand)]"
              }`}
              aria-label="Home"
            >
              <Compass className="h-5 w-5" strokeWidth={activeTab === "home" ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
            </Link>
            <Link
              to="/explore/mine"
              className={`flex min-h-[44px] flex-col items-center justify-center gap-1 p-2 transition-colors ${
                activeTab === "mine" ? "text-[var(--brand)]" : "text-[var(--soft)] hover:text-[var(--brand)]"
              }`}
              aria-label="My businesses"
            >
              <Store className="h-5 w-5" strokeWidth={activeTab === "mine" ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-wider">My Businesses</span>
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
export default GlobalCustomerLayout;
