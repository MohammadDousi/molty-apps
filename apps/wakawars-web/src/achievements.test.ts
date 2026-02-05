import { describe, expect, it } from "vitest";
import { buildAchievements, buildQuests } from "./achievements";
import type {
  LeaderboardEntry,
  PublicConfig,
  WeeklyLeaderboardEntry,
} from "@molty/shared";

describe("buildAchievements", () => {
  it("marks achievements unlocked when thresholds are met", () => {
    const config: PublicConfig = {
      wakawarsUsername: "alice",
      friends: [{ username: "bob" }],
      groups: [{ id: 1, name: "Alpha", members: [] }],
      statsVisibility: "everyone",
      isCompeting: true,
      hasApiKey: true,
      passwordSet: true,
    };

    const dailyEntry: LeaderboardEntry = {
      username: "alice",
      totalSeconds: 8000,
      status: "ok",
      rank: 1,
      deltaSeconds: 0,
    };

    const weeklyEntry: WeeklyLeaderboardEntry = {
      username: "alice",
      totalSeconds: 42000,
      dailyAverageSeconds: 7200,
      status: "ok",
      rank: 2,
      deltaSeconds: 0,
    };

    const achievements = buildAchievements({
      config,
      dailyEntry,
      weeklyEntry,
    });

    const unlockedIds = achievements
      .filter((achievement) => achievement.status === "unlocked")
      .map((achievement) => achievement.id);

    expect(unlockedIds).toContain("initiate");
    expect(unlockedIds).toContain("rival");
    expect(unlockedIds).toContain("squad");
    expect(unlockedIds).toContain("daily-grind");
    expect(unlockedIds).toContain("weekly-pace");
    expect(unlockedIds).toContain("podium");
  });

  it("keeps time-based achievements locked when stats are missing", () => {
    const achievements = buildAchievements({
      config: null,
      dailyEntry: null,
      weeklyEntry: null,
    });

    const daily = achievements.find((achievement) => achievement.id === "daily-grind");
    const weekly = achievements.find((achievement) => achievement.id === "weekly-pace");
    const podium = achievements.find((achievement) => achievement.id === "podium");

    expect(daily?.status).toBe("locked");
    expect(weekly?.status).toBe("locked");
    expect(podium?.status).toBe("locked");
  });
});

describe("buildQuests", () => {
  it("builds quest progress from available stats", () => {
    const dailyEntry: LeaderboardEntry = {
      username: "alice",
      totalSeconds: 7200,
      status: "ok",
      rank: 3,
      deltaSeconds: 0,
    };

    const weeklyEntry: WeeklyLeaderboardEntry = {
      username: "alice",
      totalSeconds: 32000,
      dailyAverageSeconds: 3000,
      status: "ok",
      rank: 5,
      deltaSeconds: 0,
    };

    const quests = buildQuests({ dailyEntry, weeklyEntry });

    const dailyQuest = quests.find((quest) => quest.id === "daily-spark");
    const weeklyQuest = quests.find((quest) => quest.id === "weekly-pace");

    expect(dailyQuest?.status).toBe("unlocked");
    expect(weeklyQuest?.status).toBe("in_progress");
  });
});
