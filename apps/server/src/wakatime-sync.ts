import type { UserRepository } from "./repository.js";
import type { WakaTimeClient } from "./wakatime.js";
import { toDateKeyInTimeZone } from "./date-key.js";
import { awardDailyAchievements } from "./achievements.js";
import {
  DEFAULT_WAKATIME_BATCH_DELAY_MS,
  DEFAULT_WAKATIME_BATCH_SIZE,
  runInBatches
} from "./wakatime-rate-limit.js";
export { DEFAULT_WAKATIME_WEEKLY_RANGE } from "./wakatime-weekly-cache.js";

export const DEFAULT_WAKATIME_SYNC_INTERVAL_MS = 2 * 60 * 1000;

export type WakaTimeSyncOptions = {
  store: UserRepository;
  wakatime: WakaTimeClient;
  intervalMs?: number;
  onError?: (error: unknown) => void;
};

export type WakaTimeSync = {
  start: () => void;
  stop: () => void;
  runOnce: () => Promise<void>;
  syncUser: (input: {
    id: number;
    apiKey: string;
    wakatimeTimezone?: string | null;
    bypassCache?: boolean;
  }) => Promise<void>;
};

export const createWakaTimeSync = ({
  store,
  wakatime,
  intervalMs = DEFAULT_WAKATIME_SYNC_INTERVAL_MS,
  onError
}: WakaTimeSyncOptions): WakaTimeSync => {
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const reportError = (error: unknown) => {
    if (onError) {
      onError(error);
      return;
    }

    // eslint-disable-next-line no-console
    console.error("[wakawars] WakaTime sync failed", error);
  };

  const resolveDateKey = (input: {
    dateKey?: string;
    timeZone?: string | null;
  }) => {
    if (input.dateKey) {
      return input.dateKey;
    }

    return toDateKeyInTimeZone(new Date(), input.timeZone ?? null);
  };

  const runOnce = async () => {
    if (running) return;
    running = true;

    try {
      const users = await store.listUsers();
      const targets = users
        .map((user) => ({
          ...user,
          apiKey: user.apiKey.trim()
        }))
        .filter((user) => Boolean(user.apiKey));

      await runInBatches(
        targets,
        async (user) => {
          const dailyResult = await wakatime.getStatusBarToday("current", user.apiKey);
          const resolvedTimezone =
            dailyResult.timezone ?? user.wakatimeTimezone ?? null;
          const dateKey = resolveDateKey({
            dateKey: dailyResult.dateKey,
            timeZone: resolvedTimezone
          });

          const dailyLog = store.createProviderLog({
            provider: "wakatime",
            userId: user.id,
            endpoint: "status_bar/today",
            rangeKey: null,
            statusCode: dailyResult.responseStatus ?? null,
            ok: dailyResult.responseOk ?? false,
            payload: dailyResult.payload ?? null,
            error: dailyResult.error ?? dailyResult.networkError ?? null,
            fetchedAt: new Date(dailyResult.fetchedAt)
          });

          const logTasks: Promise<unknown>[] = [];
          if (dailyResult.timezone && dailyResult.timezone !== user.wakatimeTimezone) {
            logTasks.push(store.setWakaTimeTimezone(user.id, dailyResult.timezone));
          }
          if (!dailyResult.fromCache || dailyResult.networkError) {
            logTasks.push(dailyLog);
          }

          if (!dailyResult.fromCache) {
            await store.upsertDailyStat({
              userId: user.id,
              dateKey,
              totalSeconds: dailyResult.totalSeconds,
              status: dailyResult.status,
              error: dailyResult.error ?? null,
              fetchedAt: new Date(dailyResult.fetchedAt)
            });
          }

          await awardDailyAchievements({
            store,
            userId: user.id,
            dateKey,
            status: dailyResult.status,
            totalSeconds: dailyResult.totalSeconds,
            payload: dailyResult.payload,
            fetchedAt: new Date(dailyResult.fetchedAt)
          });

          if (logTasks.length) {
            await Promise.allSettled(logTasks);
          }
        },
        {
          batchSize: DEFAULT_WAKATIME_BATCH_SIZE,
          delayMs: DEFAULT_WAKATIME_BATCH_DELAY_MS,
          onError: reportError
        }
      );
    } catch (error) {
      reportError(error);
    } finally {
      running = false;
    }
  };

  const syncUser = async ({
    id,
    apiKey,
    wakatimeTimezone,
    bypassCache = false
  }: {
    id: number;
    apiKey: string;
    wakatimeTimezone?: string | null;
    bypassCache?: boolean;
  }) => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      return;
    }

    try {
      const dailyResult = await wakatime.getStatusBarToday("current", trimmedKey, {
        bypassCache
      });
      const resolvedTimezone = dailyResult.timezone ?? wakatimeTimezone ?? null;
      const dateKey = resolveDateKey({
        dateKey: dailyResult.dateKey,
        timeZone: resolvedTimezone
      });

      const dailyLog = store.createProviderLog({
        provider: "wakatime",
        userId: id,
        endpoint: "status_bar/today",
        rangeKey: null,
        statusCode: dailyResult.responseStatus ?? null,
        ok: dailyResult.responseOk ?? false,
        payload: dailyResult.payload ?? null,
        error: dailyResult.error ?? dailyResult.networkError ?? null,
        fetchedAt: new Date(dailyResult.fetchedAt)
      });

      const logTasks: Promise<unknown>[] = [];
      if (dailyResult.timezone && dailyResult.timezone !== wakatimeTimezone) {
        logTasks.push(store.setWakaTimeTimezone(id, dailyResult.timezone));
      }
      if (!dailyResult.fromCache || dailyResult.networkError) {
        logTasks.push(dailyLog);
      }

      if (!dailyResult.fromCache) {
        await store.upsertDailyStat({
          userId: id,
          dateKey,
          totalSeconds: dailyResult.totalSeconds,
          status: dailyResult.status,
          error: dailyResult.error ?? null,
          fetchedAt: new Date(dailyResult.fetchedAt)
        });
      }

      await awardDailyAchievements({
        store,
        userId: id,
        dateKey,
        status: dailyResult.status,
        totalSeconds: dailyResult.totalSeconds,
        payload: dailyResult.payload,
        fetchedAt: new Date(dailyResult.fetchedAt)
      });

      if (logTasks.length) {
        await Promise.allSettled(logTasks);
      }
    } catch (error) {
      reportError(error);
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

  return { start, stop, runOnce, syncUser };
};
