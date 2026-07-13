const API_URL =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (typeof window !== "undefined" ? "" : "http://localhost:5001");

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: any;
  role?: "admin" | "customer";
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (typeof window !== "undefined") {
    // Determine which token to send based on path or explicit role option
    const role = options.role || (path.startsWith("/api/admin") ? "admin" : "customer");
    const tokenKey = role === "admin" ? "admin_auth_token" : "customer_auth_token";
    const token = localStorage.getItem(tokenKey);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const { body, role, ...restOptions } = options;

  const config: RequestInit = {
    ...restOptions,
    headers,
  };

  if (body) {
    if (body instanceof FormData || typeof body === "string") {
      config.body = body;
    } else {
      config.body = JSON.stringify(body);
    }
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMsg = "Something went wrong";
    try {
      const errJson = await response.json();
      errorMsg = errJson.message || errorMsg;
    } catch (_) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  try {
    return (await response.json()) as T;
  } catch (_) {
    return {} as T;
  }
}

// Ported admin endpoints
export async function getRecentScans() {
  return apiRequest<{ success: boolean; data: any[] }>("/api/admin/recent-scans", { role: "admin" });
}

export async function generateQr() {
  return apiRequest<{ success: boolean; data: { token: string; expiresInSeconds: number } }>(
    "/api/admin/generate-qr",
    { method: "POST", role: "admin" }
  );
}

export async function redeemVoucher(voucherCode: string) {
  return apiRequest<{ success: boolean; message: string }>(
    "/api/admin/redeem-voucher",
    {
      method: "POST",
      body: { voucherCode },
      role: "admin",
    }
  );
}
