import { ACHIEVEMENTS } from "./logic.js";
import {
  addDays,
  addMonths,
  buildSampleData,
  completionKey,
  computeStats,
  dayProgress,
  isScheduled,
  parseISO,
  sanitizeTask,
  startOfDay,
  taskXp,
  toISO,
  uid,
  XP_PERFECT_DAY,
} from "./logic.js";
import { esc } from "./components.js";
import { renderApp } from "./pages.js";
import { createSampleState, data, saveState, syncUnlocked } from "./store.js";

const PAGES = ["dashboard", "tasks", "habits", "calendar", "statistics", "achievements", "settings"];
const TITLES = {
  dashboard: "Главная",
  tasks: "Задачи",
  habits: "Привычки",
  calendar: "Календарь",
  statistics: "Статистика",
  achievements: "Достижения",
  settings: "Настройки",
};

const ui = {
  page: "dashboard",
  cursor: toISO(new Date()),
  tableMode: "week",
  calMode: "month",
  day: null,
  modal: null,
  confirm: null,
  filter: "all",
  range: 7,
};

let queuedFx = { key: null, streak: false };
let lastPage = null;
const app = document.getElementById("app");

function pageFromHash() {
  const page = location.hash.replace(/^#\/?/, "");
  return PAGES.includes(page) ? page : "dashboard";
}

function today() {
  return startOfDay(new Date());
}

function persist() {
  if (!saveState()) pushToast("Не удалось сохранить", "warn");
}

function pushToast(html, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 280);
  }, 2300);
}

function showXPNotification(amount, perfect = false) {
  if (perfect) {
    pushToast(`<span>💯</span><span class="toast-copy"><b>Идеальный день!</b><small>+${amount} XP</small></span>`, "perfect");
    return;
  }
  pushToast(`<span>⭐</span><b>+${amount} XP</b>`, "xp");
}

function render() {
  const mainEl = document.querySelector(".main");
  const scroller = document.querySelector(".table-scroll");
  const scrollY = mainEl ? mainEl.scrollTop : 0;
  const scrollX = scroller ? scroller.scrollLeft : 0;
  const samePage = lastPage === ui.page;
  const fx = { key: queuedFx.key, streak: queuedFx.streak, enter: lastPage !== null && !samePage };
  queuedFx = { key: null, streak: false };
  lastPage = ui.page;
  const now = today();
  const ctx = {
    tasks: data.tasks,
    completions: data.completions,
    settings: data.settings,
    unlocked: data.unlocked,
    ui,
    stats: computeStats(data.tasks, data.completions, now, data.settings.weekStartsOn),
    today: now,
    cursorDate: parseISO(ui.cursor),
    fx,
    parse: parseISO,
  };
  app.innerHTML = renderApp(ctx);
  document.body.dataset.page = ui.page;
  document.title = `${TITLES[ui.page] || "Трекер"} · ТРЕКЕР ЖИЗНИ`;
  if (samePage) {
    requestAnimationFrame(() => {
      const nextMain = document.querySelector(".main");
      const nextScroll = document.querySelector(".table-scroll");
      if (nextMain) nextMain.scrollTop = scrollY;
      if (nextScroll) nextScroll.scrollLeft = scrollX;
    });
  }
  if (ui.modal) {
    requestAnimationFrame(() => document.querySelector('.modal [name="name"]')?.focus());
  }
}

function go(page) {
  ui.day = null;
  ui.modal = null;
  ui.confirm = null;
  const hash = `#/${page}`;
  if (location.hash === hash) {
    ui.page = page;
    render();
    return;
  }
  location.hash = hash;
}

function openDay(iso) {
  if (ui.page === "calendar") {
    ui.calMode = "day";
    ui.cursor = iso;
    ui.day = null;
  } else {
    ui.day = iso;
  }
  render();
}

function toggleCompletion(id, iso) {
  const task = data.tasks.find((item) => item.id === id);
  if (!task) return;
  const now = today();
  const date = parseISO(iso);
  if (date > now || !isScheduled(task, date)) return;
  const key = completionKey(id, iso);
  const wasDone = !!data.completions[key];
  const beforeDay = dayProgress(data.tasks, data.completions, date);
  const before = computeStats(data.tasks, data.completions, now, data.settings.weekStartsOn);
  if (wasDone) delete data.completions[key];
  else data.completions[key] = true;
  const afterDay = dayProgress(data.tasks, data.completions, date);
  const after = computeStats(data.tasks, data.completions, now, data.settings.weekStartsOn);
  const fresh = syncUnlocked(now);
  queuedFx = { key, streak: after.streak > before.streak };
  persist();
  render();
  if (!wasDone) {
    showXPNotification(taskXp(task));
    if (!beforeDay.perfect && afterDay.perfect) {
      setTimeout(() => showXPNotification(XP_PERFECT_DAY, true), 180);
    }
    if (after.level.level > before.level.level) {
      setTimeout(() => pushToast(`<span>🏆</span><b>Уровень ${after.level.level} · ${esc(after.level.name)}</b>`, "perfect"), 360);
    }
  }
  fresh.forEach((achievementId, index) => {
    const item = ACHIEVEMENTS.find((achievement) => achievement.id === achievementId);
    if (!item) return;
    setTimeout(() => {
      pushToast(`<span>${item.icon}</span><span class="toast-copy"><small>Достижение</small><b>${esc(item.title)}</b></span>`, "award");
    }, 480 + index * 380);
  });
}

function saveTask(form) {
  const fd = new FormData(form);
  const error = form.querySelector(".form-error");
  const name = String(fd.get("name") || "").trim();
  if (!name) {
    error.textContent = "Назови задачу.";
    form.elements.name.focus();
    return;
  }
  const repeat = String(fd.get("repeat") || "daily");
  const days = fd.getAll("days").map(Number);
  if (repeat === "custom" && !days.length) {
    error.textContent = "Выбери хотя бы один день.";
    return;
  }
  const startDate = String(fd.get("startDate") || "");
  const endDate = String(fd.get("endDate") || "");
  if (endDate && startDate && endDate < startDate) {
    error.textContent = "Дата окончания раньше начала.";
    return;
  }
  const draft = sanitizeTask({
    id: fd.get("id") || undefined,
    name,
    icon: fd.get("icon"),
    category: fd.get("category"),
    color: fd.get("color"),
    difficulty: fd.get("difficulty"),
    repeat,
    days,
    startDate,
    endDate: endDate || null,
    isHabit: fd.get("habit") === "on",
    createdAt: Number(fd.get("createdAt")) || Date.now(),
  }, uid());
  if (!draft) return;
  const index = data.tasks.findIndex((task) => task.id === draft.id);
  if (index >= 0) data.tasks[index] = draft;
  else data.tasks.push(draft);
  ui.modal = null;
  persist();
  render();
  pushToast(index >= 0 ? "Задача обновлена" : "Задача добавлена", "ok");
}

function removeTask(id) {
  data.tasks = data.tasks.filter((task) => task.id !== id);
  for (const key of Object.keys(data.completions)) {
    if (key.startsWith(`${id}|`)) delete data.completions[key];
  }
  ui.modal = null;
  ui.confirm = null;
  syncUnlocked(today());
  persist();
  render();
  pushToast("Задача удалена", "ok");
}

function restoreSample() {
  const sample = buildSampleData(new Date());
  data.tasks = sample.tasks;
  data.completions = sample.completions;
  data.unlocked = [];
  syncUnlocked(today());
  ui.confirm = null;
  persist();
  render();
  pushToast("Пример загружен", "ok");
}

function eraseAll() {
  data.tasks = [];
  data.completions = {};
  data.unlocked = [];
  ui.confirm = null;
  ui.modal = null;
  persist();
  render();
  pushToast("Планер очищен", "ok");
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "my-life-tracker.json";
  link.click();
  URL.revokeObjectURL(url);
  pushToast("Копия скачана", "ok");
}

function applyImport(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.tasks)) {
    pushToast("Это не файл трекера", "warn");
    return;
  }
  const tasks = raw.tasks.map((task) => sanitizeTask(task)).filter(Boolean).slice(0, 80);
  const known = new Set(tasks.map((task) => task.id));
  const completions = {};
  if (raw.completions && typeof raw.completions === "object") {
    for (const [key, value] of Object.entries(raw.completions)) {
      if (value && known.has(String(key).split("|")[0])) completions[key] = true;
    }
  }
  data.tasks = tasks;
  data.completions = completions;
  if (raw.settings && typeof raw.settings === "object") {
    if (typeof raw.settings.name === "string") data.settings.name = raw.settings.name.slice(0, 40);
    if (raw.settings.weekStartsOn === 0 || raw.settings.weekStartsOn === 1) {
      data.settings.weekStartsOn = raw.settings.weekStartsOn;
    }
  }
  data.unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.filter((id) => typeof id === "string") : [];
  syncUnlocked(today());
  persist();
  render();
  pushToast("Копия восстановлена", "ok");
}

function onClick(event) {
  if (event.target.classList?.contains("overlay")) {
    ui.modal = null;
    ui.confirm = null;
    render();
    return;
  }
  if (event.target.classList?.contains("drawer-back")) {
    ui.day = null;
    render();
    return;
  }
  const btn = event.target.closest("[data-action]");
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  if (action === "nav") {
    go(btn.dataset.page);
    return;
  }
  if (action === "shift-month") {
    ui.cursor = toISO(addMonths(parseISO(ui.cursor), Number(btn.dataset.dir)));
    render();
    return;
  }
  if (action === "shift-week") {
    ui.cursor = toISO(addDays(parseISO(ui.cursor), 7 * Number(btn.dataset.dir)));
    render();
    return;
  }
  if (action === "shift-day") {
    ui.cursor = toISO(addDays(parseISO(ui.cursor), Number(btn.dataset.dir)));
    render();
    return;
  }
  if (action === "go-today") {
    ui.cursor = toISO(today());
    if (ui.day) ui.day = ui.cursor;
    render();
    return;
  }
  if (action === "set-table-mode") {
    ui.tableMode = btn.dataset.mode === "month" ? "month" : "week";
    render();
    return;
  }
  if (action === "set-cal-mode") {
    ui.calMode = ["week", "day"].includes(btn.dataset.mode) ? btn.dataset.mode : "month";
    render();
    return;
  }
  if (action === "set-filter") {
    ui.filter = btn.dataset.filter || "all";
    render();
    return;
  }
  if (action === "set-range") {
    ui.range = btn.dataset.range === "30" ? 30 : 7;
    render();
    return;
  }
  if (action === "set-week-start") {
    data.settings.weekStartsOn = btn.dataset.start === "0" ? 0 : 1;
    persist();
    render();
    return;
  }
  if (action === "open-day") {
    openDay(btn.dataset.date);
    return;
  }
  if (action === "shift-open-day") {
    if (ui.page === "calendar") ui.cursor = btn.dataset.date;
    else ui.day = btn.dataset.date;
    render();
    return;
  }
  if (action === "close-day") {
    ui.day = null;
    render();
    return;
  }
  if (action === "toggle") {
    toggleCompletion(btn.dataset.id, btn.dataset.date);
    return;
  }
  if (action === "open-add") {
    ui.modal = {
      mode: "add",
      isHabit: btn.dataset.habit === "1",
      presetDate: btn.dataset.date || null,
    };
    render();
    return;
  }
  if (action === "open-edit") {
    ui.modal = { mode: "edit", id: btn.dataset.id };
    render();
    return;
  }
  if (action === "close-modal") {
    ui.modal = null;
    render();
    return;
  }
  if (action === "close-confirm") {
    ui.confirm = null;
    render();
    return;
  }
  if (action === "delete-ask") {
    const task = data.tasks.find((item) => item.id === btn.dataset.id);
    if (!task) return;
    ui.confirm = { kind: "delete", id: task.id, name: task.name };
    render();
    return;
  }
  if (action === "confirm-delete") {
    removeTask(btn.dataset.id);
    return;
  }
  if (action === "erase-ask") {
    ui.confirm = { kind: "erase" };
    render();
    return;
  }
  if (action === "confirm-erase") {
    eraseAll();
    return;
  }
  if (action === "restore-sample") {
    if (!data.tasks.length) restoreSample();
    else {
      ui.confirm = { kind: "restore" };
      render();
    }
    return;
  }
  if (action === "confirm-restore") {
    restoreSample();
    return;
  }
  if (action === "export-data") exportData();
}

function onChange(event) {
  const target = event.target;
  if (target.name === "repeat" && target.form) {
    const box = target.form.querySelector(".custom-days");
    if (box) box.hidden = target.value !== "custom";
  }
  if (target.name === "icon" && target.form) target.form.dataset.iconTouched = "1";
  if (target.name === "category" && target.form && target.form.dataset.iconTouched !== "1") {
    const icon = {
      study: "📚",
      work: "💻",
      sport: "🏃",
      health: "💧",
      reading: "📖",
      creative: "🎨",
      personal: "⭐",
    }[target.value];
    const radios = target.form.elements.icon;
    const list = radios?.length ? [...radios] : radios ? [radios] : [];
    const match = list.find((radio) => radio.value === icon);
    if (match) match.checked = true;
  }
  if (target.id === "import-file" && target.files?.[0]) {
    const file = target.files[0];
    target.value = "";
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyImport(JSON.parse(String(reader.result)));
      } catch {
        pushToast("Не удалось прочитать файл", "warn");
      }
    };
    reader.readAsText(file);
  }
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.dataset.form === "task") {
    event.preventDefault();
    saveTask(form);
  }
  if (form.dataset.form === "settings") {
    event.preventDefault();
    data.settings.name = String(form.elements.name.value || "").trim().slice(0, 40);
    persist();
    render();
    pushToast("Имя сохранено", "ok");
  }
}

function boot() {
  ui.page = pageFromHash();
  if (!location.hash) history.replaceState(null, "", "#/dashboard");
  if (!data.tasks.length && !localStorage.getItem("mylife-tracker-v2")) {
    const sample = createSampleState();
    data.tasks = sample.tasks;
    data.completions = sample.completions;
  }
  syncUnlocked(today());
  saveState();
  render();
  app.addEventListener("click", onClick);
  app.addEventListener("change", onChange);
  app.addEventListener("submit", onSubmit);
  window.addEventListener("hashchange", () => {
    ui.page = pageFromHash();
    ui.day = null;
    ui.modal = null;
    ui.confirm = null;
    render();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!ui.modal && !ui.confirm && !ui.day) return;
    ui.modal = null;
    ui.confirm = null;
    ui.day = null;
    render();
  });
}

boot();
