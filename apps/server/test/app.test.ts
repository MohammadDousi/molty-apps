import { describe, expect, it } from "vitest";
import type { DailyStatStatus, UserConfig } from "@molty/shared";
import { createServer } from "../src/app.js";
import type { UserRepository } from "../src/repository.js";

type UserRecord = Omit<UserConfig, "friends">;
type DailyStatRecord = {
  userId: number;
  dateKey: string;
  totalSeconds: number;
  status: DailyStatStatus;
  error: string | null;
  fetchedAt: Date;
};
type WeeklyStatRecord = {
  userId: number;
  rangeKey: string;
  totalSeconds: number;
  dailyAverageSeconds: number;
  status: DailyStatStatus;
  error: string | null;
  fetchedAt: Date;
};

const createMemoryRepository = (): UserRepository => {
  let users: UserRecord[] = [];
  let friendships: Array<{ userId: number; friendId: number }> = [];
  let dailyStats: DailyStatRecord[] = [];
  let weeklyStats: WeeklyStatRecord[] = [];
  let nextId = 1;

  const withFriends = (user: UserRecord): UserConfig => {
    const friends = friendships
      .filter((entry) => entry.userId === user.id)
      .map((entry) => users.find((friend) => friend.id === entry.friendId))
      .filter(Boolean)
      .map((friend) => ({
        id: friend!.id,
        username: friend!.wakawarsUsername,
        apiKey: friend!.apiKey
      }));

    return {
      ...user,
      friends
    };
  };

  const findUser = (predicate: (user: UserRecord) => boolean) => users.find(predicate) ?? null;

  return {
    countUsers: async () => users.length,
    listUsers: async () =>
      users.map((user) => ({
        id: user.id,
        wakawarsUsername: user.wakawarsUsername,
        apiKey: user.apiKey
      })),
    getUserById: async (userId) => {
      const user = findUser((entry) => entry.id === userId);
      return user ? withFriends(user) : null;
    },
    getUserByUsername: async (username) => {
      const user = findUser((entry) => entry.wakawarsUsername === username);
      return user ? withFriends(user) : null;
    },
    createUser: async ({ wakawarsUsername, apiKey }) => {
      const user: UserRecord = {
        id: nextId++,
        wakawarsUsername,
        apiKey,
        passwordHash: null
      };
      users = [...users, user];
      return withFriends(user);
    },
    updateUser: async (userId, { wakawarsUsername, apiKey }) => {
      users = users.map((user) =>
        user.id === userId ? { ...user, wakawarsUsername, apiKey } : user
      );
      const updated = findUser((entry) => entry.id === userId);
      return withFriends(updated!);
    },
    setPassword: async (userId, passwordHash) => {
      users = users.map((user) => (user.id === userId ? { ...user, passwordHash } : user));
      const updated = findUser((entry) => entry.id === userId);
      return withFriends(updated!);
    },
    addFriendship: async (userId, friendId) => {
      const exists = friendships.some(
        (entry) => entry.userId === userId && entry.friendId === friendId
      );
      if (!exists && userId !== friendId) {
        friendships = [...friendships, { userId, friendId }];
      }
      const updated = findUser((entry) => entry.id === userId);
      return withFriends(updated!);
    },
    removeFriendship: async (userId, friendId) => {
      friendships = friendships.filter(
        (entry) => !(entry.userId === userId && entry.friendId === friendId)
      );
      const updated = findUser((entry) => entry.id === userId);
      return withFriends(updated!);
    },
    searchUsers: async (query, options) => {
      const normalized = query.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.wakawarsUsername.toLowerCase().includes(normalized) &&
          user.id !== options?.excludeUserId
      );
      return filtered
        .slice(0, options?.limit ?? filtered.length)
        .map((user) => ({ id: user.id, wakawarsUsername: user.wakawarsUsername }));
    },
    upsertDailyStat: async (input) => {
      const existingIndex = dailyStats.findIndex(
        (stat) => stat.userId === input.userId && stat.dateKey === input.dateKey
      );
      const record: DailyStatRecord = {
        userId: input.userId,
        dateKey: input.dateKey,
        totalSeconds: input.totalSeconds,
        status: input.status,
        error: input.error ?? null,
        fetchedAt: input.fetchedAt
      };
      if (existingIndex >= 0) {
        dailyStats = dailyStats.map((stat, index) => (index === existingIndex ? record : stat));
        return;
      }
      dailyStats = [...dailyStats, record];
    },
    getDailyStats: async ({ userIds, dateKey }) =>
      dailyStats
        .filter((stat) => userIds.includes(stat.userId) && stat.dateKey === dateKey)
        .map((stat) => ({
          ...stat,
          username: users.find((user) => user.id === stat.userId)?.wakawarsUsername ?? ""
        })),
    upsertWeeklyStat: async (input) => {
      const existingIndex = weeklyStats.findIndex(
        (stat) => stat.userId === input.userId && stat.rangeKey === input.rangeKey
      );
      const record: WeeklyStatRecord = {
        userId: input.userId,
        rangeKey: input.rangeKey,
        totalSeconds: input.totalSeconds,
        dailyAverageSeconds: input.dailyAverageSeconds,
        status: input.status,
        error: input.error ?? null,
        fetchedAt: input.fetchedAt
      };
      if (existingIndex >= 0) {
        weeklyStats = weeklyStats.map((stat, index) => (index === existingIndex ? record : stat));
        return;
      }
      weeklyStats = [...weeklyStats, record];
    },
    getWeeklyStats: async ({ userIds, rangeKey }) =>
      weeklyStats
        .filter((stat) => userIds.includes(stat.userId) && stat.rangeKey === rangeKey)
        .map((stat) => ({
          ...stat,
          username: users.find((user) => user.id === stat.userId)?.wakawarsUsername ?? ""
        })),
    createProviderLog: async () => {}
  };
};

const getSessionId = async (response: Response) => {
  const payload = (await response.json()) as {
    sessionId?: string;
    config?: { wakawarsUsername: string; hasApiKey: boolean };
  };
  return { sessionId: payload.sessionId ?? null, payload };
};

describe("server app", () => {
  it("stores config and returns public config", async () => {
    const { app } = createServer({
      port: 0,
      repository: createMemoryRepository(),
      enableStatusSync: false
    });

    const response = await app.handle(
      new Request("http://localhost/wakawars/v0/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wakawarsUsername: "mo",
          apiKey: "key"
        })
      })
    );

    const { sessionId, payload } = await getSessionId(response);
    expect(sessionId).toBeTruthy();
    expect(payload.config.wakawarsUsername).toBe("mo");
    expect(payload.config.hasApiKey).toBe(true);

    const configResponse = await app.handle(
      new Request("http://localhost/wakawars/v0/config", {
        headers: { "x-wakawars-session": sessionId ?? "" }
      })
    );
    const configPayload = (await configResponse.json()) as {
      wakawarsUsername: string;
      hasApiKey: boolean;
    };
    expect(configPayload.wakawarsUsername).toBe("mo");
    expect(configPayload.hasApiKey).toBe(true);
  });

  it("adds friends and returns leaderboard stats", async () => {
    const repository = createMemoryRepository();
    const { app, store } = createServer({
      port: 0,
      repository,
      enableStatusSync: false
    });

    const { sessionId } = await getSessionId(
      await app.handle(
        new Request("http://localhost/wakawars/v0/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wakawarsUsername: "mo",
            apiKey: "key"
          })
        })
      )
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wakawarsUsername: "amy",
          apiKey: "key"
        })
      })
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wakawarsUsername: "ben",
          apiKey: "key"
        })
      })
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/friends", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wakawars-session": sessionId ?? ""
        },
        body: JSON.stringify({ username: "amy" })
      })
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/friends", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wakawars-session": sessionId ?? ""
        },
        body: JSON.stringify({ username: "ben" })
      })
    );

    const dateKey = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const mo = await store.getUserByUsername("mo");
    const amy = await store.getUserByUsername("amy");
    const ben = await store.getUserByUsername("ben");
    await store.upsertDailyStat({
      userId: mo!.id,
      dateKey,
      totalSeconds: 900,
      status: "ok",
      error: null,
      fetchedAt: now
    });
    await store.upsertDailyStat({
      userId: amy!.id,
      dateKey,
      totalSeconds: 3600,
      status: "ok",
      error: null,
      fetchedAt: now
    });
    await store.upsertDailyStat({
      userId: ben!.id,
      dateKey,
      totalSeconds: 1800,
      status: "ok",
      error: null,
      fetchedAt: now
    });

    const statsResponse = await app.handle(
      new Request("http://localhost/wakawars/v0/stats/today", {
        headers: { "x-wakawars-session": sessionId ?? "" }
      })
    );
    const statsPayload = (await statsResponse.json()) as { entries: Array<{ username: string }> };
    expect(statsPayload.entries.map((entry) => entry.username)).toEqual(["amy", "ben", "mo"]);
  });

  it("returns weekly leaderboard stats sorted by total time", async () => {
    const repository = createMemoryRepository();
    const { app, store } = createServer({
      port: 0,
      repository,
      enableStatusSync: false
    });

    const { sessionId } = await getSessionId(
      await app.handle(
        new Request("http://localhost/wakawars/v0/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wakawarsUsername: "mo",
            apiKey: "key"
          })
        })
      )
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wakawarsUsername: "amy",
          apiKey: "key"
        })
      })
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wakawarsUsername: "ben",
          apiKey: "key"
        })
      })
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/friends", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wakawars-session": sessionId ?? ""
        },
        body: JSON.stringify({ username: "amy" })
      })
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/friends", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wakawars-session": sessionId ?? ""
        },
        body: JSON.stringify({ username: "ben" })
      })
    );

    const rangeKey = "last_7_days";
    const now = new Date();
    const mo = await store.getUserByUsername("mo");
    const amy = await store.getUserByUsername("amy");
    const ben = await store.getUserByUsername("ben");
    await store.upsertWeeklyStat({
      userId: mo!.id,
      rangeKey,
      totalSeconds: 7200,
      dailyAverageSeconds: 1028,
      status: "ok",
      error: null,
      fetchedAt: now
    });
    await store.upsertWeeklyStat({
      userId: amy!.id,
      rangeKey,
      totalSeconds: 14400,
      dailyAverageSeconds: 2057,
      status: "ok",
      error: null,
      fetchedAt: now
    });
    await store.upsertWeeklyStat({
      userId: ben!.id,
      rangeKey,
      totalSeconds: 3600,
      dailyAverageSeconds: 514,
      status: "ok",
      error: null,
      fetchedAt: now
    });

    const statsResponse = await app.handle(
      new Request("http://localhost/wakawars/v0/stats/weekly", {
        headers: { "x-wakawars-session": sessionId ?? "" }
      })
    );
    const statsPayload = (await statsResponse.json()) as { entries: Array<{ username: string }> };
    expect(statsPayload.entries.map((entry) => entry.username)).toEqual(["amy", "mo", "ben"]);
  });

  it("rejects unknown friends", async () => {
    const { app } = createServer({
      port: 0,
      repository: createMemoryRepository(),
      enableStatusSync: false
    });

    const { sessionId } = await getSessionId(
      await app.handle(
        new Request("http://localhost/wakawars/v0/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wakawarsUsername: "mo",
            apiKey: "key"
          })
        })
      )
    );

    const response = await app.handle(
      new Request("http://localhost/wakawars/v0/friends", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wakawars-session": sessionId ?? ""
        },
        body: JSON.stringify({ username: "ghost" })
      })
    );

    expect(response.status).toBe(404);
  });

  it("marks private users when unauthorized", async () => {
    const repository = createMemoryRepository();
    const { app, store } = createServer({
      port: 0,
      repository,
      enableStatusSync: false
    });

    const { sessionId } = await getSessionId(
      await app.handle(
        new Request("http://localhost/wakawars/v0/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wakawarsUsername: "mo",
            apiKey: "key"
          })
        })
      )
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wakawarsUsername: "private",
          apiKey: "key"
        })
      })
    );

    await app.handle(
      new Request("http://localhost/wakawars/v0/friends", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-wakawars-session": sessionId ?? ""
        },
        body: JSON.stringify({ username: "private" })
      })
    );

    const dateKey = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const mo = await store.getUserByUsername("mo");
    const privateUser = await store.getUserByUsername("private");
    await store.upsertDailyStat({
      userId: mo!.id,
      dateKey,
      totalSeconds: 1200,
      status: "ok",
      error: null,
      fetchedAt: now
    });
    await store.upsertDailyStat({
      userId: privateUser!.id,
      dateKey,
      totalSeconds: 0,
      status: "private",
      error: "User data is private or unauthorized",
      fetchedAt: now
    });

    const statsResponse = await app.handle(
      new Request("http://localhost/wakawars/v0/stats/today", {
        headers: { "x-wakawars-session": sessionId ?? "" }
      })
    );
    const statsPayload = (await statsResponse.json()) as {
      entries: Array<{ username: string; status: string }>;
    };

    const privateEntry = statsPayload.entries.find((entry) => entry.username === "private");
    expect(privateEntry?.status).toBe("private");
  });
});
