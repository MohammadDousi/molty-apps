import { describe, expect, it } from "vitest";
import {
  IRAN_DAILY_SYNC_HOUR,
  IRAN_DAILY_SYNC_MINUTE,
  IRAN_DAILY_SYNC_TIME_ZONE,
  resolveNextDailyRunAt
} from "../src/wakatime-sync.js";

describe("resolveNextDailyRunAt", () => {
  it("returns same-day 23:59 Iran when current time is earlier", () => {
    const now = new Date("2026-02-22T06:00:00.000Z");

    const nextRunAt = resolveNextDailyRunAt({
      now,
      timeZone: IRAN_DAILY_SYNC_TIME_ZONE,
      hour: IRAN_DAILY_SYNC_HOUR,
      minute: IRAN_DAILY_SYNC_MINUTE
    });

    expect(nextRunAt.toISOString()).toBe("2026-02-22T20:29:00.000Z");
  });

  it("returns next-day 23:59 Iran when current time is later", () => {
    const now = new Date("2026-02-22T21:00:00.000Z");

    const nextRunAt = resolveNextDailyRunAt({
      now,
      timeZone: IRAN_DAILY_SYNC_TIME_ZONE,
      hour: IRAN_DAILY_SYNC_HOUR,
      minute: IRAN_DAILY_SYNC_MINUTE
    });

    expect(nextRunAt.toISOString()).toBe("2026-02-23T20:29:00.000Z");
  });

  it("schedules the next day when already at 23:59 Iran", () => {
    const now = new Date("2026-02-22T20:29:00.000Z");

    const nextRunAt = resolveNextDailyRunAt({
      now,
      timeZone: IRAN_DAILY_SYNC_TIME_ZONE,
      hour: IRAN_DAILY_SYNC_HOUR,
      minute: IRAN_DAILY_SYNC_MINUTE
    });

    expect(nextRunAt.toISOString()).toBe("2026-02-23T20:29:00.000Z");
  });
});
