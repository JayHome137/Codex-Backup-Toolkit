import { describe, expect, it } from "vitest";
import { buildSchedule, shouldRunBackup } from "./schedule";

describe("backup schedule", () => {
  const base = new Date("2026-06-11T10:00:00.000Z");

  it("keeps manual mode from becoming due automatically", () => {
    const schedule = buildSchedule({
      mode: "manual",
      lastSuccessAt: "2026-06-10T10:00:00.000Z",
      now: base
    });

    expect(schedule.nextDueAt).toBeNull();
    expect(schedule.isDue).toBe(false);
  });

  it("defaults to three days and becomes due after the interval", () => {
    const schedule = buildSchedule({
      mode: "preset",
      days: 3,
      lastSuccessAt: "2026-06-08T09:59:59.000Z",
      now: base
    });

    expect(schedule.nextDueAt).toBe("2026-06-11T09:59:59.000Z");
    expect(schedule.isDue).toBe(true);
    expect(shouldRunBackup(schedule)).toBe(true);
  });

  it("uses now as the first due time when automatic backups have never succeeded", () => {
    const schedule = buildSchedule({
      mode: "preset",
      days: 7,
      lastSuccessAt: null,
      now: base
    });

    expect(schedule.nextDueAt).toBe("2026-06-11T10:00:00.000Z");
    expect(schedule.isDue).toBe(true);
  });

  it("supports a custom day interval", () => {
    const schedule = buildSchedule({
      mode: "custom",
      days: 10,
      lastSuccessAt: "2026-06-05T10:00:00.000Z",
      now: base
    });

    expect(schedule.nextDueAt).toBe("2026-06-15T10:00:00.000Z");
    expect(schedule.isDue).toBe(false);
  });
});
