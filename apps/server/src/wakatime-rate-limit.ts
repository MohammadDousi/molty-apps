export const WAKATIME_RATE_LIMIT_PER_SECOND = 9;
export const WAKATIME_RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
export const DEFAULT_WAKATIME_BATCH_SIZE = WAKATIME_RATE_LIMIT_PER_SECOND;
export const DEFAULT_WAKATIME_BATCH_DELAY_MS = 1000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const runInBatches = async <T>(
  items: T[],
  handler: (item: T) => Promise<void>,
  {
    batchSize = DEFAULT_WAKATIME_BATCH_SIZE,
    delayMs = DEFAULT_WAKATIME_BATCH_DELAY_MS,
    onError
  }: {
    batchSize?: number;
    delayMs?: number;
    onError?: (error: unknown) => void;
  } = {}
) => {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const results = await Promise.allSettled(batch.map(handler));
    if (onError) {
      results.forEach((result) => {
        if (result.status === "rejected") {
          onError(result.reason);
        }
      });
    }
    if (index + batchSize < items.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }
};
