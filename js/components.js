import { icon, CHECK_ICON } from "./icons.js";
import {
  ACHIEVEMENTS,
  CATEGORIES,
  COLOR_SWATCHES,
  DOW,
  DOW_NARROW,
  DOW_SHORT,
  ICON_CHOICES,
  MONTHS_SHORT,
  addDays,
  dayProgress,
  dowOrder,
  eachDay,
  formatDayTitle,
  formatMonthYear,
  formatRange,
  greeting,
  plural,
  habitSnapshot,
  isDone,
  isScheduled,
  monthWeeks,
  percent,
  periodProgress,
  startOfWeek,
  taskRangeProgress,
  tasksOnDate,
  toISO,
  weekIndexInMonth,
} from "./logic.js";

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const NAV = [
  ["dashboard", "Главная", "grid"],
  ["tasks", "Задачи", "tasks"],
  ["habits", "Привычки", "habits"],
  ["calendar", "Календарь", "calendar"],
  ["statistics", "Статистика", "chart"],
  ["achievements", "Достижения", "trophy"],
  ["settings", "Настройки", "settings"],
];

const TABS = [
  ["dashboard", "Главная", "grid"],
  ["tasks", "Задачи", "tasks"],
  ["habits", "Привычки", "habits"],
  ["calendar", "План", "calendar"],
  ["statistics", "Статы", "chart"],
  ["achievements", "Награды", "trophy"],
  ["settings", "Настр.", "settings"],
];

export function renderSidebar(ctx) {
  const { stats, ui } = ctx;
  return `
    <aside class="sidebar">
      <button type="button" class="brand" data-action="nav" data-page="dashboard">
        <span class="mark" aria-hidden="true">${icon("tasks", 16)}</span>
        <span class="brand-name">ТРЕКЕР<br />ЖИЗНИ</span>
      </button>
      <nav class="side-nav" aria-label="Основное">
        ${NAV.map(([id, label, glyph]) => `
          <button type="button" class="nav-btn ${ui.page === id ? "on" : ""}" data-action="nav" data-page="${id}">
            ${icon(glyph, 18)}
            <span>${label}</span>
          </button>
        `).join("")}
      </nav>
      <div class="side-foot">
        ${renderStreakCard(stats.streak, stats.bestStreak, true)}
        <button type="button" class="side-stat" data-action="nav" data-page="statistics">
          <span aria-hidden="true">⭐</span>
          <span><strong>${stats.xp.toLocaleString("ru-RU")}</strong><small>Всего XP</small></span>
        </button>
      </div>
    </aside>
  `;
}

export function renderBottomNav(ctx) {
  return `
    <nav class="tabbar" aria-label="Основное">
      ${TABS.map(([id, label, glyph]) => `
        <button type="button" class="tab ${ctx.ui.page === id ? "on" : ""}" data-action="nav" data-page="${id}">
          ${icon(glyph, 18)}
          <small>${label}</small>
        </button>
      `).join("")}
    </nav>
  `;
}

const PAGE_COPY = {
  tasks: ["Задачи", "Добавляй, меняй и отмечай то, что запланировано на сегодня."],
  habits: ["Привычки", "Серии и прогресс по делам, которые повторяются."],
  calendar: ["Календарь", "Месяц, неделя и день в одном планере."],
  statistics: ["Статистика", "Серии, XP и активность за последние дни."],
  achievements: ["Достижения", "Значки остаются, как только ты их получаешь."],
  settings: ["Настройки", "Имя, начало недели и данные на этом устройстве."],
};

export function renderTopbar(ctx, { showMonth = false } = {}) {
  const cursor = ctx.cursorDate;
  const level = ctx.stats.level;
  const pills = `
    <div class="pills">
      <button type="button" class="pill ${ctx.fx.streak ? "bump" : ""}" data-action="nav" data-page="statistics">
        <span aria-hidden="true">🔥</span>
        <span><strong>${ctx.stats.streak}</strong> ${plural(ctx.stats.streak, "день", "дня", "дней")} подряд</span>
      </button>
      <button type="button" class="pill" data-action="nav" data-page="statistics">
        <span aria-hidden="true">⭐</span>
        <span><strong>${ctx.stats.xp.toLocaleString("ru-RU")}</strong> XP</span>
      </button>
      <button type="button" class="pill pill-level" data-action="nav" data-page="statistics">
        <span aria-hidden="true">🏆</span>
        <span class="pill-level-copy">
          <span><strong>Уровень ${level.level}</strong> · ${esc(level.name)}</span>
          <span class="mini-bar" aria-hidden="true"><i style="width:${Math.round(level.progress * 100)}%"></i></span>
        </span>
      </button>
    </div>
  `;

  if (showMonth) {
    return `
      <header class="topbar">
        <div class="topbar-copy">
          <p class="brand-kicker">ТРЕКЕР ЖИЗНИ</p>
          <p class="tagline">Преврати обычную жизнь в игру.</p>
          <div class="month-switch">
            <button type="button" class="icon-btn" data-action="shift-month" data-dir="-1" aria-label="Предыдущий месяц">${icon("left", 18)}</button>
            <h1>${esc(formatMonthYear(cursor))}</h1>
            <button type="button" class="icon-btn" data-action="shift-month" data-dir="1" aria-label="Следующий месяц">${icon("right", 18)}</button>
            <button type="button" class="text-btn" data-action="go-today">Сегодня</button>
          </div>
          <p class="hello">${esc(greeting(new Date(), ctx.settings.name))}</p>
        </div>
        ${pills}
      </header>
    `;
  }

  const [title, line] = PAGE_COPY[ctx.ui.page] || ["Трекер", ""];
  return `
    <header class="topbar">
      <div class="topbar-copy">
        <p class="brand-kicker">ТРЕКЕР ЖИЗНИ</p>
        <h1>${esc(title)}</h1>
        <p class="hello">${esc(line)}</p>
      </div>
      ${pills}
    </header>
  `;
}

export function renderProgressBar(rate, tone = "pink") {
  const width = Math.max(0, Math.min(100, Math.round((rate || 0) * 100)));
  return `<div class="bar ${tone}" role="meter" aria-valuenow="${width}" aria-valuemin="0" aria-valuemax="100" aria-label="${width} процентов"><span style="width:${width}%"></span></div>`;
}

export function renderProgressCard({ kicker, title, rate, caption, tone = "pink" }) {
  return `
    <article class="progress-card">
      <div class="progress-top">
        <div>
          <p class="kicker">${esc(kicker)}</p>
          <h3>${esc(title)}</h3>
        </div>
        <strong>${percent(rate)}</strong>
      </div>
      ${renderProgressBar(rate, tone)}
      <p class="progress-cap">${esc(caption)}</p>
    </article>
  `;
}

export function renderStatsCard({ glyph, label, value, hint }) {
  return `
    <article class="stat-card">
      <span class="stat-icon" aria-hidden="true">${glyph}</span>
      <p class="stat-label">${esc(label)}</p>
      <p class="stat-value">${esc(value)}</p>
      ${hint ? `<p class="stat-hint">${esc(hint)}</p>` : ""}
    </article>
  `;
}

export function renderStreakCard(streak, best, compact = false) {
  if (compact) {
    return `
      <button type="button" class="side-stat" data-action="nav" data-page="statistics">
        <span aria-hidden="true">🔥</span>
        <span><strong>${streak}</strong><small>Серия</small></span>
      </button>
    `;
  }
  return `
    <article class="streak-feature">
      <div>
        <p class="stat-label">Текущая серия</p>
        <p class="streak-num">${streak}<small>${plural(streak, "день", "дня", "дней")}</small></p>
      </div>
      <div class="streak-best">
        <span>Рекорд</span>
        <strong>${best}</strong>
      </div>
    </article>
  `;
}

export function renderAchievementCard(item, unlocked) {
  return `
    <article class="ach-card ${unlocked ? "is-open" : "is-locked"}">
      <span class="ach-icon" aria-hidden="true">${item.icon}</span>
      <div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.description)}</p>
        <span class="ach-state">${unlocked ? "Открыто" : "Закрыто"}</span>
      </div>
    </article>
  `;
}

export function renderHabitCard(task, completions, today, weekStartsOn) {
  const snap = habitSnapshot(task, completions, today, weekStartsOn);
  return `
    <article class="habit-card">
      <header class="habit-head">
        <span class="task-ico" style="background:${esc(task.color)}55">${task.icon}</span>
        <div>
          <h3>${esc(task.name)}</h3>
          <p>${esc(CATEGORIES.find((item) => item.id === task.category)?.label || "Привычка")}</p>
        </div>
        <div class="icon-actions">
          <button type="button" class="icon-btn tiny" data-action="open-edit" data-id="${esc(task.id)}" aria-label="Изменить ${esc(task.name)}">${icon("pencil", 15)}</button>
          <button type="button" class="icon-btn tiny" data-action="delete-ask" data-id="${esc(task.id)}" aria-label="Удалить ${esc(task.name)}">${icon("trash", 15)}</button>
        </div>
      </header>
      <div class="habit-streaks">
        <p><strong>${snap.current}</strong><span>Серия</span></p>
        <p><strong>${snap.best}</strong><span>Рекорд</span></p>
      </div>
      <div class="dots" aria-label="Эта неделя">
        ${snap.dots.map((dot) => `
          <span class="dot-col">
            <i class="dot ${dot.done ? "on" : ""} ${dot.future ? "fut" : ""} ${!dot.scheduled ? "na" : ""} ${dot.scheduled && !dot.done && !dot.future ? "miss" : ""}"></i>
            <small>${dot.label}</small>
          </span>
        `).join("")}
      </div>
      <div class="habit-bars">
        <div>
          <span>Неделя ${snap.week.total ? percent(snap.week.rate) : "—"}</span>
          ${renderProgressBar(snap.week.rate, "blue")}
        </div>
        <div>
          <span>Месяц ${snap.month.total ? percent(snap.month.rate) : "—"}</span>
          ${renderProgressBar(snap.month.rate, "pink")}
        </div>
      </div>
    </article>
  `;
}

function renderTaskCell(task, date, ctx) {
  const iso = toISO(date);
  const todayISO = toISO(ctx.today);
  const future = iso > todayISO;
  const todayClass = iso === todayISO ? "is-today" : "";
  if (!isScheduled(task, date)) {
    return `<td class="tick is-na ${todayClass}"><span class="na-box" title="Не запланировано"></span></td>`;
  }
  const done = isDone(ctx.completions, task.id, iso);
  const pop = ctx.fx.key === `${task.id}|${iso}`;
  return `
    <td class="tick ${todayClass} ${done ? "is-done" : ""} ${future ? "is-future" : ""} ${pop ? "is-pop" : ""}">
      <button type="button" class="check ${done ? "on" : ""}" data-action="toggle" data-id="${esc(task.id)}" data-date="${iso}" ${future ? "disabled" : ""} aria-pressed="${done ? "true" : "false"}" aria-label="${esc(task.name)}, ${esc(formatDayTitle(date))}${done ? ", выполнено" : ""}">
        <span class="box">${done ? CHECK_ICON : ""}</span>
      </button>
    </td>
  `;
}

export function renderTaskRow(task, dates, ctx) {
  return `
    <tr class="task-row">
      <td class="sticky">
        <div class="task-name">
          <span class="task-ico" style="background:${esc(task.color)}66">${task.icon}</span>
          <span class="task-label">${esc(task.name)}</span>
        </div>
      </td>
      ${dates.map((date) => renderTaskCell(task, date, ctx)).join("")}
    </tr>
  `;
}

function summaryValue(date, tasks, completions, today, kind) {
  if (toISO(date) > toISO(today)) return "—";
  const progress = dayProgress(tasks, completions, date);
  if (!progress.total) return "—";
  if (kind === "done") return String(progress.done);
  if (kind === "left") return String(progress.left);
  return `${Math.round(progress.rate * 100)}%`;
}

function renderSummary(dates, tasks, completions, today) {
  const row = (kind, label, className) => `
    <tr class="summary ${className}">
      <td class="sticky"><div class="sum-label">${label}</div></td>
      ${dates.map((date) => `<td class="${toISO(date) === toISO(today) ? "is-today" : ""}">${summaryValue(date, tasks, completions, today, kind)}</td>`).join("")}
    </tr>
  `;
  return `
    ${row("done", "ГОТОВО", "row-done")}
    ${row("left", "ОСТАЛОСЬ", "row-left")}
    ${row("pct", "ПРОГРЕСС", "row-pct")}
  `;
}

function renderDayHead(date, today) {
  const iso = toISO(date);
  const isToday = iso === toISO(today);
  return `
    <th class="day-col ${isToday ? "is-today" : ""}">
      <button type="button" class="day-head" data-action="open-day" data-date="${iso}" aria-label="Открыть ${esc(formatDayTitle(date))}">
        <span class="dow">${DOW_SHORT[date.getDay()]}</span>
        <span class="day-num ${isToday ? "today" : ""}">${date.getDate()}</span>
      </button>
    </th>
  `;
}

export function renderTaskTable(ctx, dates, { mode = "week", weeks = [], weekLabel = "" } = {}) {
  if (!ctx.tasks.length) return "";
  const visible = ctx.tasks.filter((task) => dates.some((date) => isScheduled(task, date)));
  if (!visible.length) {
    return `<div class="table-empty"><p>В этом виде ничего не запланировано.</p><button type="button" class="btn" data-action="open-add">Добавить задачу</button></div>`;
  }

  const head = mode === "month"
    ? `
      <tr>
        <th class="sticky task-head" rowspan="2"><div class="week-mark"><strong>ЗАДАЧИ</strong><small>${esc(formatMonthYear(ctx.cursorDate))}</small></div></th>
        ${weeks.map((week) => `<th class="week-group" colspan="${week.days.length}">Неделя ${week.index}</th>`).join("")}
      </tr>
      <tr>${dates.map((date) => renderDayHead(date, ctx.today)).join("")}</tr>
    `
    : `
      <tr>
        <th class="sticky task-head"><div class="week-mark"><strong>${esc(weekLabel)}</strong><small>${esc(formatRange(dates[0], dates[dates.length - 1]))}</small></div></th>
        ${dates.map((date) => renderDayHead(date, ctx.today)).join("")}
      </tr>
    `;

  return `
    <div class="table-scroll">
      <table class="planner-table ${mode}">
        <thead>${head}</thead>
        <tbody>
          ${visible.map((task) => renderTaskRow(task, dates, ctx)).join("")}
          ${renderSummary(dates, visible, ctx.completions, ctx.today)}
        </tbody>
      </table>
    </div>
  `;
}

export function renderMonthProgress(ctx) {
  const cursor = ctx.cursorDate;
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const today = ctx.today;
  const rows = ctx.tasks.map((task) => {
    const full = taskRangeProgress(task, ctx.completions, start, end);
    if (!full.total) return null;
    const soFar = start > today ? { done: 0, total: 0, rate: 0 } : taskRangeProgress(task, ctx.completions, start, today < end ? today : end);
    return { task, soFar };
  }).filter(Boolean);

  const done = rows.reduce((sum, row) => sum + row.soFar.done, 0);
  const total = rows.reduce((sum, row) => sum + row.soFar.total, 0);

  return `
    <aside class="month-side ${ctx.ui.tableMode === "month" ? "wide" : ""}">
      <header class="side-head">
        <p>ПРОГРЕСС<br>ЗА МЕСЯЦ</p>
        <strong>${total ? `${done} / ${total}` : "—"}</strong>
      </header>
      <div class="bars">
        ${rows.length ? rows.map(({ task, soFar }) => `
          <div class="m-row">
            <div class="m-name"><span>${task.icon}</span> ${esc(task.name)}</div>
            <div class="m-line">
              ${renderProgressBar(soFar.total ? soFar.rate : 0)}
              <b>${soFar.total ? percent(soFar.rate) : "—"}</b>
            </div>
          </div>
        `).join("") : `<p class="muted">В этом месяце задач нет.</p>`}
      </div>
    </aside>
  `;
}

export function renderCalendar(ctx) {
  const cursor = ctx.cursorDate;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const gridStart = startOfWeek(first, ctx.settings.weekStartsOn);
  const gridEnd = addDays(startOfWeek(last, ctx.settings.weekStartsOn), 6);
  const days = eachDay(gridStart, gridEnd);
  const headers = dowOrder(ctx.settings.weekStartsOn).map((dow) => DOW_SHORT[dow]);
  const streak = new Set(ctx.stats.streakDays);
  const todayISO = toISO(ctx.today);

  const cells = days.map((date) => {
    const iso = toISO(date);
    const inMonth = date.getMonth() === month;
    const future = iso > todayISO;
    const progress = dayProgress(ctx.tasks, ctx.completions, date);
    const heat = inMonth && !future && progress.total ? progress.rate : 0;
    const missed = inMonth && !future && progress.total > 0 && progress.done === 0;
    const classes = [
      "cal-day",
      inMonth ? "" : "out",
      iso === todayISO ? "is-today" : "",
      future ? "future" : "",
      missed ? "missed" : "",
      progress.perfect && inMonth ? "perfect" : "",
    ].filter(Boolean).join(" ");
    return `
      <button type="button" class="${classes}" style="--heat:${heat.toFixed(3)}" data-action="open-day" data-date="${iso}">
        <span class="cal-num">${date.getDate()}</span>
        ${inMonth && progress.total && !future ? `<span class="cal-frac">${progress.done}/${progress.total}</span><span class="cal-pct">${Math.round(progress.rate * 100)}%</span>` : ""}
        ${streak.has(iso) && inMonth ? `<span class="cal-flame" aria-hidden="true">🔥</span>` : ""}
      </button>
    `;
  }).join("");

  return `
    <div class="calendar">
      <div class="cal-head">${headers.map((label) => `<span>${label}</span>`).join("")}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">
        <span><i class="swatch low"></i> Спокойный день</span>
        <span><i class="swatch high"></i> Сильный день</span>
        <span>🔥 Серия</span>
      </div>
    </div>
  `;
}

export function renderDayPanel(iso, ctx) {
  const date = ctx.parse(iso);
  const todayISO = toISO(ctx.today);
  const isToday = iso === todayISO;
  const future = iso > todayISO;
  const list = tasksOnDate(ctx.tasks, date);
  const progress = dayProgress(ctx.tasks, ctx.completions, date);
  const prev = toISO(addDays(date, -1));
  const next = toISO(addDays(date, 1));
  const perfect = progress.perfect && !future;

  const items = list.length
    ? list.map((task) => {
      const done = isDone(ctx.completions, task.id, iso);
      const pop = ctx.fx.key === `${task.id}|${iso}`;
      return `
        <button type="button" class="day-item ${done ? "done" : ""} ${pop ? "is-pop" : ""}" data-action="toggle" data-id="${esc(task.id)}" data-date="${iso}" ${future ? "disabled" : ""}>
          <span class="box">${done ? CHECK_ICON : ""}</span>
          <span class="task-ico" style="background:${esc(task.color)}66">${task.icon}</span>
          <span class="day-item-name">${esc(task.name)}</span>
          <span class="xp-tag">${task.difficulty === "hard" ? "+20" : "+10"}</span>
        </button>
      `;
    }).join("")
    : `<div class="table-empty compact"><p>Ничего не запланировано.</p></div>`;

  return `
    <div class="day-panel">
      <div class="day-nav">
        <button type="button" class="icon-btn" data-action="shift-open-day" data-date="${prev}" aria-label="Предыдущий день">${icon("left", 18)}</button>
        <button type="button" class="icon-btn" data-action="shift-open-day" data-date="${next}" aria-label="Следующий день">${icon("right", 18)}</button>
      </div>
      <p class="kicker">${isToday ? "Сегодня" : DOW[date.getDay()]}</p>
      <h2>${esc(formatDayTitle(date))}</h2>
      <p class="day-sub">${future ? "Этот день можно отметить, когда он наступит." : isToday ? "Задачи на сегодня" : "Задачи"}</p>
      ${perfect ? `<div class="perfect-banner">Идеальный день!</div>` : ""}
      <div class="day-list">${items}</div>
      <footer class="day-foot">
        <div class="progress-top">
          <strong>${progress.total ? `${progress.done} / ${progress.total} выполнено` : "Нет задач"}</strong>
          <span>${progress.total ? percent(progress.rate) : ""}</span>
        </div>
        ${progress.total ? renderProgressBar(progress.rate, perfect ? "blue" : "pink") : ""}
        <button type="button" class="btn ghost" data-action="open-add" data-date="${iso}">Добавить задачу</button>
      </footer>
    </div>
  `;
}

export function renderTaskModal(modal, tasks, todayISO) {
  const editing = modal.mode === "edit" ? tasks.find((task) => task.id === modal.id) : null;
  const task = editing || {
    id: "",
    name: "",
    category: modal.isHabit ? "health" : "study",
    icon: modal.isHabit ? "💧" : "📚",
    color: COLOR_SWATCHES[0],
    difficulty: "normal",
    repeat: "daily",
    days: [1, 2, 3, 4, 5],
    startDate: modal.presetDate || todayISO,
    endDate: "",
    isHabit: !!modal.isHabit,
    createdAt: "",
  };
  const title = editing ? "Изменить задачу" : modal.isHabit ? "Новая привычка" : "Новая задача";
  const dayLabels = [
    [1, "Пн", "Понедельник"],
    [2, "Вт", "Вторник"],
    [3, "Ср", "Среда"],
    [4, "Чт", "Четверг"],
    [5, "Пт", "Пятница"],
    [6, "Сб", "Суббота"],
    [0, "Вс", "Воскресенье"],
  ];

  return `
    <div class="overlay">
      <form class="modal" data-form="task" role="dialog" aria-modal="true" aria-labelledby="modal-title" autocomplete="off">
        <header class="modal-head">
          <h2 id="modal-title">${title}</h2>
          <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${icon("close", 18)}</button>
        </header>
        <input type="hidden" name="id" value="${esc(task.id)}" />
        <input type="hidden" name="createdAt" value="${esc(task.createdAt)}" />
        <label class="field">
          <span>Название</span>
          <input name="name" maxlength="40" required placeholder="Учёба, вода, тренировка…" value="${esc(task.name)}" />
        </label>
        <div class="form-row">
          <label class="field">
            <span>Категория</span>
            <select name="category">
              ${CATEGORIES.map((item) => `<option value="${item.id}" ${item.id === task.category ? "selected" : ""}>${item.icon} ${item.label}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Повтор</span>
            <select name="repeat">
              ${[
                ["daily", "Каждый день"],
                ["weekdays", "Будни"],
                ["weekends", "Выходные"],
                ["custom", "Свои дни"],
                ["once", "Один раз"],
              ].map(([value, label]) => `<option value="${value}" ${task.repeat === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="custom-days" ${task.repeat === "custom" ? "" : "hidden"}>
          <span>Дни</span>
          <div class="daypicks">
            ${dayLabels.map(([value, label, title]) => `
              <label class="daypick" title="${title}">
                <input type="checkbox" name="days" value="${value}" ${task.days?.includes(value) ? "checked" : ""} />
                <span>${label}</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="field">
          <span>Иконка</span>
          <div class="icon-grid">
            ${ICON_CHOICES.map((item) => `
              <label class="icon-opt">
                <input type="radio" name="icon" value="${item}" ${item === task.icon ? "checked" : ""} />
                <span>${item}</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="field">
          <span>Цвет</span>
          <div class="color-row">
            ${COLOR_SWATCHES.map((color) => `
              <label class="color-opt">
                <input type="radio" name="color" value="${color}" ${color === task.color ? "checked" : ""} />
                <span style="background:${color}"></span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="field">
          <span>Сложность</span>
          <div class="seg">
            <label><input type="radio" name="difficulty" value="normal" ${task.difficulty !== "hard" ? "checked" : ""} /><span>Обычная · +10 XP</span></label>
            <label><input type="radio" name="difficulty" value="hard" ${task.difficulty === "hard" ? "checked" : ""} /><span>Сложная · +20 XP</span></label>
          </div>
        </div>
        <div class="form-row">
          <label class="field">
            <span>Начало</span>
            <input type="date" name="startDate" required value="${esc(task.startDate)}" />
          </label>
          <label class="field">
            <span>Конец</span>
            <input type="date" name="endDate" value="${esc(task.endDate || "")}" />
          </label>
        </div>
        <label class="checkline">
          <input type="checkbox" name="habit" ${task.isHabit ? "checked" : ""} />
          <span>Показывать в привычках</span>
        </label>
        <p class="form-error" role="alert"></p>
        <footer class="modal-actions">
          ${editing ? `<button type="button" class="btn danger" data-action="delete-ask" data-id="${esc(task.id)}">Удалить</button>` : `<span></span>`}
          <div class="modal-actions-right">
            <button type="button" class="btn ghost" data-action="close-modal">Отмена</button>
            <button type="submit" class="btn">${editing ? "Сохранить" : "Добавить"}</button>
          </div>
        </footer>
      </form>
    </div>
  `;
}

export function renderConfirm(confirm) {
  const presets = {
    erase: {
      title: "Стереть все данные?",
      body: "Задачи, привычки, XP и значки пропадут из этого браузера.",
      action: "confirm-erase",
      ok: "Стереть",
    },
    restore: {
      title: "Загрузить пример?",
      body: "Текущие задачи и прогресс заменятся. Имя и начало недели останутся.",
      action: "confirm-restore",
      ok: "Загрузить",
    },
  };
  const preset = presets[confirm.kind] || {
    title: `Удалить «${confirm.name}»?`,
    body: "Отметки этой задачи исчезнут, и её XP уйдёт из общего счёта.",
    action: "confirm-delete",
    ok: "Удалить",
  };
  const { title, body, action, ok } = preset;
  return `
    <div class="overlay confirm">
      <div class="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">${esc(title)}</h2>
        <p>${esc(body)}</p>
        <footer class="modal-actions">
          <span></span>
          <div class="modal-actions-right">
            <button type="button" class="btn ghost" data-action="close-confirm">Отмена</button>
            <button type="button" class="btn danger" data-action="${action}" data-id="${esc(confirm.id || "")}">${ok}</button>
          </div>
        </footer>
      </div>
    </div>
  `;
}

export function renderDrawer(iso, ctx) {
  return `
    <div class="drawer-back"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(formatDayTitle(ctx.parse(iso)))}">
      <button type="button" class="icon-btn drawer-close" data-action="close-day" aria-label="Закрыть">${icon("close", 18)}</button>
      ${renderDayPanel(iso, ctx)}
    </aside>
  `;
}

export { ACHIEVEMENTS, MONTHS_SHORT, periodProgress, formatMonthYear };
