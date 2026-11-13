import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type PlannerState, type Settings, type Task } from "./api";
import { Shell } from "./shell";
import {
  ACHIEVEMENTS,
  XP_PERFECT_DAY,
  addDays,
  addMonths,
  computeStats,
  dayProgress,
  earnedAchievementIds,
  isScheduled,
  parseISO,
  sanitizeTask,
  startOfDay,
  taskXp,
  toISO,
  uid,
} from "./logic";
import type { Actions, Page, TrackerContext, UIState } from "./types";

const PAGES: Page[] = ["dashboard", "tasks", "habits", "hours", "calendar", "statistics", "achievements", "finance", "settings"];
const TITLES: Record<Page, string> = {
  dashboard: "Главная",
  tasks: "Задачи",
  habits: "Привычки",
  hours: "Часы",
  calendar: "Календарь",
  statistics: "Статистика",
  achievements: "Достижения",
  finance: "Финансы",
  settings: "Настройки",
};

function pageFromHash(): Page {
  const page = location.hash.replace(/^#\/?/, "") as Page;
  return PAGES.includes(page) ? page : "dashboard";
}

function todayDate() {
  return startOfDay(new Date());
}

function pushToast(html: string, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  document.getElementById("toasts")?.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 280);
  }, 2300);
}

function missingAchievements(state: PlannerState, today: Date) {
  const stats = computeStats(state.tasks, state.completions, today, state.settings.weekStartsOn);
  return earnedAchievementIds(stats).filter((id: string) => !state.unlocked.includes(id));
}

export function App() {
  const [data, setData] = useState<PlannerState | null>(null);
  const [error, setError] = useState("");
  const [ui, setUi] = useState<UIState>(() => ({
    page: pageFromHash(),
    cursor: toISO(new Date()),
    tableMode: "week",
    calMode: "month",
    day: null,
    modal: null,
    confirm: null,
    filter: "all",
    range: 7,
    enter: false,
  }));
  const [fx, setFx] = useState<{ key: string | null; streak: boolean }>({ key: null, streak: false });

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        let state = await api.state();
        const today = todayDate();
        if (!state.initialized) {
          state = await api.seed({
            tasks: [],
            completions: {},
            settings: state.settings,
            unlocked: [],
            initialized: true,
          });
        } else {
          const fresh = missingAchievements(state, today);
          if (fresh.length) {
            const saved = await api.unlock(fresh);
            state = { ...state, unlocked: saved.unlocked };
          }
        }
        if (!stop) setData(state);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Сервер не отвечает");
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    const onHash = () => setUi((prev) => ({ ...prev, page: pageFromHash(), day: null, modal: null, confirm: null, enter: true }));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setUi((prev) => (prev.modal || prev.confirm || prev.day ? { ...prev, modal: null, confirm: null, day: null } : prev));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.title = `${TITLES[ui.page]} · ТРЕКЕР ЖИЗНИ`;
    document.body.dataset.page = ui.page;
  }, [ui.page]);

  useEffect(() => {
    if (!fx.key && !fx.streak) return;
    const timer = setTimeout(() => setFx({ key: null, streak: false }), 700);
    return () => clearTimeout(timer);
  }, [fx]);

  const fail = useCallback((err: unknown) => {
    pushToast(err instanceof Error ? err.message : "Не удалось сохранить", "warn");
  }, []);

  const actions: Actions = {
    nav: (page) => {
      const hash = `#/${page}`;
      if (location.hash === hash) {
        setUi((prev) => ({ ...prev, page, day: null, modal: null, confirm: null }));
        return;
      }
      location.hash = hash;
    },
    shiftMonth: (dir) => setUi((prev) => ({ ...prev, cursor: toISO(addMonths(parseISO(prev.cursor), dir)) })),
    shiftWeek: (dir) => setUi((prev) => ({ ...prev, cursor: toISO(addDays(parseISO(prev.cursor), 7 * dir)) })),
    shiftDay: (dir) => setUi((prev) => ({ ...prev, cursor: toISO(addDays(parseISO(prev.cursor), dir)) })),
    goToday: () => setUi((prev) => ({ ...prev, cursor: toISO(todayDate()), day: prev.day ? toISO(todayDate()) : null })),
    setTableMode: (mode) => setUi((prev) => ({ ...prev, tableMode: mode })),
    setCalMode: (mode) => setUi((prev) => ({ ...prev, calMode: mode })),
    setFilter: (filter) => setUi((prev) => ({ ...prev, filter })),
    setRange: (range) => setUi((prev) => ({ ...prev, range })),
    setWeekStart: (start) => {
      if (!data) return;
      const previous = data.settings;
      const settings: Settings = { ...previous, weekStartsOn: start };
      setData({ ...data, settings });
      api.settings(settings).catch((err) => {
        setData((current) => (current ? { ...current, settings: previous } : current));
        fail(err);
      });
    },
    openDay: (iso) => {
      setUi((prev) => (prev.page === "calendar" ? { ...prev, calMode: "day", cursor: iso, day: null } : { ...prev, day: iso }));
    },
    shiftOpenDay: (iso) => setUi((prev) => (prev.page === "calendar" ? { ...prev, cursor: iso } : { ...prev, day: iso })),
    closeDay: () => setUi((prev) => ({ ...prev, day: null })),
    toggle: (id, iso) => {
      if (!data) return;
      const task = data.tasks.find((item) => item.id === id);
      const now = todayDate();
      const date = parseISO(iso);
      if (!task || date > now || !isScheduled(task, date)) return;
      const key = `${id}|${iso}`;
      const wasDone = !!data.completions[key];
      const beforeDay = dayProgress(data.tasks, data.completions, date);
      const before = computeStats(data.tasks, data.completions, now, data.settings.weekStartsOn);
      const completions = { ...data.completions };
      if (wasDone) delete completions[key];
      else completions[key] = true;
      const next = { ...data, completions };
      const fresh = missingAchievements(next, now);
      next.unlocked = [...next.unlocked, ...fresh];
      const afterDay = dayProgress(next.tasks, next.completions, date);
      const after = computeStats(next.tasks, next.completions, now, next.settings.weekStartsOn);
      setData(next);
      setFx({ key, streak: after.streak > before.streak });
      if (!wasDone) {
        pushToast(`<span>⭐</span><b>+${taskXp(task)} XP</b>`, "xp");
        if (!beforeDay.perfect && afterDay.perfect) {
          setTimeout(() => pushToast(`<span>💯</span><span class="toast-copy"><b>Идеальный день!</b><small>+${XP_PERFECT_DAY} XP</small></span>`, "perfect"), 180);
        }
        if (after.level.level > before.level.level) {
          setTimeout(() => pushToast(`<span>🏆</span><b>Уровень ${after.level.level} · ${after.level.name}</b>`, "perfect"), 360);
        }
      }
      fresh.forEach((achievementId, index) => {
        const item = ACHIEVEMENTS.find((achievement) => achievement.id === achievementId);
        if (!item) return;
        setTimeout(() => {
          pushToast(`<span>${item.icon}</span><span class="toast-copy"><small>Достижение</small><b>${item.title}</b></span>`, "award");
        }, 480 + index * 380);
      });
      api.toggle(id, iso).then(() => (fresh.length ? api.unlock(fresh) : null)).catch((err) => {
        setData(data);
        fail(err);
      });
    },
    openAdd: (habit, date) => setUi((prev) => ({ ...prev, modal: { mode: "add", isHabit: habit, presetDate: date || null } })),
    openEdit: (id) => setUi((prev) => ({ ...prev, modal: { mode: "edit", id } })),
    closeModal: () => setUi((prev) => ({ ...prev, modal: null })),
    closeConfirm: () => setUi((prev) => ({ ...prev, confirm: null })),
    deleteAsk: (id) => {
      const task = data?.tasks.find((item) => item.id === id);
      if (!task) return;
      setUi((prev) => ({ ...prev, confirm: { kind: "delete", id: task.id, name: task.name } }));
    },
    confirmDelete: () => {
      if (!data || ui.confirm?.kind !== "delete" || !ui.confirm.id) return;
      const id = ui.confirm.id;
      const previous = data;
      const completions = { ...data.completions };
      for (const key of Object.keys(completions)) {
        if (key.startsWith(`${id}|`)) delete completions[key];
      }
      setData({ ...data, tasks: data.tasks.filter((task) => task.id !== id), completions });
      setUi((prev) => ({ ...prev, modal: null, confirm: null }));
      api.deleteTask(id).then(() => pushToast("Задача удалена", "ok")).catch((err) => {
        setData(previous);
        fail(err);
      });
    },
    eraseAsk: () => setUi((prev) => ({ ...prev, confirm: { kind: "erase" } })),
    confirmErase: () => {
      if (!data) return;
      const next: PlannerState = { tasks: [], completions: {}, settings: data.settings, unlocked: [], initialized: true };
      setUi((prev) => ({ ...prev, confirm: null, modal: null }));
      api.replace(next).then((saved) => api.clearLedger().then(() => api.clearDayNotes()).then(() => api.clearHours()).then(() => {
        window.dispatchEvent(new Event("tracker-hours-reload"));
        return saved;
      })).then((saved) => {
        setData(saved);
        pushToast("Планер очищен", "ok");
      }).catch(fail);
    },
    saveTask: (input) => {
      if (!data) return "Не удалось сохранить";
      const name = String(input.name || "").trim();
      if (!name) return "Назови задачу.";
      if (input.repeat === "custom" && !(input.days || []).length) return "Выбери хотя бы один день.";
      if (input.endDate && input.startDate && input.endDate < input.startDate) return "Дата окончания раньше начала.";
      const draft = sanitizeTask(input, input.id || uid()) as Task | null;
      if (!draft) return "Назови задачу.";
      const exists = data.tasks.some((task) => task.id === draft.id);
      const previous = data;
      const tasks = exists ? data.tasks.map((task) => (task.id === draft.id ? draft : task)) : [...data.tasks, draft];
      setData({ ...data, tasks });
      setUi((prev) => ({ ...prev, modal: null }));
      const request = exists ? api.updateTask(draft) : api.saveTask(draft);
      request.then((saved) => {
        setData((current) => current ? { ...current, tasks: current.tasks.map((task) => (task.id === saved.id ? saved : task)) } : current);
        pushToast(exists ? "Задача обновлена" : "Задача добавлена", "ok");
      }).catch((err) => {
        setData(previous);
        fail(err);
      });
      return null;
    },
    saveName: (name) => {
      if (!data) return;
      const settings: Settings = { ...data.settings, name: name.trim().slice(0, 40) };
      const previous = data.settings;
      setData({ ...data, settings });
      api.settings(settings).then(() => pushToast("Имя сохранено", "ok")).catch((err) => {
        setData((current) => (current ? { ...current, settings: previous } : current));
        fail(err);
      });
    },
    exportData: () => {
      if (!data) return;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "my-life-tracker.json";
      link.click();
      URL.revokeObjectURL(url);
      pushToast("Копия скачана", "ok");
    },
    importData: (raw) => {
      if (!data || !raw || typeof raw !== "object" || !Array.isArray((raw as { tasks?: unknown }).tasks)) {
        pushToast("Это не файл трекера", "warn");
        return;
      }
      const source = raw as PlannerState;
      const tasks = (source.tasks || []).map((task) => sanitizeTask(task)).filter(Boolean).slice(0, 80) as Task[];
      const known = new Set(tasks.map((task) => task.id));
      const completions: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(source.completions || {})) {
        if (value && known.has(String(key).split("|")[0])) completions[key] = true;
      }
      const next: PlannerState = {
        tasks,
        completions,
        settings: {
          name: typeof source.settings?.name === "string" ? source.settings.name.slice(0, 40) : data.settings.name,
          weekStartsOn: source.settings?.weekStartsOn === 0 ? 0 : 1,
        },
        unlocked: Array.isArray(source.unlocked) ? source.unlocked.filter((id) => typeof id === "string") : [],
        initialized: true,
      };
      const fresh = missingAchievements(next, todayDate());
      next.unlocked = [...new Set([...next.unlocked, ...fresh])];
      api.replace(next).then((saved) => {
        setData(saved);
        pushToast("Копия восстановлена", "ok");
      }).catch((err) => {
        if (String(err).includes("прочитать") || (err instanceof Error && err.message.includes("файл"))) {
          pushToast("Не удалось прочитать файл", "warn");
          return;
        }
        fail(err);
      });
    },
  };

  const today = todayDate();
  const stats = useMemo(
    () => (data ? computeStats(data.tasks, data.completions, today, data.settings.weekStartsOn) : null),
    [data, today],
  );

  if (error) {
    return (
      <section className="empty-hero">
        <h2>Сервер не отвечает</h2>
        <p>{error}. Запусти PostgreSQL и Go-сервер, затем обнови страницу.</p>
      </section>
    );
  }
  if (!data || !stats) {
    return (
      <section className="empty-hero">
        <h2>Открываю планер…</h2>
      </section>
    );
  }

  const ctx: TrackerContext = {
    tasks: data.tasks,
    completions: data.completions,
    settings: data.settings,
    unlocked: data.unlocked,
    stats,
    today,
    cursorDate: parseISO(ui.cursor),
    ui,
    fx,
    actions,
  };

  return <Shell ctx={ctx} />;
}
