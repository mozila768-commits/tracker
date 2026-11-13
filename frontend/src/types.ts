import type { Settings, Task } from "./api";

export type Page = "dashboard" | "tasks" | "habits" | "hours" | "calendar" | "statistics" | "achievements" | "finance" | "settings";

export type UIState = {
  page: Page;
  cursor: string;
  tableMode: "week" | "month";
  calMode: "month" | "week" | "day";
  day: string | null;
  modal: null | { mode: "add" | "edit"; isHabit?: boolean; presetDate?: string | null; id?: string };
  confirm: null | { kind: "delete" | "erase"; id?: string; name?: string };
  filter: string;
  range: 7 | 30;
  enter: boolean;
};

export type Actions = {
  nav: (page: Page) => void;
  shiftMonth: (dir: number) => void;
  shiftWeek: (dir: number) => void;
  shiftDay: (dir: number) => void;
  goToday: () => void;
  setTableMode: (mode: "week" | "month") => void;
  setCalMode: (mode: "month" | "week" | "day") => void;
  setFilter: (filter: string) => void;
  setRange: (range: 7 | 30) => void;
  setWeekStart: (start: 0 | 1) => void;
  openDay: (iso: string) => void;
  shiftOpenDay: (iso: string) => void;
  closeDay: () => void;
  toggle: (id: string, iso: string) => void;
  openAdd: (habit: boolean, date?: string) => void;
  openEdit: (id: string) => void;
  closeModal: () => void;
  closeConfirm: () => void;
  deleteAsk: (id: string) => void;
  confirmDelete: () => void;
  eraseAsk: () => void;
  confirmErase: () => void;
  saveTask: (input: Partial<Task> & { name: string }) => string | null;
  saveName: (name: string) => void;
  exportData: () => void;
  importData: (raw: unknown) => void;
};

export type TrackerContext = {
  tasks: Task[];
  completions: Record<string, boolean>;
  settings: Settings;
  unlocked: string[];
  stats: ReturnType<typeof import("./logic").computeStats>;
  today: Date;
  cursorDate: Date;
  ui: UIState;
  fx: { key: string | null; streak: boolean };
  actions: Actions;
};
