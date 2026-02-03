import type { UserRepository } from "./repository.js";
import type { WakaTimeClient, WakaTimeStatsResult } from "./wakatime.js";

export const DEFAULT_WAKATIME_WEEKLY_RANGE = "last_7_days";
export const DEFAULT_WAKATIME_WEEKLY_CACHE_INTERVAL_MS = 30 * 60 * 1000;

export type WeeklyCacheEntry = {
  userId: number;
  rangeKey: string;
  result: WakaTimeStatsResult;
};

export type WakaTimeWeeklyCacheOptions = {
  store: UserRepository;
  wakatime: WakaTimeClient;
  intervalMs?: number;
  weeklyRangeKey?: string;
  onError?: (error: unknown) => void;
};

export type WakaTimeWeeklyCache = {
  start: () => void;
  stop: () => void;
  runOnce: () => Promise<void>;
  syncUser: (input: { id: number; apiKey: string }) => Promise<void>;
  getStat: (input: { userId: number; rangeKey?: string }) => WeeklyCacheEntry | null;
  getStats: (input: { userIds: number[]; rangeKey?: string }) => WeeklyCacheEntry[];
};

const toCacheKey = (userId: number, rangeKey: string) => `${userId}:${rangeKey}`;

export const createWakaTimeWeeklyCache = ({
  store,
  wakatime,
  intervalMs = DEFAULT_WAKATIME_WEEKLY_CACHE_INTERVAL_MS,
  weeklyRangeKey = DEFAULT_WAKATIME_WEEKLY_RANGE,
  onError
}: WakaTimeWeeklyCacheOptions): WakaTimeWeeklyCache => {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  const cache = new Map<string, WeeklyCacheEntry>();

  const reportError = (error: unknown) => {
    if (onError) {
      onError(error);
      return;
    }

    // eslint-disable-next-line no-console
    console.error("[wakawars] WakaTime weekly cache failed", error);
  };

  const setEntry = (userId: number, rangeKey: string, result: WakaTimeStatsResult) => {
    cache.set(toCacheKey(userId, rangeKey), { userId, rangeKey, result });
  };

  const syncUser = async ({ id, apiKey }: { id: number; apiKey: string }) => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      return;
    }

    try {
      const weeklyResult = await wakatime.getStatsRange(weeklyRangeKey, trimmedKey);
      setEntry(id, weeklyRangeKey, weeklyResult);
    } catch (error) {
      reportError(error);
    }
  };

  const runOnce = async () => {
    if (running) return;
    running = true;

    try {
      const users = await store.listUsers();
      const tasks = users
        .map((user) => ({
          ...user,
          apiKey: user.apiKey.trim()
        }))
        .filter((user) => Boolean(user.apiKey))
        .map(async (user) => {
          const weeklyResult = await wakatime.getStatsRange(weeklyRangeKey, user.apiKey);
          setEntry(user.id, weeklyRangeKey, weeklyResult);
        });

      const results = await Promise.allSettled(tasks);
      results.forEach((result) => {
        if (result.status === "rejected") {
          reportError(result.reason);
        }
      });
    } catch (error) {
      reportError(error);
    } finally {
      running = false;
    }
  };

  const start = () => {
    if (timer) return;
    void runOnce();
    timer = setInterval(() => {
      void runOnce();
    }, intervalMs);
  };

  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  const getStat = ({ userId, rangeKey }: { userId: number; rangeKey?: string }) => {
    const key = toCacheKey(userId, rangeKey ?? weeklyRangeKey);
    return cache.get(key) ?? null;
  };

  const getStats = ({
    userIds,
    rangeKey
  }: {
    userIds: number[];
    rangeKey?: string;
  }): WeeklyCacheEntry[] => {
    const resolvedRangeKey = rangeKey ?? weeklyRangeKey;
    return userIds
      .map((userId) => cache.get(toCacheKey(userId, resolvedRangeKey)))
      .filter((entry): entry is WeeklyCacheEntry => Boolean(entry));
  };

  return { start, stop, runOnce, syncUser, getStat, getStats };
};
