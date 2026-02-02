import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { computeLeaderboard } from "@molty/shared";
import type { PublicConfig, UserConfig, DailyStat, LeaderboardResponse } from "@molty/shared";
import { createWakaTimeClient } from "./wakatime.js";
import { createPrismaClient } from "./db.js";
import { createPrismaRepository, type UserRepository } from "./repository.js";
import { hashPassword, verifyPassword } from "./auth.js";
import {
  createMemorySessionStore,
  createPrismaSessionStore,
  type SessionStore
} from "./session-store.js";

export type ServerOptions = {
  port: number;
  hostname?: string;
  fetcher?: typeof fetch;
  databaseUrl?: string;
  repository?: UserRepository;
  sessionStore?: SessionStore;
};

const toPublicConfig = (config: UserConfig): PublicConfig => ({
  wakawarsUsername: config.wakawarsUsername,
  friends: config.friends.map((friend) => ({
    username: friend.username
  })),
  hasApiKey: Boolean(config.apiKey),
  passwordSet: Boolean(config.passwordHash)
});

const normalizeUsername = (value: string): string => value.trim().toLowerCase();

const normalizeFriendUsername = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const withoutQuery = withoutProtocol.split("?")[0]?.split("#")[0] ?? withoutProtocol;
  const segments = withoutQuery.split("/").filter(Boolean);
  const lastSegment = segments.length ? segments[segments.length - 1] : withoutQuery;
  return normalizeUsername(lastSegment.replace(/^@/, ""));
};

export const createServer = ({
  port,
  hostname = "localhost",
  fetcher,
  databaseUrl,
  repository,
  sessionStore
}: ServerOptions) => {
  const prisma = repository ? null : createPrismaClient(databaseUrl);
  const store = repository ?? createPrismaRepository(prisma!);
  const wakatime = createWakaTimeClient({ fetcher });
  const sessions =
    sessionStore ?? (prisma ? createPrismaSessionStore(prisma) : createMemorySessionStore());

  const requireSession = async (
    headers: Record<string, string | undefined>,
    set: { status: number }
  ) => {
    const token = headers["x-wakawars-session"];
    if (!token) {
      set.status = 401;
      return { ok: false, user: null } as const;
    }

    const userId = await sessions.getUserId(token);
    if (!userId) {
      set.status = 401;
      return { ok: false, user: null } as const;
    }

    const user = await store.getUserById(userId);
    if (!user) {
      set.status = 401;
      return { ok: false, user: null } as const;
    }

    return { ok: true, user } as const;
  };

  const app = new Elysia({ adapter: node() })
    .use(
      cors({
        origin: true,
        methods: ["GET", "POST", "DELETE"]
      })
    )
    .get("/health", () => ({ status: "ok", apps: ["wakawars"] }))
    .group("/wakawars/v0", (group) =>
      group
        .get("/health", () => ({ status: "ok" }))
        .get("/session", async ({ headers }) => {
          const token = headers["x-wakawars-session"];
          if (token) {
            const userId = await sessions.getUserId(token);
            if (userId) {
              const user = await store.getUserById(userId);
              if (user) {
                return {
                  authenticated: true,
                  passwordSet: Boolean(user.passwordHash),
                  wakawarsUsername: user.wakawarsUsername,
                  hasUser: true
                };
              }
            }
          }

          const hasUser = (await store.countUsers()) > 0;
          return {
            authenticated: false,
            passwordSet: false,
            hasUser
          };
        })
        .post(
          "/session/login",
          async ({ body, set }) => {
            const username = normalizeUsername(body.username);
            if (!username) {
              set.status = 400;
              return { error: "Username is required" };
            }
            const user = await store.getUserByUsername(username);

            if (!user) {
              set.status = 404;
              return { error: "User not found" };
            }

            if (user.passwordHash) {
              const ok = await verifyPassword(body.password, user.passwordHash);
              if (!ok) {
                set.status = 401;
                return { error: "Invalid credentials" };
              }
            }

            const sessionId = await sessions.create(user.id);
            return {
              sessionId,
              wakawarsUsername: user.wakawarsUsername,
              passwordSet: Boolean(user.passwordHash)
            };
          },
          {
            body: t.Object({
              username: t.String(),
              password: t.String()
            })
          }
        )
        .post("/session/logout", async ({ headers }) => {
          const token = headers["x-wakawars-session"];
          if (token) {
            await sessions.revoke(token);
          }
          return { ok: true };
        })
        .post(
          "/password",
          async ({ body, headers, set }) => {
            const password = body.password.trim();
            if (!password) {
              set.status = 400;
              return { error: "Password is required" };
            }

            const authCheck = await requireSession(headers, set);
            if (!authCheck.ok) {
              return { error: "Unauthorized" };
            }

            const hashed = await hashPassword(password);
            await store.setPassword(authCheck.user.id, hashed);
            return { passwordSet: true };
          },
          {
            body: t.Object({
              password: t.String()
            })
          }
        )
        .get("/config", async ({ headers, set }) => {
          const authCheck = await requireSession(headers, set);
          if (!authCheck.ok) {
            return { error: "Unauthorized" };
          }

          return toPublicConfig(authCheck.user);
        })
        .post(
          "/config",
          async ({ body, set, headers }) => {
            const wakawarsUsername = normalizeUsername(body.wakawarsUsername);
            const apiKey = body.apiKey.trim();

            if (!wakawarsUsername) {
              set.status = 400;
              return { error: "WakaWars username is required" };
            }

            if (!apiKey) {
              set.status = 400;
              return { error: "WakaTime API key is required" };
            }

            const token = headers["x-wakawars-session"];
            if (token) {
              const userId = await sessions.getUserId(token);
              if (!userId) {
                set.status = 401;
                return { error: "Unauthorized" };
              }

              const existing = await store.getUserByUsername(wakawarsUsername);
              if (existing && existing.id !== userId) {
                set.status = 409;
                return { error: "Username already taken" };
              }

              const updated = await store.updateUser(userId, {
                wakawarsUsername,
                apiKey
              });

              return { config: toPublicConfig(updated) };
            }

            const existing = await store.getUserByUsername(wakawarsUsername);
            if (existing) {
              set.status = 409;
              return { error: "Username already taken" };
            }

            const created = await store.createUser({
              wakawarsUsername,
              apiKey
            });
            const sessionId = await sessions.create(created.id);

            return { sessionId, config: toPublicConfig(created) };
          },
          {
            body: t.Object({
              wakawarsUsername: t.String(),
              apiKey: t.String()
            })
          }
        )
        .get(
          "/users/search",
          async ({ query, headers, set }) => {
            const authCheck = await requireSession(headers, set);
            if (!authCheck.ok) {
              return { error: "Unauthorized" };
            }

            const results = await store.searchUsers(query.q, {
              excludeUserId: authCheck.user.id
            });

            return {
              users: results.map((user) => ({
                username: user.wakawarsUsername
              }))
            };
          },
          {
            query: t.Object({
              q: t.String()
            })
          }
        )
        .post(
          "/friends",
          async ({ body, set, headers }) => {
            const authCheck = await requireSession(headers, set);
            if (!authCheck.ok) {
              return { error: "Unauthorized" };
            }

            const friendUsername = normalizeFriendUsername(body.username);

            if (!friendUsername) {
              set.status = 400;
              return { error: "Friend username is required" };
            }

            const friend = await store.getUserByUsername(friendUsername);
            if (!friend) {
              set.status = 404;
              return { error: "Friend not found" };
            }

            if (friend.id === authCheck.user.id) {
              return toPublicConfig(authCheck.user);
            }

            const updated = await store.addFriendship(authCheck.user.id, friend.id);

            return toPublicConfig(updated);
          },
          {
            body: t.Object({
              username: t.String()
            })
          }
        )
        .delete(
          "/friends/:username",
          async ({ params, headers, set }) => {
            const authCheck = await requireSession(headers, set);
            if (!authCheck.ok) {
              return { error: "Unauthorized" };
            }

            const friendUsername = normalizeFriendUsername(params.username);

            const friend = await store.getUserByUsername(friendUsername);
            if (!friend) {
              return toPublicConfig(authCheck.user);
            }

            const updated = await store.removeFriendship(authCheck.user.id, friend.id);

            return toPublicConfig(updated);
          },
          {
            params: t.Object({
              username: t.String()
            })
          }
        )
        .get("/stats/today", async ({ set, headers }) => {
          const authCheck = await requireSession(headers, set);
          if (!authCheck.ok) {
            return { error: "Unauthorized" };
          }

          const config = await store.getUserById(authCheck.user.id);
          if (!config) {
            set.status = 401;
            return { error: "Unauthorized" };
          }

          if (!config.wakawarsUsername || !config.apiKey) {
            set.status = 400;
            return { error: "App is not configured" };
          }

          const users = [
            {
              username: config.wakawarsUsername,
              wakatimeUsername: "current",
              apiKey: config.apiKey
            },
            ...config.friends.map((friend) => ({
              username: friend.username,
              wakatimeUsername: friend.username,
              apiKey: friend.apiKey || ""
            }))
          ];

          const results = await Promise.all(
            users.map(async (user) => {
              if (!user.apiKey) {
                return {
                  username: user.username,
                  status: "error",
                  totalSeconds: 0,
                  error: "Missing API key",
                  fetchedAt: Date.now()
                } as const;
              }

              return wakatime.getStatusBarToday(user.wakatimeUsername, user.apiKey);
            })
          );

          const stats: DailyStat[] = results.map((result, index) => ({
            username: users[index].username,
            totalSeconds: result.totalSeconds,
            status: result.status,
            error: result.error ?? null
          }));

          const entries = computeLeaderboard(stats, config.wakawarsUsername);
          const updatedAtEpoch = Math.max(...results.map((result) => result.fetchedAt));

          const response: LeaderboardResponse = {
            date: new Date().toISOString().slice(0, 10),
            updatedAt: new Date(updatedAtEpoch).toISOString(),
            entries
          };

          return response;
        })
    );

  const listen = () => {
    app.listen({ port, hostname });
    return app;
  };

  const disconnect = async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  };

  const close = async () => {
    if (app.server) {
      await new Promise<void>((resolve) => app.server?.close(() => resolve()));
    }
    await disconnect();
  };

  return { app, listen, store, disconnect, close };
};
