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
        const result: WakaTimeResult = {
          status: "private",
          totalSeconds: 0,
          error: "User data is private or unauthorized",
          fetchedAt: now
        };
        cache.set(cacheKey, { dateKey, fetchedAt: now, result });
        return result;
      }

      if (response.status === 404) {
        const result: WakaTimeResult = {
          status: "not_found",
          totalSeconds: 0,
          error: "User not found",
          fetchedAt: now
        };
        cache.set(cacheKey, { dateKey, fetchedAt: now, result });
        return result;
      }

      if (!response.ok) {
        const result: WakaTimeResult = {
          status: "error",
          totalSeconds: 0,
          error: `Unexpected response (${response.status})`,
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
