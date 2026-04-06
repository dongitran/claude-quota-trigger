export interface CqtConfig {
  readonly firstTriggerHour: number;
  readonly triggerHours: readonly number[];
  readonly model: string;
  readonly randomMinutes: readonly number[];
  readonly enabled: boolean;
}

export interface TriggerEntry {
  readonly hour: number;
  readonly minute: number;
}

export interface ScheduleStatus {
  readonly enabled: boolean;
  readonly entries: readonly TriggerEntry[];
  readonly nextTrigger: TriggerEntry | null;
}

export const DEFAULT_CONFIG: CqtConfig = {
  firstTriggerHour: 5,
  triggerHours: [5, 10, 15, 20],
  model: "haiku",
  randomMinutes: [],
  enabled: false,
};

export const CRON_MARKER_BEGIN = "# CQT-BEGIN";
export const CRON_MARKER_END = "# CQT-END";
