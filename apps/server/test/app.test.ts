import { describe, expect, it } from "vitest";
import type { UserConfig } from "@molty/shared";
import { createServer } from "../src/app.js";
import type { UserRepository } from "../src/repository.js";

type UserRecord = Omit<UserConfig, "friends">;

const createMemoryRepository = (): UserRepository => {
  let users: UserRecord[] = [];
  let friendships: Array<{ userId: number; friendId: number }> = [];
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
    }
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
      fetcher: async () => new Response()
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
    const mockFetch = async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/users/ben/status_bar/today")) {
        return new Response(JSON.stringify({ data: { grand_total: { total_seconds: 1800 } } }), {
          status: 200
        });
      }
      if (url.includes("/users/amy/status_bar/today")) {
        return new Response(JSON.stringify({ data: { grand_total: { total_seconds: 3600 } } }), {
          status: 200
        });
      }
      return new Response(JSON.stringify({ data: { grand_total: { total_seconds: 900 } } }), {
        status: 200
      });
    };

    const { app } = createServer({
      port: 0,
      repository: createMemoryRepository(),
      fetcher: mockFetch as typeof fetch
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

    const statsResponse = await app.handle(
      new Request("http://localhost/wakawars/v0/stats/today", {
        headers: { "x-wakawars-session": sessionId ?? "" }
      })
    );
    const statsPayload = (await statsResponse.json()) as { entries: Array<{ username: string }> };
    expect(statsPayload.entries.map((entry) => entry.username)).toEqual(["amy", "ben", "mo"]);
  });

  it("rejects unknown friends", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ data: { grand_total: { total_seconds: 900 } } }), {
        status: 200
      });

    const { app } = createServer({
      port: 0,
      repository: createMemoryRepository(),
      fetcher: mockFetch as typeof fetch
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
    const mockFetch = async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/users/private/status_bar/today")) {
        return new Response("", { status: 403 });
      }
      return new Response(JSON.stringify({ data: { grand_total: { total_seconds: 1200 } } }), {
        status: 200
      });
    };

    const { app } = createServer({
      port: 0,
      repository: createMemoryRepository(),
      fetcher: mockFetch as typeof fetch
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
