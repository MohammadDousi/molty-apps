import type { DailyStatStatus } from "@molty/shared";

export type WakaTimeResult = {
  status: DailyStatStatus;
  totalSeconds: number;
  error?: string | null;
  fetchedAt: number;
  responseStatus?: number;
  responseOk?: boolean;
  payload?: unknown;
  fromCache?: boolean;
  networkError?: string | null;
};

export type WakaTimeStatsResult = {
  status: DailyStatStatus;
  totalSeconds: number;
  dailyAverageSeconds: number;
  error?: string | null;
  fetchedAt: number;
  responseStatus?: number;
  responseOk?: boolean;
  payload?: unknown;
  fromCache?: boolean;
  networkError?: string | null;
};

export type WakaTimeClient = {
  getStatusBarToday: (username: string, apiKey: string) => Promise<WakaTimeResult>;
  getStatsRange: (rangeKey: string, apiKey: string) => Promise<WakaTimeStatsResult>;
};

type CacheEntry<T> = {
  dateKey: string;
  fetchedAt: number;
  result: T;
};

const DEFAULT_TTL_MS = 2 * 60 * 1000;

export const createWakaTimeClient = ({
  fetcher = globalThis.fetch,
  ttlMs = DEFAULT_TTL_MS
}: {
  fetcher?: typeof fetch;
  ttlMs?: number;
} = {}): WakaTimeClient => {
  const statusCache = new Map<string, CacheEntry<WakaTimeResult>>();
  const statsCache = new Map<string, CacheEntry<WakaTimeStatsResult>>();

  const extractErrorMessageFromPayload = (payload: unknown): string | null => {
    if (!payload) return null;
    if (typeof payload === "string") {
      return payload.trim() || null;
    }

    if (typeof payload === "object") {
      const typed = payload as {
        error?: string;
        errors?: string[] | string;
        message?: string;
      };
      const errorValue = typed.error ?? typed.message ?? typed.errors;
      if (typeof errorValue === "string" && errorValue.trim()) {
        return errorValue.trim();
      }
      if (Array.isArray(errorValue) && errorValue.length) {
        return errorValue.filter(Boolean).join(", ").trim();
      }
    }

    return null;
  };

  const readPayload = async (
    response: Response
  ): Promise<{ payload: unknown; isJson: boolean }> => {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        return { payload: await response.json(), isJson: true };
      } catch {
        // Fall through to text parsing.
      }
    }

    try {
      const text = await response.text();
      return { payload: text, isJson: false };
    } catch {
      return { payload: null, isJson: false };
    }
  };

  const getStatusBarToday = async (username: string, apiKey: string): Promise<WakaTimeResult> => {
    const cacheKey = `${username}:${apiKey}`;
    const dateKey = new Date().toISOString().slice(0, 10);
    const cached = statusCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.dateKey === dateKey && now - cached.fetchedAt < ttlMs) {
      return { ...cached.result, fromCache: true };
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

      const { payload, isJson } = await readPayload(response);
      const responseStatus = response.status;
      const responseOk = response.ok;

      if (responseStatus === 401 || responseStatus === 403) {
        const errorMessage = extractErrorMessageFromPayload(payload);
        const result: WakaTimeResult = {
          status: "private",
          totalSeconds: 0,
          error: errorMessage || "User data is private or unauthorized",
          fetchedAt: now,
          responseStatus,
          responseOk,
          payload
        };
        statusCache.set(cacheKey, { dateKey, fetchedAt: now, result });
        return result;
      }

      if (responseStatus === 404) {
        const errorMessage = extractErrorMessageFromPayload(payload);
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
          fetchedAt: now,
          responseStatus,
          responseOk,
          payload
        };
        statusCache.set(cacheKey, { dateKey, fetchedAt: now, result });
        return result;
      }

      if (!responseOk) {
        const errorMessage = extractErrorMessageFromPayload(payload);
        const result: WakaTimeResult = {
          status: "error",
          totalSeconds: 0,
          error: errorMessage || `Unexpected response (${response.status})`,
          fetchedAt: now,
          responseStatus,
          responseOk,
          payload
        };
        statusCache.set(cacheKey, { dateKey, fetchedAt: now, result });
        return result;
      }

      const dataPayload = isJson
        ? (payload as {
            data?: { grand_total?: { total_seconds?: number } };
          })
        : null;
      const totalSeconds = dataPayload?.data?.grand_total?.total_seconds ?? 0;
      const result: WakaTimeResult = {
        status: "ok",
        totalSeconds,
        fetchedAt: now,
        responseStatus,
        responseOk,
        payload
      };

      statusCache.set(cacheKey, { dateKey, fetchedAt: now, result });
      return result;
    } catch (error) {
      const networkError = error instanceof Error ? error.message : "Network error";
      const fallback = cached?.result ?? {
        status: "error",
        totalSeconds: 0,
        error: networkError,
        fetchedAt: now,
        responseStatus: undefined,
        responseOk: false,
        payload: undefined
      };

      return {
        ...fallback,
        fetchedAt: cached?.fetchedAt ?? now,
        fromCache: Boolean(cached),
        networkError: Boolean(cached) ? networkError : null
      };
    }
  };

  const getStatsRange = async (rangeKey: string, apiKey: string): Promise<WakaTimeStatsResult> => {
    const cacheKey = `stats:${rangeKey}:${apiKey}`;
    const dateKey = new Date().toISOString().slice(0, 10);
    const cached = statsCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.dateKey === dateKey && now - cached.fetchedAt < ttlMs) {
      return { ...cached.result, fromCache: true };
    }

    const url = new URL(
      `https://wakatime.com/api/v1/users/current/stats/${encodeURIComponent(rangeKey)}`
    );
    const auth = Buffer.from(`${apiKey}:`).toString("base64");

    try {
      const response = await fetcher(url.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json"
        }
      });

      const { payload, isJson } = await readPayload(response);
      const responseStatus = response.status;
      const responseOk = response.ok;

      if (responseStatus === 401 || responseStatus === 403) {
        const errorMessage = extractErrorMessageFromPayload(payload);
        const result: WakaTimeStatsResult = {
          status: "private",
          totalSeconds: 0,
          dailyAverageSeconds: 0,
          error: errorMessage || "User data is private or unauthorized",
          fetchedAt: now,
          responseStatus,
          responseOk,
          payload
        };
        statsCache.set(cacheKey, {
          dateKey,
          fetchedAt: now,
          result
        });
        return result;
      }

      if (responseStatus === 404) {
        const errorMessage = extractErrorMessageFromPayload(payload);
        const normalizedError = errorMessage?.toLowerCase() ?? "";
        const isPrivate =
          normalizedError.includes("private") ||
          normalizedError.includes("unauthorized") ||
          normalizedError.includes("forbidden");
        const result: WakaTimeStatsResult = {
          status: isPrivate ? "private" : "not_found",
          totalSeconds: 0,
          dailyAverageSeconds: 0,
          error:
            errorMessage ||
            (isPrivate ? "User data is private or unauthorized" : "User not found"),
          fetchedAt: now,
          responseStatus,
          responseOk,
          payload
        };
        statsCache.set(cacheKey, {
          dateKey,
          fetchedAt: now,
          result
        });
        return result;
      }

      if (!responseOk) {
        const errorMessage = extractErrorMessageFromPayload(payload);
        const result: WakaTimeStatsResult = {
          status: "error",
          totalSeconds: 0,
          dailyAverageSeconds: 0,
          error: errorMessage || `Unexpected response (${response.status})`,
          fetchedAt: now,
          responseStatus,
          responseOk,
          payload
        };
        statsCache.set(cacheKey, {
          dateKey,
          fetchedAt: now,
          result
        });
        return result;
      }

      const dataPayload = isJson
        ? (payload as { data?: { total_seconds?: number; daily_average?: number } })
        : null;
      const totalSeconds = dataPayload?.data?.total_seconds ?? 0;
      const dailyAverageSeconds = dataPayload?.data?.daily_average ?? 0;
      const result: WakaTimeStatsResult = {
        status: "ok",
        totalSeconds,
        dailyAverageSeconds,
        fetchedAt: now,
        responseStatus,
        responseOk,
        payload
      };

      statsCache.set(cacheKey, {
        dateKey,
        fetchedAt: now,
        result
      });
      return result;
    } catch (error) {
      const networkError = error instanceof Error ? error.message : "Network error";
      const fallback = cached?.result ?? {
        status: "error",
        totalSeconds: 0,
        dailyAverageSeconds: 0,
        error: networkError,
        fetchedAt: now,
        responseStatus: undefined,
        responseOk: false,
        payload: undefined
      };

      return {
        status: fallback.status,
        totalSeconds: fallback.totalSeconds,
        dailyAverageSeconds: fallback.dailyAverageSeconds ?? 0,
        error: fallback.error ?? null,
        fetchedAt: cached?.fetchedAt ?? now,
        fromCache: Boolean(cached),
        networkError: Boolean(cached) ? networkError : null
      };
    }
  };

  return { getStatusBarToday, getStatsRange };
};
