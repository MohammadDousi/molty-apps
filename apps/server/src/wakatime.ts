import type { DailyStatStatus } from "@molty/shared";

export type WakaTimeResult = {
  status: DailyStatStatus;
  totalSeconds: number;
  error?: string | null;
  fetchedAt: number;
};

export type WakaTimeClient = {
  getStatusBarToday: (username: string, apiKey: string) => Promise<WakaTimeResult>;
};

type CacheEntry = {
  dateKey: string;
  fetchedAt: number;
  result: WakaTimeResult;
};

const DEFAULT_TTL_MS = 2 * 60 * 1000;

export const createWakaTimeClient = ({
  fetcher = globalThis.fetch,
  ttlMs = DEFAULT_TTL_MS
}: {
  fetcher?: typeof fetch;
  ttlMs?: number;
} = {}): WakaTimeClient => {
  const cache = new Map<string, CacheEntry>();

  const extractErrorMessage = async (response: Response): Promise<string | null> => {
    try {
      const clone = response.clone();
      const contentType = clone.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = (await clone.json()) as {
          error?: string;
          errors?: string[] | string;
          message?: string;
        };
        const errorValue = payload.error ?? payload.message ?? payload.errors;
        if (typeof errorValue === "string" && errorValue.trim()) {
          return errorValue.trim();
        }
        if (Array.isArray(errorValue) && errorValue.length) {
          return errorValue.filter(Boolean).join(", ").trim();
        }
      }
    } catch {
      // Ignore parsing failures.
    }

    try {
      const text = await response.clone().text();
      return text.trim() || null;
    } catch {
      return null;
    }
  };

  const getStatusBarToday = async (username: string, apiKey: string): Promise<WakaTimeResult> => {
    const cacheKey = `${username}:${apiKey}`;
    const dateKey = new Date().toISOString().slice(0, 10);
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.dateKey === dateKey && now - cached.fetchedAt < ttlMs) {
      return cached.result;
    }

    const url = new URL(`https://wakatime.com/api/v1/users/${encodeURIComponent(username)}/status_bar/today`);
    const auth = Buffer.from(`${apiKey}:`).toString("base64");

    try {
      const response = await fetcher(url.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json"
        }
      });

      if (response.status === 401 || response.status === 403) {
        const errorMessage = await extractErrorMessage(response);
        const result: WakaTimeResult = {
          status: "private",
          totalSeconds: 0,
          error: errorMessage || "User data is private or unauthorized",
          fetchedAt: now
        };
        cache.set(cacheKey, { dateKey, fetchedAt: now, result });
        return result;
      }

      if (response.status === 404) {
        const errorMessage = await extractErrorMessage(response);
        const normalizedError = errorMessage?.toLowerCase() ?? "";
        const isPrivate =
          normalizedError.includes("private") ||
          normalizedError.includes("unauthorized") ||
          normalizedError.includes("forbidden");
        const result: WakaTimeResult = {
          status: isPrivate ? "private" : "not_found",
          totalSeconds: 0,
          error:
            errorMessage ||
            (isPrivate ? "User data is private or unauthorized" : "User not found"),
          fetchedAt: now
        };
        cache.set(cacheKey, { dateKey, fetchedAt: now, result });
        return result;
      }

      if (!response.ok) {
        const errorMessage = await extractErrorMessage(response);
        const result: WakaTimeResult = {
          status: "error",
          totalSeconds: 0,
          error: errorMessage || `Unexpected response (${response.status})`,
          fetchedAt: now
        };
        cache.set(cacheKey, { dateKey, fetchedAt: now, result });
        return result;
      }

      const payload = (await response.json()) as {
        data?: {
          grand_total?: {
            total_seconds?: number;
          };
        };
      };

      const totalSeconds = payload.data?.grand_total?.total_seconds ?? 0;
      const result: WakaTimeResult = {
        status: "ok",
        totalSeconds,
        fetchedAt: now
      };

      cache.set(cacheKey, { dateKey, fetchedAt: now, result });
      return result;
    } catch (error) {
      const fallback = cached?.result ?? {
        status: "error",
        totalSeconds: 0,
        error: error instanceof Error ? error.message : "Network error",
        fetchedAt: now
      };

      return {
        ...fallback,
        fetchedAt: cached?.fetchedAt ?? now
      };
    }
  };

  return { getStatusBarToday };
};
