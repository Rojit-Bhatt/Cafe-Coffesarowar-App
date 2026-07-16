import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { useTenant } from "../context/TenantContext";

export interface CustomerMenuItem {
  id: string;
  name: string;
  description: string;
  price: number | null;
  category: string;
  isFeatured: boolean;
}

export function useCustomerMenu() {
  const { slug } = useTenant();
  return useQuery<{ menuEnabled: boolean; items: CustomerMenuItem[] }>({
    queryKey: ["customerMenu", slug],
    queryFn: async () => {
      const res = await apiRequest<{ success: boolean; menuEnabled: boolean; items: CustomerMenuItem[] }>(
        "/api/menu",
      );
      return { menuEnabled: res.menuEnabled, items: res.items || [] };
    },
    staleTime: 1000 * 30,
  });
}
