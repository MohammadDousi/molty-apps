import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { computeLeaderboard } from "@molty/shared";
import type { PublicConfig, UserConfig, DailyStat, LeaderboardResponse } from "@molty/shared";
import { createConfigStore } from "./storage.js";
import { createWakaTimeClient } from "./wakatime.js";

export type ServerOptions = {
  dataDir: string;
  port: number;
  hostname?: string;
  fetcher?: typeof fetch;
};

const toPublicConfig = (config: UserConfig): PublicConfig => ({
  username: config.username,
  friends: config.friends.map((friend) => ({ username: friend.username })),
  hasApiKey: Boolean(config.apiKey)
});

const normalizeUsername = (value: string): string => value.trim();

export const createServer = ({ dataDir, port, hostname = "127.0.0.1", fetcher }: ServerOptions) => {
  const store = createConfigStore(dataDir);
  const wakatime = createWakaTimeClient({ fetcher });

  const app = new Elysia({ adapter: node() })
    .use(
      cors({
        origin: true,
        methods: ["GET", "POST", "DELETE"]
      })
    )
    .get("/health", () => ({ status: "ok" }))
    .get("/config", async () => {
      const config = await store.get();
      return toPublicConfig(config);
    })
    .post(
      "/config",
      async ({ body, set }) => {
        const username = normalizeUsername(body.username);
        const apiKey = body.apiKey.trim();

        if (!username) {
          set.status = 400;
          return { error: "Username is required" };
        }

        if (!apiKey) {
          set.status = 400;
          return { error: "WakaTime API key is required" };
        }

        const updated = await store.update((config) => ({
          ...config,
          username,
          apiKey
        }));

        return toPublicConfig(updated);
      },
      {
        body: t.Object({
          username: t.String(),
          apiKey: t.String()
        })
      }
    )
    .post(
      "/friends",
      async ({ body, set }) => {
        const friendUsername = normalizeUsername(body.username);
        const friendApiKey = body.apiKey?.trim() || null;

        if (!friendUsername) {
          set.status = 400;
          return { error: "Friend username is required" };
        }

        const updated = await store.update((config) => {
          if (friendUsername === config.username) {
            return config;
          }

          const exists = config.friends.some((friend) => friend.username === friendUsername);
          if (exists) {
            return config;
          }

          return {
            ...config,
            friends: [
              ...config.friends,
              {
                username: friendUsername,
                apiKey: friendApiKey
              }
            ]
          };
        });

        return toPublicConfig(updated);
      },
      {
        body: t.Object({
          username: t.String(),
          apiKey: t.Optional(t.String())
        })
      }
    )
    .delete(
      "/friends/:username",
      async ({ params }) => {
        const friendUsername = normalizeUsername(params.username);

        const updated = await store.update((config) => ({
          ...config,
          friends: config.friends.filter((friend) => friend.username !== friendUsername)
        }));

        return toPublicConfig(updated);
      },
      {
        params: t.Object({
          username: t.String()
        })
      }
    )
    .get("/stats/today", async ({ set }) => {
      const config = await store.get();

      if (!config.username || !config.apiKey) {
        set.status = 400;
        return { error: "App is not configured" };
      }

      const users = [
        { username: config.username, apiKey: config.apiKey },
        ...config.friends.map((friend) => ({
          username: friend.username,
          apiKey: friend.apiKey || config.apiKey
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

          return wakatime.getStatusBarToday(user.username, user.apiKey);
        })
      );

      const stats: DailyStat[] = results.map((result, index) => ({
        username: users[index].username,
        totalSeconds: result.totalSeconds,
        status: result.status,
        error: result.error ?? null
      }));

      const entries = computeLeaderboard(stats, config.username);
      const updatedAtEpoch = Math.max(...results.map((result) => result.fetchedAt));

      const response: LeaderboardResponse = {
        date: new Date().toISOString().slice(0, 10),
        updatedAt: new Date(updatedAtEpoch).toISOString(),
        entries
      };

      return response;
    });

  const listen = () => {
    app.listen({ port, hostname });
    return app;
  };

  return { app, listen, store };
};
