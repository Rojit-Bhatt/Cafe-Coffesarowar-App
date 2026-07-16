import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { useTenant } from "../context/TenantContext";

export interface StampCardData {
  stampsEarned: number;
  lastStampedAt: string | null;
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription: string;
}

export function useStampCard() {
  const { slug } = useTenant();
  return useQuery<StampCardData>({
    queryKey: ["stampCard", slug],
    queryFn: async () => {
      const response = await apiRequest<{ success: boolean; data: StampCardData }>(
        "/api/stamps/balance",
      );
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds cache duration
  });
}
