import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "../src/app.js";

const createTempDir = async () => mkdtemp(path.join(os.tmpdir(), "molty-server-"));

describe("server app", () => {
  let dataDir = "";

  beforeEach(async () => {
    dataDir = await createTempDir();
  });

  afterEach(async () => {
    if (dataDir) {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("stores config and returns public config", async () => {
    const { app } = createServer({ dataDir, port: 0, fetcher: async () => new Response() });

    const response = await app.handle(
      new Request("http://localhost/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "mo", apiKey: "key" })
      })
    );

    const payload = (await response.json()) as { username: string; hasApiKey: boolean };
    expect(payload.username).toBe("mo");
    expect(payload.hasApiKey).toBe(true);

    const configResponse = await app.handle(new Request("http://localhost/config"));
    const configPayload = (await configResponse.json()) as { username: string; hasApiKey: boolean };
    expect(configPayload.username).toBe("mo");
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

    const { app } = createServer({ dataDir, port: 0, fetcher: mockFetch as typeof fetch });

    await app.handle(
      new Request("http://localhost/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "mo", apiKey: "key" })
      })
    );

    await app.handle(
      new Request("http://localhost/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "amy" })
      })
    );

    await app.handle(
      new Request("http://localhost/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "ben" })
      })
    );

    const statsResponse = await app.handle(new Request("http://localhost/stats/today"));
    const statsPayload = (await statsResponse.json()) as { entries: Array<{ username: string }> };
    expect(statsPayload.entries.map((entry) => entry.username)).toEqual(["amy", "mo", "ben"]);
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

    const { app } = createServer({ dataDir, port: 0, fetcher: mockFetch as typeof fetch });

    await app.handle(
      new Request("http://localhost/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "mo", apiKey: "key" })
      })
    );

    await app.handle(
      new Request("http://localhost/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "private" })
      })
    );

    const statsResponse = await app.handle(new Request("http://localhost/stats/today"));
    const statsPayload = (await statsResponse.json()) as {
      entries: Array<{ username: string; status: string }>;
    };

    const privateEntry = statsPayload.entries.find((entry) => entry.username === "private");
    expect(privateEntry?.status).toBe("private");
  });
});
