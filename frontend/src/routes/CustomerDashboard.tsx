import { useNavigate } from "react-router-dom";
import { Coffee, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useStampCard } from "../hooks/useStampCard";
import { PunchCard } from "../components/customer/PunchCard";
import { BottomNav } from "../components/customer/BottomNav";
import { ScannerModal } from "../components/customer/ScannerModal";

const TOTAL_STAMPS = 5;

export default function CustomerDashboard() {
  const [scanOpen, setScanOpen] = useState(false);
  const { user, isLoading, logout } = useCustomerAuth();
  const { data: stampData, isLoading: cardLoading } = useStampCard();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "customer")) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  if (isLoading || cardLoading || !user || user.role !== "customer") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212]">
        <div className="h-8 w-8 animate-spin rounded-full border border-[#EBE6DF] border-t-transparent" />
      </div>
    );
  }

  const stampsEarned = stampData?.stampsEarned ?? 0;

  return (
    <div className="min-h-screen w-full bg-[#121212] font-sans text-[#EBE6DF] flex items-center justify-center sm:py-8 px-0 sm:px-4">
      {/* Mobile-constrained frame, scales beautifully to tablet/desktop */}
      <div className="mx-auto flex min-h-screen sm:min-h-[85vh] w-full max-w-full sm:max-w-md md:max-w-lg flex-col bg-[#121212] text-[#EBE6DF] border-x-0 sm:border border-[#2D2D2D] rounded-none sm:rounded-[40px] overflow-hidden shadow-2xl">
        <ScannerModal open={scanOpen} onClose={() => setScanOpen(false)} />

        {/* Top Nav */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 xs:gap-3 border-b border-[#2D2D2D] bg-[#121212] px-3.5 xs:px-5 py-3 xs:py-4">
          <div className="flex min-w-0 items-center gap-2 xs:gap-3">
            <div className="grid h-8 w-8 xs:h-10 xs:w-10 shrink-0 place-items-center border border-[#2D2D2D] bg-[#1A1A1A] text-[#EBE6DF] rounded-[10px] xs:rounded-[16px]">
              <Coffee className="h-4 w-4 xs:h-5 xs:w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] xs:text-[10px] font-bold uppercase tracking-[0.12em] xs:tracking-[0.2em] text-[#A3A3A3] truncate">
                Cafe Coffesarowar
              </p>
              <h1 className="truncate text-xs xs:text-sm sm:text-base text-[#EBE6DF] font-serif font-normal">
                Welcome, {user.name}!
              </h1>
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex shrink-0 items-center rounded-[12px] xs:rounded-[20px] border border-[#2D2D2D] bg-[#1A1A1A] px-2 xs:px-3 py-1 xs:py-1.5 text-[9px] xs:text-xs font-bold text-[#EBE6DF] transition-colors hover:bg-[#EBE6DF] hover:text-black"
            aria-label="Log out"
          >
            <span>Logout</span>
          </button>
        </header>

        {/* Main */}
        <main className="flex-1 space-y-4 xs:space-y-5 px-3.5 xs:px-5 py-4 xs:py-6 bg-[#121212] overflow-y-auto">
          {/* Progress summary */}
          <div className="flex flex-col xs:flex-row xs:items-end justify-between gap-2.5 xs:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-lg xs:text-xl sm:text-2xl leading-tight text-[#EBE6DF] font-serif font-normal truncate">
                {stampsEarned} of {TOTAL_STAMPS} stamps
              </p>
              <p className="mt-0.5 text-[10px] xs:text-xs sm:text-sm text-[#A3A3A3] truncate">
                {TOTAL_STAMPS - stampsEarned} more to a free coffee.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-[16px] border border-[#2D2D2D] bg-[#1A1A1A] px-2.5 py-1 text-[9px] xs:text-[10px] font-bold uppercase tracking-wider text-[#EBE6DF] w-fit">
              <Gift className="h-3 w-3" /> Active
            </span>
          </div>

          {/* Stamp card */}
          <section
            className="relative overflow-hidden rounded-[24px] xs:rounded-[40px] border border-[#2D2D2D] bg-[#1A1A1A] p-3.5 xs:p-6 shadow-none"
            aria-label="Digital stamp card"
          >
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-[8px] xs:text-[10px] font-bold uppercase tracking-[0.2em] text-[#A3A3A3]">
                  Loyalty Card
                </p>
                <p className="text-[8px] xs:text-[10px] font-bold uppercase tracking-[0.2em] text-[#A3A3A3]">
                  No. 00421
                </p>
              </div>

              <PunchCard stampsEarned={stampsEarned} />

              <div className="mt-5 flex items-center justify-between gap-2 rounded-[16px] xs:rounded-[24px] border border-[#2D2D2D] bg-[#121212] px-3 xs:px-4 py-2 xs:py-3 min-w-0">
                <p className="text-[10px] xs:text-xs font-semibold text-[#A3A3A3] truncate">
                  Reward at stamp 5
                </p>
                <p className="text-[10px] xs:text-xs font-bold text-[#EBE6DF] shrink-0">
                  1 Free Coffee
                </p>
              </div>
            </div>
          </section>

          <p className="text-center text-[11px] xs:text-xs text-[#A3A3A3]">
            Tap Scan Counter QR at checkout to collect your stamp.
          </p>
        </main>

        {/* Shared Bottom Nav */}
        <BottomNav activeTab="dashboard" onScanClick={() => setScanOpen(true)} />
      </div>
    </div>
  );
}
