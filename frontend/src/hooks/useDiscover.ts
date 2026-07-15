import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import type { BusinessCategory } from "./useAdminSettings";

export interface DiscoverBusiness {
  id: string;
  slug: string;
  name: string;
  category: BusinessCategory;
  branding: {
    bannerUrl: string;
    logoUrl: string;
    primaryColor: string;
  };
  contact: {
    latitude: number | null;
    longitude: number | null;
  };
  program: {
    rewardTitle: string;
  };
  createdAt: string;
  recentStampCount: number;
}

export function useDiscover() {
  return useQuery<DiscoverBusiness[]>({
    queryKey: ["discover"],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; businesses: DiscoverBusiness[] }>(
        "/api/customer-auth/discover",
        { role: "customer-global" },
      );
      return res.businesses || [];
    },
  });
}
