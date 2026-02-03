import type { UserRepository } from "./repository.js";
import type { WakaTimeClient } from "./wakatime.js";
export { DEFAULT_WAKATIME_WEEKLY_RANGE } from "./wakatime-weekly-cache.js";

export const DEFAULT_WAKATIME_SYNC_INTERVAL_MS = 15 * 60 * 1000;

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
  syncUser: (input: { id: number; apiKey: string }) => Promise<void>;
};

const toDateKey = (date: Date = new Date()) => date.toISOString().slice(0, 10);

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

  const runOnce = async () => {
    if (running) return;
    running = true;

    try {
      const users = await store.listUsers();
      const dateKey = toDateKey();
      const tasks = users
        .map((user) => ({
          ...user,
          apiKey: user.apiKey.trim()
        }))
        .filter((user) => Boolean(user.apiKey))
        .map(async (user) => {
          const dailyResult = await wakatime.getStatusBarToday("current", user.apiKey);

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

          const logTasks: Promise<void>[] = [];
          if (!dailyResult.fromCache || dailyResult.networkError) {
            logTasks.push(dailyLog);
          }

          await store.upsertDailyStat({
            userId: user.id,
            dateKey,
            totalSeconds: dailyResult.totalSeconds,
            status: dailyResult.status,
            error: dailyResult.error ?? null,
            fetchedAt: new Date(dailyResult.fetchedAt)
          });

          if (logTasks.length) {
            await Promise.allSettled(logTasks);
          }
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

  const syncUser = async ({ id, apiKey }: { id: number; apiKey: string }) => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      return;
    }

    try {
      const dateKey = toDateKey();
      const dailyResult = await wakatime.getStatusBarToday("current", trimmedKey);

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

      const logTasks: Promise<void>[] = [];
      if (!dailyResult.fromCache || dailyResult.networkError) {
        logTasks.push(dailyLog);
      }

      await store.upsertDailyStat({
        userId: id,
        dateKey,
        totalSeconds: dailyResult.totalSeconds,
        status: dailyResult.status,
        error: dailyResult.error ?? null,
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
