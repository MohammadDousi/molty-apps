import type { UserRepository } from "./repository.js";
import type { WakaTimeClient } from "./wakatime.js";

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
          const result = await wakatime.getStatusBarToday("current", user.apiKey);
          await store.upsertDailyStat({
            userId: user.id,
            dateKey,
            totalSeconds: result.totalSeconds,
            status: result.status,
            error: result.error ?? null,
            fetchedAt: new Date(result.fetchedAt)
          });
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

  return { start, stop, runOnce };
};
