import React, { createContext, useContext, useState } from "react";

export interface CompanyAccount {
  id: string;
  name: string;
  email: string;
}

export interface CompanyInfo {
  slug: string;
  name: string;
}

interface CompanyAuthContextType {
  account: CompanyAccount | null;
  company: CompanyInfo | null;
  logout: () => void;
}

const CompanyAuthContext = createContext<CompanyAuthContextType | undefined>(undefined);

// Session state for a signed-in company owner. There is deliberately no
// login() here: every staff sign-in goes through the one unified form
// (routes/AdminLogin), which decides company-owner vs outlet-admin from the
// credentials alone and writes whichever session applies. This context only
// reads back what that flow persisted.
export function CompanyAuthProvider({ children }: { children: React.ReactNode }) {
  const read = <T,>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };

  const [account] = useState<CompanyAccount | null>(() => read<CompanyAccount>("company_account"));
  const [company] = useState<CompanyInfo | null>(() => read<CompanyInfo>("company_info"));

  const logout = () => {
    localStorage.removeItem("company_session");
    localStorage.removeItem("company_account");
    localStorage.removeItem("company_info");
    window.location.href = "/admin-login";
  };

  return (
    <CompanyAuthContext.Provider value={{ account, company, logout }}>
      {children}
    </CompanyAuthContext.Provider>
  );
}

export function useCompanyAuth() {
  const context = useContext(CompanyAuthContext);
  if (context === undefined) {
    throw new Error("useCompanyAuth must be used within a CompanyAuthProvider");
  }
  return context;
}
