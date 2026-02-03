import {
  formatDuration,
  type LeaderboardEntry,
  type PublicConfig,
  type WeeklyLeaderboardEntry,
} from "@molty/shared";

export type AchievementStatus = "locked" | "in_progress" | "unlocked";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: AchievementStatus;
  progress: number;
  progressLabel: string;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  status: AchievementStatus;
  progress: number;
  progressLabel: string;
};

const clampProgress = (value: number) => Math.max(0, Math.min(1, value));

const formatProgress = (current: number, goal: number) =>
  `${formatDuration(Math.max(0, current))} / ${formatDuration(goal)}`;

export const buildAchievements = ({
  config,
  dailyEntry,
  weeklyEntry,
}: {
  config: PublicConfig | null;
  dailyEntry: LeaderboardEntry | null;
  weeklyEntry: WeeklyLeaderboardEntry | null;
}): Achievement[] => {
  const friendCount = config?.friends.length ?? 0;
  const groupCount = config?.groups.length ?? 0;
  const hasToken = Boolean(config?.hasApiKey);

  const dailySeconds = dailyEntry?.status === "ok" ? dailyEntry.totalSeconds : 0;
  const weeklyAverage =
    weeklyEntry?.status === "ok" ? weeklyEntry.dailyAverageSeconds : 0;

  const dailyGoalSeconds = 2 * 60 * 60;
  const weeklyGoalSeconds = 90 * 60;

  const bestRank = Math.min(
    dailyEntry?.rank ?? Number.POSITIVE_INFINITY,
    weeklyEntry?.rank ?? Number.POSITIVE_INFINITY
  );
  const bestRankValue = Number.isFinite(bestRank) ? bestRank : null;

  return [
    {
      id: "initiate",
      title: "Waka Initiate",
      description: "Link your WakaTime token to join the arena.",
      icon: "XP",
      status: hasToken ? "unlocked" : "locked",
      progress: hasToken ? 1 : 0,
      progressLabel: hasToken ? "Linked" : "Token missing",
    },
    {
      id: "rival",
      title: "First Rival",
      description: "Add your first challenger.",
      icon: "R1",
      status: friendCount >= 1 ? "unlocked" : "in_progress",
      progress: clampProgress(friendCount / 1),
      progressLabel: `${friendCount}/1 rivals`,
    },
    {
      id: "squad",
      title: "Squad Captain",
      description: "Create a squad lineup.",
      icon: "SQ",
      status: groupCount >= 1 ? "unlocked" : "in_progress",
      progress: clampProgress(groupCount / 1),
      progressLabel: `${groupCount}/1 squads`,
    },
    {
      id: "daily-grind",
      title: "Daily Grinder",
      description: "Log 2 hours in a day.",
      icon: "D2",
      status:
        dailyEntry?.status === "ok"
          ? dailySeconds >= dailyGoalSeconds
            ? "unlocked"
            : "in_progress"
          : "locked",
      progress:
        dailyEntry?.status === "ok"
          ? clampProgress(dailySeconds / dailyGoalSeconds)
          : 0,
      progressLabel:
        dailyEntry?.status === "ok"
          ? formatProgress(dailySeconds, dailyGoalSeconds)
          : "No stats yet",
    },
    {
      id: "weekly-pace",
      title: "Weekly Pace",
      description: "Average 90 minutes per day.",
      icon: "WK",
      status:
        weeklyEntry?.status === "ok"
          ? weeklyAverage >= weeklyGoalSeconds
            ? "unlocked"
            : "in_progress"
          : "locked",
      progress:
        weeklyEntry?.status === "ok"
          ? clampProgress(weeklyAverage / weeklyGoalSeconds)
          : 0,
      progressLabel:
        weeklyEntry?.status === "ok"
          ? formatProgress(weeklyAverage, weeklyGoalSeconds)
          : "Weekly stats needed",
    },
    {
      id: "podium",
      title: "Podium Finisher",
      description: "Place in the top 3.",
      icon: "TOP",
      status:
        bestRankValue === null
          ? "locked"
          : bestRankValue <= 3
            ? "unlocked"
            : "in_progress",
      progress:
        bestRankValue === null
          ? 0
          : clampProgress((10 - bestRankValue) / 9),
      progressLabel:
        bestRankValue === null ? "No rank yet" : `Best rank #${bestRankValue}`,
    },
  ];
};

export const buildQuests = ({
  dailyEntry,
  weeklyEntry,
}: {
  dailyEntry: LeaderboardEntry | null;
  weeklyEntry: WeeklyLeaderboardEntry | null;
}): Quest[] => {
  const dailySeconds = dailyEntry?.status === "ok" ? dailyEntry.totalSeconds : 0;
  const weeklyAverage =
    weeklyEntry?.status === "ok" ? weeklyEntry.dailyAverageSeconds : 0;

  const dailySparkGoal = 45 * 60;
  const powerSessionGoal = 90 * 60;
  const weeklyPaceGoal = 60 * 60;

  const dailyStatus = dailyEntry?.status === "ok" ? "in_progress" : "locked";
  const weeklyStatus = weeklyEntry?.status === "ok" ? "in_progress" : "locked";

  return [
    {
      id: "daily-spark",
      title: "Daily Spark",
      description: "Log 45 focused minutes.",
      status:
        dailyStatus === "locked"
          ? "locked"
          : dailySeconds >= dailySparkGoal
            ? "unlocked"
            : "in_progress",
      progress:
        dailyStatus === "locked"
          ? 0
          : clampProgress(dailySeconds / dailySparkGoal),
      progressLabel:
        dailyStatus === "locked"
          ? "Awaiting stats"
          : formatProgress(dailySeconds, dailySparkGoal),
    },
    {
      id: "power-session",
      title: "Power Session",
      description: "Reach 90 minutes today.",
      status:
        dailyStatus === "locked"
          ? "locked"
          : dailySeconds >= powerSessionGoal
            ? "unlocked"
            : "in_progress",
      progress:
        dailyStatus === "locked"
          ? 0
          : clampProgress(dailySeconds / powerSessionGoal),
      progressLabel:
        dailyStatus === "locked"
          ? "Awaiting stats"
          : formatProgress(dailySeconds, powerSessionGoal),
    },
    {
      id: "weekly-pace",
      title: "Weekly Pace",
      description: "Hold 60 min/day average.",
      status:
        weeklyStatus === "locked"
          ? "locked"
          : weeklyAverage >= weeklyPaceGoal
            ? "unlocked"
            : "in_progress",
      progress:
        weeklyStatus === "locked"
          ? 0
          : clampProgress(weeklyAverage / weeklyPaceGoal),
      progressLabel:
        weeklyStatus === "locked"
          ? "Weekly stats needed"
          : formatProgress(weeklyAverage, weeklyPaceGoal),
    },
  ];
};
