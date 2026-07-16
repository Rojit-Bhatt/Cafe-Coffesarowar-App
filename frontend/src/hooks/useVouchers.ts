import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { useTenant } from "../context/TenantContext";

export interface Voucher {
  voucherCode: string;
  isValid: boolean;
  earnedAt: string;
  expiresAt: string | null;
}

export function useVouchers() {
  const { slug } = useTenant();
  return useQuery<Voucher[]>({
    queryKey: ["vouchers", slug],
    queryFn: async () => {
      const response = await apiRequest<{ success: boolean; vouchers: Voucher[] }>(
        "/api/vouchers/my-wallet",
      );
      return response.vouchers || [];
    },
    staleTime: 1000 * 30, // 30 seconds cache duration
  });
}
