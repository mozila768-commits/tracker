export const XP_NORMAL = 10;
export const XP_HARD = 20;
export const XP_PERFECT_DAY = 50;

export const LEVELS = [
  { level: 1, name: "Новичок", min: 0 },
  { level: 2, name: "Старт", min: 200 },
  { level: 3, name: "Стабильность", min: 600 },
  { level: 4, name: "Фокус", min: 1200 },
  { level: 5, name: "Дисциплина", min: 4200 },
];

export const CATEGORIES = [
  { id: "study", label: "Учёба", icon: "📚" },
  { id: "work", label: "Работа", icon: "💻" },
  { id: "sport", label: "Спорт", icon: "🏃" },
  { id: "health", label: "Здоровье", icon: "🧘" },
  { id: "reading", label: "Чтение", icon: "📖" },
  { id: "creative", label: "Творчество", icon: "🎨" },
  { id: "personal", label: "Личное", icon: "⭐" },
];

export const COLOR_SWATCHES = [
  "#E9B7BD",
  "#F4D6D9",
  "#BFD4E8",
  "#DDEAF4",
  "#DDD0EA",
  "#D7EFE4",
  "#F6E3C5",
  "#F3C7BE",
];

export const ICON_CHOICES = [
  "📚", "💻", "🏃", "🧘", "📖", "🎨", "💧", "⭐",
  "🌙", "🥗", "📝", "🎯", "🧠", "💪", "☀️", "🎧",
  "✍️", "🧹", "🚶", "🍎", "💤", "🌿", "✨", "❤️",
];

export const ACHIEVEMENTS = [
  { id: "first-task", icon: "🏆", title: "Первая задача", description: "Выполни первую задачу" },
  { id: "ten-tasks", icon: "✓", title: "10 задач", description: "Выполни 10 задач" },
  { id: "fifty-tasks", icon: "✨", title: "50 задач", description: "Выполни 50 задач" },
  { id: "xp-100", icon: "⭐", title: "100 XP", description: "Набери 100 XP" },
  { id: "xp-500", icon: "🌟", title: "500 XP", description: "Набери 500 XP" },
  { id: "streak-3", icon: "🔥", title: "Серия 3 дня", description: "Выполняй задачи 3 дня" },
  { id: "streak-7", icon: "🔥", title: "Серия 7 дней", description: "Выполняй задачи 7 дней" },
  { id: "streak-14", icon: "🔥", title: "Серия 14 дней", description: "Выполняй задачи 14 дней" },
  { id: "streak-30", icon: "🔥", title: "Серия 30 дней", description: "Выполняй задачи 30 дней" },
  { id: "perfect-day", icon: "💯", title: "Идеальный день", description: "Закрой все задачи за день" },
  { id: "perfect-week", icon: "💯", title: "Идеальная неделя", description: "Выполни 100% задач за неделю" },
  { id: "level-5", icon: "🏆", title: "Дисциплина", description: "Достигни 5 уровня" },
];

export const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const DOW = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
export const DOW_SHORT = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
export const DOW_NARROW = ["В", "П", "В", "С", "Ч", "П", "С"];

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date, n) {
  const src = startOfDay(date);
  const day = src.getDate();
  const d = new Date(src.getFullYear(), src.getMonth() + n, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

export function startOfWeek(date, weekStartsOn = 1) {
  const d = startOfDay(date);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function eachDay(start, end) {
  const out = [];
  const last = startOfDay(end).getTime();
  for (let d = startOfDay(start); d.getTime() <= last; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekDays(anchor, weekStartsOn = 1) {
  const date = typeof anchor === "string" ? parseISO(anchor) : anchor;
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekIndexInMonth(date, weekStartsOn = 1) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstWeek = startOfWeek(first, weekStartsOn);
  const thisWeek = startOfWeek(date, weekStartsOn);
  const diff = Math.round((thisWeek.getTime() - firstWeek.getTime()) / 86400000);
  return Math.floor(diff / 7) + 1;
}

export function monthWeeks(year, month, weekStartsOn = 1) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const weeks = [];
  let cursor = startOfWeek(first, weekStartsOn);
  let index = 1;
  while (cursor <= last) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(cursor, i);
      if (d.getMonth() === month && d.getFullYear() === year) {
        days.push(d);
      }
    }
    if (days.length) weeks.push({ index, days });
    cursor = addDays(cursor, 7);
    index += 1;
  }
  return weeks;
}

export function isScheduled(task, date) {
  const iso = toISO(date);
  if (!task.startDate || iso < task.startDate) return false;
  if (task.endDate && iso > task.endDate) return false;
  const dow = date.getDay();
  switch (task.repeat) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekends":
      return dow === 0 || dow === 6;
    case "once":
      return iso === task.startDate;
    case "custom":
      return Array.isArray(task.days) && task.days.includes(dow);
    default:
      return false;
  }
}

export function completionKey(id, iso) {
  return `${id}|${iso}`;
}

export function isDone(completions, id, iso) {
  return !!completions[completionKey(id, iso)];
}

export function taskXp(task) {
  return task.difficulty === "hard" ? XP_HARD : XP_NORMAL;
}

export function tasksOnDate(tasks, date) {
  return tasks.filter((task) => isScheduled(task, date));
}

export function dayProgress(tasks, completions, date) {
  const list = tasksOnDate(tasks, date);
  const iso = toISO(date);
  const done = list.filter((task) => isDone(completions, task.id, iso)).length;
  const total = list.length;
  return {
    done,
    total,
    left: Math.max(0, total - done),
    rate: total ? done / total : 0,
    perfect: total > 0 && done === total,
  };
}

export function rangeProgress(tasks, completions, start, end) {
  let done = 0;
  let total = 0;
  for (const date of eachDay(start, end)) {
    const progress = dayProgress(tasks, completions, date);
    done += progress.done;
    total += progress.total;
  }
  return { done, total, rate: total ? done / total : 0 };
}

export function taskRangeProgress(task, completions, start, end) {
  let done = 0;
  let total = 0;
  for (const date of eachDay(start, end)) {
    if (!isScheduled(task, date)) continue;
    total += 1;
    if (isDone(completions, task.id, toISO(date))) done += 1;
  }
  return { done, total, rate: total ? done / total : 0 };
}

function earliestISO(tasks) {
  return tasks.reduce((min, task) => (task.startDate < min ? task.startDate : min), "9999-12-31");
}

export function totalXp(tasks, completions, today) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  let xp = 0;
  const days = new Set();
  for (const key of Object.keys(completions)) {
    if (!completions[key]) continue;
    const sep = key.indexOf("|");
    if (sep < 0) continue;
    const task = byId.get(key.slice(0, sep));
    const iso = key.slice(sep + 1);
    if (!task) continue;
    const date = parseISO(iso);
    if (date > today) continue;
    if (!isScheduled(task, date)) continue;
    xp += taskXp(task);
    days.add(iso);
  }
  for (const iso of days) {
    if (dayProgress(tasks, completions, parseISO(iso)).perfect) xp += XP_PERFECT_DAY;
  }
  return xp;
}

export function levelInfo(xp) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.min) current = level;
  }
  const next = LEVELS.find((level) => level.level === current.level + 1) || null;
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(1, (xp - current.min) / span) : 1;
  return {
    level: current.level,
    name: current.name,
    min: current.min,
    xp,
    next,
    progress,
    toNext: next ? next.min - xp : 0,
  };
}

export function currentStreakInfo(tasks, completions, today) {
  const days = [];
  if (!tasks.length) return { streak: 0, days };
  const earliest = earliestISO(tasks);
  let cursor = startOfDay(today);
  const todayStats = dayProgress(tasks, completions, cursor);
  if (todayStats.total === 0 || todayStats.done === 0) cursor = addDays(cursor, -1);

  for (let i = 0; i < 500; i++) {
    if (toISO(cursor) < earliest) break;
    const progress = dayProgress(tasks, completions, cursor);
    if (progress.total === 0) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (progress.done === 0) break;
    days.push(toISO(cursor));
    cursor = addDays(cursor, -1);
  }
  return { streak: days.length, days };
}

export function scanHistory(tasks, completions, today, weekStartsOn = 1) {
  const empty = { completed: 0, scheduled: 0, bestStreak: 0, perfectDays: 0, perfectWeeks: 0 };
  if (!tasks.length) return empty;
  const start = parseISO(earliestISO(tasks));
  let best = 0;
  let current = 0;
  let perfectDays = 0;
  let completed = 0;
  let scheduled = 0;
  const weeks = new Map();

  for (const date of eachDay(start, today)) {
    const progress = dayProgress(tasks, completions, date);
    completed += progress.done;
    scheduled += progress.total;
    if (progress.perfect) perfectDays += 1;
    if (progress.total === 0) {
      continue;
    }
    if (progress.done > 0) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
    const weekStart = startOfWeek(date, weekStartsOn);
    const key = toISO(weekStart);
    const bucket = weeks.get(key) || { done: 0, total: 0, start: weekStart };
    bucket.done += progress.done;
    bucket.total += progress.total;
    weeks.set(key, bucket);
  }

  let perfectWeeks = 0;
  for (const bucket of weeks.values()) {
    const weekEnd = addDays(bucket.start, 6);
    if (weekEnd.getTime() <= today.getTime() && bucket.total > 0 && bucket.done === bucket.total) {
      perfectWeeks += 1;
    }
  }

  return { completed, scheduled, bestStreak: best, perfectDays, perfectWeeks };
}

export function computeStats(tasks, completions, today, weekStartsOn = 1) {
  const todayDate = startOfDay(today);
  const xp = totalXp(tasks, completions, todayDate);
  const level = levelInfo(xp);
  const streak = currentStreakInfo(tasks, completions, todayDate);
  const history = scanHistory(tasks, completions, todayDate, weekStartsOn);
  const todayProgress = dayProgress(tasks, completions, todayDate);
  return {
    xp,
    level,
    streak: streak.streak,
    streakDays: streak.days,
    bestStreak: history.bestStreak,
    completed: history.completed,
    scheduled: history.scheduled,
    completionRate: history.scheduled ? history.completed / history.scheduled : 0,
    todayProgress,
    perfectDays: history.perfectDays,
    perfectWeeks: history.perfectWeeks,
  };
}

export function earnedAchievementIds(stats) {
  return ACHIEVEMENTS.filter((item) => isAchievementEarned(item.id, stats)).map((item) => item.id);
}

export function isAchievementEarned(id, stats) {
  switch (id) {
    case "first-task":
      return stats.completed >= 1;
    case "ten-tasks":
      return stats.completed >= 10;
    case "fifty-tasks":
      return stats.completed >= 50;
    case "xp-100":
      return stats.xp >= 100;
    case "xp-500":
      return stats.xp >= 500;
    case "streak-3":
      return stats.bestStreak >= 3 || stats.streak >= 3;
    case "streak-7":
      return stats.bestStreak >= 7 || stats.streak >= 7;
    case "streak-14":
      return stats.bestStreak >= 14 || stats.streak >= 14;
    case "streak-30":
      return stats.bestStreak >= 30 || stats.streak >= 30;
    case "perfect-day":
      return stats.perfectDays >= 1;
    case "perfect-week":
      return stats.perfectWeeks >= 1;
    case "level-5":
      return stats.level.level >= 5;
    default:
      return false;
  }
}

export function habitStreaks(task, completions, today) {
  const todayDate = startOfDay(today);
  const earliest = task.startDate;
  let cursor = todayDate;
  const todayScheduled = isScheduled(task, cursor);
  const todayDone = isDone(completions, task.id, toISO(cursor));
  if (!todayScheduled || !todayDone) cursor = addDays(cursor, -1);

  let current = 0;
  for (let i = 0; i < 500; i++) {
    if (toISO(cursor) < earliest) break;
    if (!isScheduled(task, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!isDone(completions, task.id, toISO(cursor))) break;
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  const start = parseISO(earliest);
  const last = todayDate < start ? start : todayDate;
  for (const date of eachDay(start, last)) {
    if (!isScheduled(task, date)) continue;
    if (isDone(completions, task.id, toISO(date))) {
      run += 1;
      if (run > best) best = run;
    } else if (toISO(date) === toISO(todayDate)) {
      continue;
    } else {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current) };
}

export function habitSnapshot(task, completions, today, weekStartsOn = 1) {
  const todayDate = startOfDay(today);
  const streaks = habitStreaks(task, completions, todayDate);
  const week = weekDays(todayDate, weekStartsOn);
  const weekStart = week[0];
  const weekEndCap = todayDate < week[6] ? todayDate : week[6];
  const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const monthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
  const monthEndCap = todayDate < monthEnd ? todayDate : monthEnd;
  return {
    ...streaks,
    week: taskRangeProgress(task, completions, weekStart, weekEndCap),
    month: taskRangeProgress(task, completions, monthStart, monthEndCap),
    dots: week.map((date) => {
      const iso = toISO(date);
      const scheduled = isScheduled(task, date);
      return {
        iso,
        label: DOW_NARROW[date.getDay()],
        scheduled,
        done: scheduled && isDone(completions, task.id, iso),
        future: date.getTime() > todayDate.getTime(),
        today: iso === toISO(todayDate),
      };
    }),
  };
}

export function periodProgress(tasks, completions, start, end, today) {
  const todayDate = startOfDay(today);
  const startDate = startOfDay(start);
  const endDate = startOfDay(end);
  if (startDate.getTime() > todayDate.getTime()) {
    return { done: 0, total: 0, rate: 0, future: true };
  }
  const cap = endDate.getTime() > todayDate.getTime() ? todayDate : endDate;
  const progress = rangeProgress(tasks, completions, startDate, cap);
  return { ...progress, future: false, partial: endDate.getTime() > todayDate.getTime() };
}

export function activitySeries(tasks, completions, today, length) {
  const todayDate = startOfDay(today);
  const start = addDays(todayDate, -(length - 1));
  return eachDay(start, todayDate).map((date) => {
    const progress = dayProgress(tasks, completions, date);
    return {
      iso: toISO(date),
      date,
      ...progress,
      tick: length <= 7 ? DOW_SHORT[date.getDay()] : String(date.getDate()),
      isToday: toISO(date) === toISO(todayDate),
    };
  });
}

export function formatMonthYear(date) {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDayTitle(date) {
  return `${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`;
}

export function plural(n, one, few, many) {
  const abs = Math.abs(Number(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last > 1 && last < 5) return few;
  return many;
}

export function formatRange(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) return `${start.getDate()} – ${end.getDate()} ${MONTHS_SHORT[start.getMonth()]}`;
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
}

export function greeting(date, name) {
  const hour = date.getHours();
  const hello = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  return name ? `${hello}, ${name}` : hello;
}

export function percent(rate) {
  return `${Math.round((rate || 0) * 100)}%`;
}

export function uid() {
  return `t_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function dowOrder(weekStartsOn = 1) {
  const start = DOW_ORDER.indexOf(weekStartsOn);
  return [...DOW_ORDER.slice(start), ...DOW_ORDER.slice(0, start)];
}

function mix(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildSampleData(now = new Date()) {
  const today = startOfDay(now);
  const startISO = toISO(addDays(today, -21));
  const gapISO = toISO(addDays(today, -7));
  const todayISO = toISO(today);
  const perfectStart = addDays(startOfWeek(addDays(today, -7), 1), -7);
  const perfectEnd = addDays(perfectStart, 6);
  const perfectStartISO = toISO(perfectStart);
  const perfectEndISO = toISO(perfectEnd);

  const base = { startDate: startISO, endDate: null, createdAt: today.getTime() };
  const tasks = [
    { id: "reading", name: "Чтение", icon: "📖", category: "reading", color: "#DDD0EA", difficulty: "normal", repeat: "daily", days: [], isHabit: true },
    { id: "water", name: "Вода", icon: "💧", category: "health", color: "#DDEAF4", difficulty: "normal", repeat: "daily", days: [], isHabit: true },
    { id: "meditation", name: "Медитация", icon: "🧘", category: "health", color: "#D7EFE4", difficulty: "normal", repeat: "daily", days: [], isHabit: true },
    { id: "sleep", name: "Сон", icon: "🌙", category: "health", color: "#C9D4EA", difficulty: "normal", repeat: "daily", days: [], isHabit: true },
    { id: "journal", name: "Дневник", icon: "✍️", category: "personal", color: "#F6E3C5", difficulty: "normal", repeat: "daily", days: [], isHabit: true },
    { id: "meals", name: "Еда", icon: "🥗", category: "health", color: "#F3C7BE", difficulty: "normal", repeat: "daily", days: [], isHabit: true },
    { id: "study", name: "Учёба", icon: "📚", category: "study", color: "#E9B7BD", difficulty: "hard", repeat: "weekdays", days: [], isHabit: true },
    { id: "coding", name: "Код", icon: "💻", category: "work", color: "#BFD4E8", difficulty: "hard", repeat: "weekdays", days: [], isHabit: true },
    { id: "workout", name: "Тренировка", icon: "🏃", category: "sport", color: "#F4D6D9", difficulty: "hard", repeat: "custom", days: [1, 3, 5, 6], isHabit: true },
    { id: "creative", name: "Творчество", icon: "🎨", category: "creative", color: "#E9B7BD", difficulty: "normal", repeat: "custom", days: [2, 4, 0], isHabit: false },
    { id: "plan", name: "План дня", icon: "📝", category: "personal", color: "#BFD4E8", difficulty: "normal", repeat: "weekdays", days: [], isHabit: false },
  ].map((task) => ({ ...base, ...task }));

  const completions = {};
  for (const date of eachDay(parseISO(startISO), today)) {
    const iso = toISO(date);
    if (iso === gapISO) continue;
    const scheduled = tasksOnDate(tasks, date);
    if (iso >= perfectStartISO && iso <= perfectEndISO) {
      scheduled.forEach((task) => {
        completions[completionKey(task.id, iso)] = true;
      });
      continue;
    }
    if (iso === todayISO) {
      const open = Math.min(2, Math.max(0, scheduled.length - 1));
      scheduled.forEach((task, index) => {
        if (index < scheduled.length - open) completions[completionKey(task.id, iso)] = true;
      });
      continue;
    }
    scheduled.forEach((task, index) => {
      if (index === 0 || mix(task.id + iso) % 5 !== 0) {
        completions[completionKey(task.id, iso)] = true;
      }
    });
  }

  return { tasks, completions };
}

export function sanitizeTask(input, fallbackId) {
  if (!input || typeof input !== "object") return null;
  const name = String(input.name || "").replace(/[<>]/g, "").trim().slice(0, 40);
  if (!name) return null;
  const category = CATEGORIES.some((item) => item.id === input.category) ? input.category : "personal";
  const icon = ICON_CHOICES.includes(input.icon) ? input.icon : "⭐";
  const color = COLOR_SWATCHES.includes(input.color) ? input.color : COLOR_SWATCHES[0];
  const repeat = ["daily", "weekdays", "weekends", "custom", "once"].includes(input.repeat) ? input.repeat : "daily";
  const days = Array.isArray(input.days)
    ? [...new Set(input.days.map(Number).filter((day) => day >= 0 && day <= 6))]
    : [];
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate || "") ? input.startDate : toISO(new Date());
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(input.endDate || "") ? input.endDate : null;
  return {
    id: typeof input.id === "string" && input.id && !input.id.includes("|") ? input.id.slice(0, 40) : fallbackId,
    name,
    icon,
    category,
    color,
    difficulty: input.difficulty === "hard" ? "hard" : "normal",
    repeat,
    days: repeat === "custom" ? days : [],
    startDate,
    endDate: endDate && endDate < startDate ? startDate : endDate,
    isHabit: !!input.isHabit,
    createdAt: Number(input.createdAt) || Date.now(),
  };
}
