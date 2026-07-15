import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";

export interface MyTenantMembership {
  organizationId: string;
  slug: string;
  name: string;
  branding: {
    logoUrl: string;
    bannerUrl: string;
    primaryColor: string;
  };
  stampsEarned: number;
  stampsRequired: number;
  rewardTitle: string;
  validVoucherCount: number;
  lastStampedAt: string | null;
}

export function useMyTenants() {
  return useQuery<MyTenantMembership[]>({
    queryKey: ["myTenants"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; memberships: MyTenantMembership[] }>(
        "/api/customer-auth/my-tenants",
        { role: "customer-global" },
      );
      return res.memberships || [];
    },
  });
}
