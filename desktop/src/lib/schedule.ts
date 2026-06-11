export type ScheduleMode = "manual" | "preset" | "custom";

export type ScheduleInput = {
  mode: ScheduleMode;
  days?: number;
  lastSuccessAt: string | null;
  now?: Date;
};

export type ScheduleState = {
  mode: ScheduleMode;
  intervalDays: number | null;
  lastSuccessAt: string | null;
  nextDueAt: string | null;
  isDue: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeIntervalDays(mode: ScheduleMode, days?: number): number | null {
  if (mode === "manual") {
    return null;
  }
  if (!days || !Number.isFinite(days) || days < 1) {
    return 3;
  }
  return Math.floor(days);
}

export function buildSchedule(input: ScheduleInput): ScheduleState {
  const now = input.now ?? new Date();
  const intervalDays = normalizeIntervalDays(input.mode, input.days);

  if (intervalDays === null) {
    return {
      mode: input.mode,
      intervalDays,
      lastSuccessAt: input.lastSuccessAt,
      nextDueAt: null,
      isDue: false
    };
  }

  if (!input.lastSuccessAt) {
    return {
      mode: input.mode,
      intervalDays,
      lastSuccessAt: null,
      nextDueAt: now.toISOString(),
      isDue: true
    };
  }

  const lastSuccess = new Date(input.lastSuccessAt);
  const nextDue = new Date(lastSuccess.getTime() + intervalDays * MS_PER_DAY);

  return {
    mode: input.mode,
    intervalDays,
    lastSuccessAt: input.lastSuccessAt,
    nextDueAt: nextDue.toISOString(),
    isDue: now.getTime() >= nextDue.getTime()
  };
}

export function shouldRunBackup(schedule: ScheduleState): boolean {
  return schedule.mode !== "manual" && schedule.isDue;
}
