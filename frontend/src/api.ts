export type Task = {
  id: string;
  name: string;
  icon: string;
  category: string;
  color: string;
  difficulty: "normal" | "hard";
  repeat: "daily" | "weekdays" | "weekends" | "custom" | "once";
  days: number[];
  startDate: string;
  endDate: string | null;
  isHabit: boolean;
  createdAt: number;
};

export type Settings = { name: string; weekStartsOn: 0 | 1 };

export type PlannerState = {
  tasks: Task[];
  completions: Record<string, boolean>;
  settings: Settings;
  unlocked: string[];
  initialized: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!response.ok) {
    let message = "Не удалось сохранить";
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep fallback */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export type LedgerKind = "income" | "expense" | "saving";

export type Forecast = {
  month: string;
  income: number;
  expense: number;
};

export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  amount: number;
  note: string;
  category: string;
  day: string;
  createdAt: number;
};

export const api = {
  state: () => request<PlannerState>("/api/state"),
  settings: (settings: Settings) => request<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) }),
  saveTask: (task: Task) => request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (task: Task) => request<Task>(`/api/tasks/${encodeURIComponent(task.id)}`, { method: "PUT", body: JSON.stringify(task) }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  toggle: (taskId: string, date: string) => request<{ done: boolean }>("/api/completions/toggle", { method: "POST", body: JSON.stringify({ taskId, date }) }),
  unlock: (ids: string[]) => request<{ unlocked: string[] }>("/api/achievements", { method: "POST", body: JSON.stringify({ ids }) }),
  seed: (state: PlannerState) => request<PlannerState>("/api/seed", { method: "POST", body: JSON.stringify(state) }),
  replace: (state: PlannerState) => request<PlannerState>("/api/state", { method: "PUT", body: JSON.stringify(state) }),
  ledger: () => request<LedgerEntry[]>("/api/ledger"),
  saveLedger: (entry: LedgerEntry) => request<LedgerEntry>("/api/ledger", { method: "POST", body: JSON.stringify(entry) }),
  deleteLedger: (id: string) => request<void>(`/api/ledger/${encodeURIComponent(id)}`, { method: "DELETE" }),
  clearLedger: () => request<void>("/api/ledger", { method: "DELETE" }),
  forecasts: () => request<Forecast[]>("/api/forecasts"),
  saveForecast: (item: Forecast) => request<Forecast>("/api/forecasts", { method: "PUT", body: JSON.stringify(item) }),
  deleteForecast: (month: string) => request<void>(`/api/forecasts/${encodeURIComponent(month)}`, { method: "DELETE" }),
  dayNotes: () => request<DayNote[]>("/api/days"),
  saveDayNote: (note: DayNote) => request<DayNote>(`/api/days/${encodeURIComponent(note.day)}`, { method: "PUT", body: JSON.stringify(note) }),
  clearDayNotes: () => request<void>("/api/days", { method: "DELETE" }),
  telegram: () => request<TelegramStatus>("/api/telegram"),
  saveTelegram: (body: TelegramSave) => request<TelegramStatus>("/api/telegram", { method: "PUT", body: JSON.stringify(body) }),
  telegramLink: () => request<TelegramStatus>("/api/telegram/link", { method: "POST" }),
  telegramUnlink: () => request<TelegramStatus>("/api/telegram/link", { method: "DELETE" }),
  hours: () => request<HourPlan>("/api/hours"),
  saveHour: (task: { weekday: number; name: string; until: string }) => request<HourTask>("/api/hours", { method: "POST", body: JSON.stringify(task) }),
  deleteHour: (id: string) => request<void>(`/api/hours/${encodeURIComponent(id)}`, { method: "DELETE" }),
  toggleHour: (id: string, day: string) => request<{ done: boolean }>("/api/hours/toggle", { method: "POST", body: JSON.stringify({ id, day }) }),
  clearHours: () => request<void>("/api/hours", { method: "DELETE" }),
};

export type HourTask = {
  id: string;
  weekday: number;
  name: string;
  until: string;
  position: number;
};

export type HourPlan = {
  tasks: HourTask[];
  done: Record<string, boolean>;
};

export type TelegramStatus = {
  tokenSet: boolean;
  tokenFromEnv: boolean;
  connected: boolean;
  username: string;
  botName: string;
  reminderTime: string;
  reminderEnabled: boolean;
  linkCode: string;
  lastError: string;
};

export type TelegramSave = {
  token?: string;
  reminderTime: string;
  reminderEnabled: boolean;
  clearToken?: boolean;
};

export type DayMood = "hard" | "ok" | "good" | "great";

export type DayNote = {
  day: string;
  mood: DayMood;
  note: string;
  updatedAt: number;
};
