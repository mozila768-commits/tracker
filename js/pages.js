import { CHECK_ICON, icon } from "./icons.js";
import {
  ACHIEVEMENTS,
  CATEGORIES,
  DOW_SHORT,
  activitySeries,
  formatDayTitle,
  formatMonthYear,
  formatRange,
  parseISO,
  isDone,
  isScheduled,
  monthWeeks,
  percent,
  periodProgress,
  plural,
  taskXp,
  toISO,
  weekDays,
  weekIndexInMonth,
} from "./logic.js";
import {
  esc,
  renderAchievementCard,
  renderBottomNav,
  renderCalendar,
  renderConfirm,
  renderDayPanel,
  renderDrawer,
  renderHabitCard,
  renderMonthProgress,
  renderProgressCard,
  renderSidebar,
  renderStatsCard,
  renderStreakCard,
  renderTaskModal,
  renderTaskTable,
  renderTopbar,
  renderProgressBar,
} from "./components.js";

function caption(progress) {
  if (!progress || progress.future) return "Этот период ещё не начался";
  if (!progress.total) return "Ничего не запланировано";
  const text = `${progress.done} из ${progress.total} выполнено`;
  return progress.partial ? `${text} · пока` : text;
}

function repeatLabel(task) {
  if (task.repeat === "daily") return "Каждый день";
  if (task.repeat === "weekdays") return "Будни";
  if (task.repeat === "weekends") return "Выходные";
  if (task.repeat === "once") return formatDayTitle(parseISO(task.startDate));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const days = order.filter((day) => task.days?.includes(day)).map((day) => DOW_SHORT[day]);
  return days.join(" ") || "Свои дни";
}

function renderEmpty(title, text, habit = false) {
  return `
    <section class="empty-hero">
      <div class="empty-checks" aria-hidden="true">
        ${Array.from({ length: 12 }, (_, index) => `<i class="${index % 4 === 0 ? "on" : ""}"></i>`).join("")}
      </div>
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="empty-actions">
        <button type="button" class="btn" data-action="open-add" data-habit="${habit ? "1" : "0"}">${icon("plus", 16)} ${habit ? "Добавить привычку" : "Добавить задачу"}</button>
        <button type="button" class="btn ghost" data-action="restore-sample">Загрузить пример</button>
      </div>
    </section>
  `;
}

function renderDashboard(ctx) {
  const mode = ctx.ui.tableMode;
  const days = weekDays(ctx.cursorDate, ctx.settings.weekStartsOn);
  const weeks = monthWeeks(ctx.cursorDate.getFullYear(), ctx.cursorDate.getMonth(), ctx.settings.weekStartsOn);
  const monthDates = weeks.flatMap((week) => week.days);
  const dates = mode === "month" ? monthDates : days;
  const weekNumber = weekIndexInMonth(ctx.cursorDate, ctx.settings.weekStartsOn);
  const todayProgress = ctx.stats.todayProgress;
  const weekProgress = periodProgress(ctx.tasks, ctx.completions, days[0], days[6], ctx.today);
  const monthStart = new Date(ctx.cursorDate.getFullYear(), ctx.cursorDate.getMonth(), 1);
  const monthEnd = new Date(ctx.cursorDate.getFullYear(), ctx.cursorDate.getMonth() + 1, 0);
  const monthProgress = periodProgress(ctx.tasks, ctx.completions, monthStart, monthEnd, ctx.today);

  const sheet = ctx.tasks.length
    ? `
      <section class="sheet">
        <div class="sheet-tools">
          <div class="week-nav">
            ${mode === "week" ? `
              <button type="button" class="icon-btn" data-action="shift-week" data-dir="-1" aria-label="Предыдущая неделя">${icon("left", 18)}</button>
              <div>
                <b>Неделя ${weekNumber}</b>
                <span>${esc(formatRange(days[0], days[6]))}</span>
              </div>
              <button type="button" class="icon-btn" data-action="shift-week" data-dir="1" aria-label="Следующая неделя">${icon("right", 18)}</button>
            ` : `
              <div>
                <b>${esc(formatMonthYear(ctx.cursorDate))}</b>
                <span>Все дни месяца</span>
              </div>
            `}
          </div>
          <div class="sheet-tools-right">
            <div class="switch" role="tablist" aria-label="Вид планера">
              <button type="button" class="${mode === "week" ? "on" : ""}" data-action="set-table-mode" data-mode="week">Неделя</button>
              <button type="button" class="${mode === "month" ? "on" : ""}" data-action="set-table-mode" data-mode="month">Месяц</button>
            </div>
            <button type="button" class="btn" data-action="open-add">${icon("plus", 16)} Добавить задачу</button>
          </div>
        </div>
        <div class="planner-layout ${mode === "month" ? "stacked" : ""}">
          ${renderTaskTable(ctx, dates, { mode, weeks, weekLabel: `Неделя ${weekNumber}` })}
          ${renderMonthProgress(ctx)}
        </div>
        <p class="sheet-hint">Нажми на клетку, чтобы отметить задачу. +10 XP · сложные +20 XP · идеальный день +50 XP.</p>
        <p class="scroll-hint">Листай вбок, чтобы увидеть остальные дни. Названия задач остаются на месте.</p>
      </section>
    `
    : renderEmpty("Планер пока пустой", "Добавь задачу, отметь её — и серия начнётся.");

  return `
    ${renderTopbar(ctx, { showMonth: true })}
    ${sheet}
    <section class="progress-grid">
      ${renderProgressCard({
        kicker: formatDayTitle(ctx.today),
        title: "Прогресс за сегодня",
        rate: todayProgress.rate,
        caption: caption(todayProgress),
        tone: "pink",
      })}
      ${renderProgressCard({
        kicker: formatRange(days[0], days[6]),
        title: "Прогресс за неделю",
        rate: weekProgress.rate,
        caption: caption(weekProgress),
        tone: "blue",
      })}
      ${renderProgressCard({
        kicker: formatMonthYear(ctx.cursorDate),
        title: "Прогресс за месяц",
        rate: monthProgress.rate,
        caption: caption(monthProgress),
        tone: "lilac",
      })}
    </section>
  `;
}

function filteredTasks(ctx) {
  const filter = ctx.ui.filter;
  if (filter === "habits") return ctx.tasks.filter((task) => task.isHabit);
  if (filter === "tasks") return ctx.tasks.filter((task) => !task.isHabit);
  if (filter !== "all") return ctx.tasks.filter((task) => task.category === filter);
  return ctx.tasks;
}

function renderTasks(ctx) {
  const todayISO = toISO(ctx.today);
  const list = filteredTasks(ctx);
  const chips = [
    ["all", "Все"],
    ["habits", "Привычки"],
    ["tasks", "Задачи"],
    ...CATEGORIES.map((item) => [item.id, `${item.icon} ${item.label}`]),
  ];
  return `
    ${renderTopbar(ctx)}
    ${ctx.tasks.length === 0 ? "" : `
    <div class="page-tools">
      <div class="chips">
        ${chips.map(([id, label]) => `
          <button type="button" class="chip ${ctx.ui.filter === id ? "on" : ""}" data-action="set-filter" data-filter="${id}">${label}</button>
        `).join("")}
      </div>
      <button type="button" class="btn" data-action="open-add">${icon("plus", 16)} Добавить задачу</button>
    </div>`}
    ${ctx.tasks.length === 0 ? renderEmpty("Задач пока нет", "Создай первую — она появится в планере.") : `
      <div class="task-list">
        ${list.length ? list.map((task) => {
          const scheduled = isScheduled(task, ctx.today);
          const done = scheduled && isDone(ctx.completions, task.id, todayISO);
          const category = CATEGORIES.find((item) => item.id === task.category);
          return `
            <article class="task-card">
              <span class="stripe" style="background:${esc(task.color)}"></span>
              <span class="task-ico" style="background:${esc(task.color)}55">${task.icon}</span>
              <div class="task-copy">
                <h3>${esc(task.name)}</h3>
                <p>${esc(category?.label || "Личное")} · ${esc(repeatLabel(task))} · ${task.difficulty === "hard" ? "Сложная · +20 XP" : "+10 XP"} ${task.isHabit ? "· Привычка" : ""}</p>
              </div>
              <div class="task-actions">
                ${scheduled ? `
                  <button type="button" class="check today-check ${done ? "on" : ""}" data-action="toggle" data-id="${esc(task.id)}" data-date="${todayISO}" aria-pressed="${done ? "true" : "false"}" aria-label="${done ? "Снять отметку за сегодня" : "Отметить выполненной"}">
                    <span class="box">${done ? CHECK_ICON : ""}</span>
                  </button>
                ` : `<span class="not-today">Не сегодня</span>`}
                <button type="button" class="icon-btn tiny" data-action="open-edit" data-id="${esc(task.id)}" aria-label="Изменить ${esc(task.name)}">${icon("pencil", 15)}</button>
                <button type="button" class="icon-btn tiny" data-action="delete-ask" data-id="${esc(task.id)}" aria-label="Удалить ${esc(task.name)}">${icon("trash", 15)}</button>
              </div>
            </article>
          `;
        }).join("") : `<div class="table-empty"><p>В этом фильтре пусто.</p></div>`}
      </div>
    `}
  `;
}

function renderHabits(ctx) {
  const habits = ctx.tasks.filter((task) => task.isHabit);
  return `
    ${renderTopbar(ctx)}
    ${habits.length ? `
    <div class="page-tools">
      <p class="tools-note">${habits.length} ${plural(habits.length, "привычка", "привычки", "привычек")}</p>
      <button type="button" class="btn" data-action="open-add" data-habit="1">${icon("plus", 16)} Добавить привычку</button>
    </div>` : ""}
    ${habits.length ? `
      <div class="habit-grid">
        ${habits.map((task) => renderHabitCard(task, ctx.completions, ctx.today, ctx.settings.weekStartsOn)).join("")}
      </div>
    ` : renderEmpty("Привычек пока нет", "Привычки — это повторяющиеся задачи со своей серией.", true)}
  `;
}

function renderCalendarPage(ctx) {
  const mode = ctx.ui.calMode;
  const days = weekDays(ctx.cursorDate, ctx.settings.weekStartsOn);
  const weekNumber = weekIndexInMonth(ctx.cursorDate, ctx.settings.weekStartsOn);
  return `
    ${renderTopbar(ctx)}
    <div class="page-tools">
      <div class="week-nav">
        <button type="button" class="icon-btn" data-action="${mode === "day" ? "shift-day" : mode === "week" ? "shift-week" : "shift-month"}" data-dir="-1" aria-label="Назад">${icon("left", 18)}</button>
        <div>
          <b>${mode === "day" ? esc(formatDayTitle(ctx.cursorDate)) : esc(formatMonthYear(ctx.cursorDate))}</b>
          <span>${mode === "week" ? `Неделя ${weekNumber} · ${esc(formatRange(days[0], days[6]))}` : mode === "day" ? "Вид на день" : "Вид на месяц"}</span>
        </div>
        <button type="button" class="icon-btn" data-action="${mode === "day" ? "shift-day" : mode === "week" ? "shift-week" : "shift-month"}" data-dir="1" aria-label="Вперёд">${icon("right", 18)}</button>
        <button type="button" class="text-btn" data-action="go-today">Сегодня</button>
      </div>
      <div class="switch" aria-label="Вид календаря">
        ${[["month", "Месяц"], ["week", "Неделя"], ["day", "День"]].map(([item, label]) => `
          <button type="button" class="${mode === item ? "on" : ""}" data-action="set-cal-mode" data-mode="${item}">${label}</button>
        `).join("")}
      </div>
    </div>
    ${mode === "month" ? renderCalendar(ctx) : ""}
    ${mode === "week" ? `
      <section class="sheet">
        <div class="planner-layout stacked">
          ${renderTaskTable(ctx, days, { mode: "week", weekLabel: `Неделя ${weekNumber}` })}
        </div>
      </section>
    ` : ""}
    ${mode === "day" ? `
      <section class="day-sheet">
        ${renderDayPanel(ctx.ui.cursor, ctx)}
      </section>
    ` : ""}
  `;
}

function renderStatistics(ctx) {
  const series = activitySeries(ctx.tasks, ctx.completions, ctx.today, ctx.ui.range);
  const level = ctx.stats.level;
  const dense = ctx.ui.range > 7;
  return `
    ${renderTopbar(ctx)}
    <section class="stat-grid">
      ${renderStreakCard(ctx.stats.streak, ctx.stats.bestStreak)}
      ${renderStatsCard({ glyph: "🏆", label: "Рекорд серии", value: String(ctx.stats.bestStreak), hint: "Самая длинная" })}
      ${renderStatsCard({ glyph: "⭐", label: "Всего XP", value: ctx.stats.xp.toLocaleString("ru-RU"), hint: level.next ? `${level.toNext.toLocaleString("ru-RU")} до следующего уровня` : "Максимум" })}
      ${renderStatsCard({ glyph: "✓", label: "Выполнено задач", value: String(ctx.stats.completed), hint: `${ctx.stats.scheduled} запланировано` })}
      ${renderStatsCard({ glyph: "📊", label: "Процент выполнения", value: percent(ctx.stats.completionRate), hint: "До сегодня" })}
    </section>
    <section class="level-card">
      <div class="level-copy">
        <p class="kicker">Уровень ${level.level}</p>
        <h2>${esc(level.name)}</h2>
        <p>${level.next ? `${level.xp.toLocaleString("ru-RU")} XP · ещё ${level.toNext.toLocaleString("ru-RU")} XP до «${esc(level.next.name)}»` : `${level.xp.toLocaleString("ru-RU")} XP · это последний уровень`}</p>
      </div>
      ${renderProgressBar(level.progress, "ink")}
    </section>
    <section class="chart-card">
      <header class="chart-head">
        <div>
          <p class="kicker">Активность</p>
          <h2>Последние ${ctx.ui.range} ${plural(ctx.ui.range, "день", "дня", "дней")}</h2>
        </div>
        <div class="switch">
          <button type="button" class="${ctx.ui.range === 7 ? "on" : ""}" data-action="set-range" data-range="7">7 дней</button>
          <button type="button" class="${ctx.ui.range === 30 ? "on" : ""}" data-action="set-range" data-range="30">30 дней</button>
        </div>
      </header>
      <div class="chart ${dense ? "dense" : ""}">
        ${series.map((day) => {
          const height = day.total ? Math.max(8, Math.round(day.rate * 100)) : 0;
          const showTick = !dense || day.isToday || day.date.getDate() === 1 || day.date.getDate() % 5 === 0;
          return `
            <div class="chart-col" title="${esc(formatDayTitle(day.date))}: ${day.done}/${day.total}">
              <div class="chart-bar-wrap"><div class="chart-bar ${day.isToday ? "today" : ""} ${day.perfect ? "perfect" : ""}" style="height:${height}%"></div></div>
              <span>${showTick ? esc(day.tick) : ""}</span>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAchievements(ctx) {
  const open = ctx.unlocked.length;
  return `
    ${renderTopbar(ctx)}
    <p class="tools-note ach-count">${open} из ${ACHIEVEMENTS.length} открыто</p>
    <div class="ach-grid">
      ${ACHIEVEMENTS.map((item) => renderAchievementCard(item, ctx.unlocked.includes(item.id))).join("")}
    </div>
  `;
}

function renderSettings(ctx) {
  return `
    ${renderTopbar(ctx)}
    <div class="settings-grid">
      <section class="panel">
        <h2>Профиль</h2>
        <form data-form="settings" class="settings-form">
          <label class="field">
            <span>Имя</span>
            <input name="name" maxlength="40" value="${esc(ctx.settings.name)}" placeholder="Твоё имя" />
          </label>
          <button type="submit" class="btn">Сохранить имя</button>
        </form>
        <div class="field">
          <span>Неделя начинается</span>
          <div class="switch">
            <button type="button" class="${ctx.settings.weekStartsOn === 1 ? "on" : ""}" data-action="set-week-start" data-start="1">С понедельника</button>
            <button type="button" class="${ctx.settings.weekStartsOn === 0 ? "on" : ""}" data-action="set-week-start" data-start="0">С воскресенья</button>
          </div>
        </div>
      </section>
      <section class="panel">
        <h2>Данные на этом устройстве</h2>
        <p class="panel-copy">Всё хранится в этом браузере. Перед очисткой лучше скачать копию.</p>
        <div class="settings-actions">
          <button type="button" class="btn" data-action="export-data">Экспорт</button>
          <label class="btn ghost file-btn">Импорт<input id="import-file" type="file" accept="application/json,.json" hidden /></label>
          <button type="button" class="btn ghost" data-action="restore-sample">Загрузить пример</button>
          <button type="button" class="btn danger" data-action="erase-ask">Стереть данные</button>
        </div>
      </section>
      <section class="panel rules">
        <h2>Как начисляются очки</h2>
        <ul>
          <li>Обычная задача даёт <strong>+${taskXp({ difficulty: "normal" })} XP</strong>.</li>
          <li>Сложная задача даёт <strong>+${taskXp({ difficulty: "hard" })} XP</strong>.</li>
          <li>Закрой все задачи дня и получи <strong>+50 XP</strong>.</li>
          <li>Серия растёт в каждый день, где выполнена хотя бы одна задача. Сегодня не обрывает серию, пока ничего не отмечено.</li>
        </ul>
      </section>
    </div>
  `;
}

export function renderApp(ctx) {
  const page = {
    dashboard: renderDashboard,
    tasks: renderTasks,
    habits: renderHabits,
    calendar: renderCalendarPage,
    statistics: renderStatistics,
    achievements: renderAchievements,
    settings: renderSettings,
  }[ctx.ui.page] || renderDashboard;

  return `
    <div class="shell">
      ${renderSidebar(ctx)}
      <main class="main ${ctx.fx.enter ? "is-enter" : ""}">
        <div class="page">${page(ctx)}</div>
      </main>
      ${renderBottomNav(ctx)}
    </div>
    ${ctx.ui.day ? renderDrawer(ctx.ui.day, ctx) : ""}
    ${ctx.ui.modal ? renderTaskModal(ctx.ui.modal, ctx.tasks, toISO(ctx.today)) : ""}
    ${ctx.ui.confirm ? renderConfirm(ctx.ui.confirm) : ""}
  `;
}
