import type { DailyStat, LeaderboardEntry, DailyStatStatus } from "./types.js";

const statusOrder: Record<DailyStatStatus, number> = {
  ok: 0,
  private: 1,
  not_found: 2,
  error: 3
};

export const sortStats = (stats: DailyStat[]): DailyStat[] => {
  return [...stats].sort((a, b) => {
    const statusDelta = statusOrder[a.status] - statusOrder[b.status];
    if (statusDelta !== 0) return statusDelta;

    const timeDelta = b.totalSeconds - a.totalSeconds;
    if (timeDelta !== 0) return timeDelta;

    return a.username.localeCompare(b.username);
  });
};

export const computeLeaderboard = (stats: DailyStat[], selfUsername: string): LeaderboardEntry[] => {
  const ordered = sortStats(stats);
  const selfEntry = ordered.find((entry) => entry.username === selfUsername);
  const selfSeconds = selfEntry?.totalSeconds ?? 0;

  let currentRank = 0;
  let lastSeconds: number | null = null;

  return ordered.map((entry, index) => {
    const isRanked = entry.status === "ok";
    if (isRanked) {
      if (lastSeconds === null || entry.totalSeconds !== lastSeconds) {
        currentRank = index + 1;
        lastSeconds = entry.totalSeconds;
      }
    }

    return {
      ...entry,
      rank: isRanked ? currentRank : null,
      deltaSeconds: entry.totalSeconds - selfSeconds
    };
  });
};
