import { useAdminAuth } from "@/context/AdminAuthContext";
import { Coffee, LogOut, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const { user, logout } = useAdminAuth();

  return (
    <header className="border-b border-[#2D2D2D] bg-[#1A1A1A] px-4 sm:px-6 py-4">
      <div className="mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between max-w-7xl">
        {/* Left Section: Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2D2D2D] bg-[#121212]">
            <Coffee className="h-5 w-5 text-[#EBE6DF]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2">
              <h1 className="text-sm xs:text-base font-semibold text-[#EBE6DF] font-serif truncate">
                Coffeesarowar Cafe
              </h1>
              <span className="hidden xs:inline text-xs text-[#A3A3A3] font-sans font-medium">
                / Staff System Portal
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A3A3A3] block xs:hidden">
              Staff System Portal
            </p>
          </div>
        </div>

        {/* Right Section: Staff, Status Indicators, and Logout */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 xs:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Terminal Badge */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#2D2D2D] bg-[#121212] px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[#A3A3A3]">
              <Monitor className="h-3 w-3 hidden xs:inline" />
              <span className="hidden sm:inline">Terminal 01</span>
              <span className="inline sm:hidden">T01</span>
            </span>

            {/* Counter Online Badge / Status Dot */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2D2D2D] bg-[#121212] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
              </span>
              <span className="hidden xs:inline">Counter Online</span>
              <span className="inline xs:hidden">Online</span>
            </span>

            {/* Staff Info */}
            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-[#EBE6DF] truncate max-w-[120px]">{user?.name}</p>
              <p className="text-[9px] uppercase tracking-wider text-[#A3A3A3]">Barista</p>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            onClick={logout}
            variant="outline"
            className="border-[#2D2D2D] bg-[#121212] hover:bg-[#EBE6DF] hover:text-black text-[#EBE6DF] text-xs gap-1.5 px-3 py-1.5 h-8 xs:h-9"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

