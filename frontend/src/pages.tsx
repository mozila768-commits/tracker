import { CheckIcon, Icon } from "./icons";
import { FinancePage } from "./finance";
import { DayReview } from "./dayreview";
import { TelegramPanel } from "./telegram";
import { HourDay, HourToday, HourWeek } from "./hours";
import {
  ACHIEVEMENTS,
  CATEGORIES,
  DOW,
  DOW_SHORT,
  activitySeries,
  addDays,
  dayProgress,
  dowOrder,
  eachDay,
  formatDayTitle,
  formatMonthYear,
  formatRange,
  greeting,
  habitSnapshot,
  isDone,
  isScheduled,
  monthWeeks,
  parseISO,
  percent,
  compareWithPreviousWeek,
  periodProgress,
  plural,
  startOfWeek,
  taskRangeProgress,
  taskXp,
  tasksOnDate,
  toISO,
  weekDays,
  weekIndexInMonth,
} from "./logic";
import type { Task } from "./api";
import type { Page, TrackerContext } from "./types";

const PAGE_COPY: Partial<Record<Page, [string, string]>> = {
  tasks: ["Задачи", "Добавляй, меняй и отмечай то, что запланировано на сегодня."],
  habits: ["Привычки", "Серии и прогресс по делам, которые повторяются."],
  calendar: ["Календарь", "Месяц, неделя и день в одном планере."],
  statistics: ["Статистика", "Серии, XP и активность за последние дни."],
  achievements: ["Достижения", "Значки остаются, как только ты их получаешь."],
  settings: ["Настройки", "Имя, начало недели и данные на этом устройстве."],
  finance: ["Финансы", "Доход, расход и накопления в сомах."],
  hours: ["Часы", "Короткие дела на каждый день и время, до которого надо успеть."],
};

export function Topbar({ ctx, showMonth = false }: { ctx: TrackerContext; showMonth?: boolean }) {
  const level = ctx.stats.level;
  const pills = (
    <div className="pills">
      <button type="button" className={`pill ${ctx.fx.streak ? "bump" : ""}`} onClick={() => ctx.actions.nav("statistics")}>
        <span aria-hidden="true">🔥</span>
        <span><strong>{ctx.stats.streak}</strong> {plural(ctx.stats.streak, "день", "дня", "дней")} подряд</span>
      </button>
      <button type="button" className="pill" onClick={() => ctx.actions.nav("statistics")}>
        <span aria-hidden="true">⭐</span>
        <span><strong>{ctx.stats.xp.toLocaleString("ru-RU")}</strong> XP</span>
      </button>
      <button type="button" className="pill pill-level" onClick={() => ctx.actions.nav("statistics")}>
        <span aria-hidden="true">🏆</span>
        <span className="pill-level-copy">
          <span><strong>Уровень {level.level}</strong> · {level.name}</span>
          <span className="mini-bar" aria-hidden="true"><i style={{ width: `${Math.round(level.progress * 100)}%` }} /></span>
        </span>
      </button>
    </div>
  );
  if (showMonth) {
    return (
      <header className="topbar">
        <div className="topbar-copy">
          <p className="brand-kicker">ТРЕКЕР ЖИЗНИ</p>
          <p className="tagline">Преврати обычную жизнь в игру.</p>
          <div className="month-switch">
            <button type="button" className="icon-btn" aria-label="Предыдущий месяц" onClick={() => ctx.actions.shiftMonth(-1)}><Icon name="left" size={18} /></button>
            <h1>{formatMonthYear(ctx.cursorDate)}</h1>
            <button type="button" className="icon-btn" aria-label="Следующий месяц" onClick={() => ctx.actions.shiftMonth(1)}><Icon name="right" size={18} /></button>
            <button type="button" className="text-btn" onClick={ctx.actions.goToday}>Сегодня</button>
          </div>
          <p className="hello">{greeting(new Date(), ctx.settings.name)}</p>
        </div>
        {pills}
      </header>
    );
  }
  const [title, line] = PAGE_COPY[ctx.ui.page] || ["Трекер", ""];
  return (
    <header className="topbar">
      <div className="topbar-copy">
        <p className="brand-kicker">ТРЕКЕР ЖИЗНИ</p>
        <h1>{title}</h1>
        <p className="hello">{line}</p>
      </div>
      {pills}
    </header>
  );
}

function caption(progress: { future?: boolean; total: number; done: number; partial?: boolean } | null) {
  if (!progress || progress.future) return "Этот период ещё не начался";
  if (!progress.total) return "Ничего не запланировано";
  const text = `${progress.done} из ${progress.total} выполнено`;
  return progress.partial ? `${text} · пока` : text;
}

function repeatLabel(task: Task) {
  if (task.repeat === "daily") return "Каждый день";
  if (task.repeat === "weekdays") return "Будни";
  if (task.repeat === "weekends") return "Выходные";
  if (task.repeat === "once") return formatDayTitle(parseISO(task.startDate));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const days = order.filter((day) => task.days?.includes(day)).map((day) => DOW_SHORT[day]);
  return days.join(" ") || "Свои дни";
}

function ProgressBar({ rate, tone = "pink" }: { rate: number; tone?: string }) {
  const width = Math.max(0, Math.min(100, Math.round((rate || 0) * 100)));
  return (
    <div className={`bar ${tone}`} role="meter" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100} aria-label={`${width} процентов`}>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

function ProgressCard({ kicker, title, rate, captionText, tone = "pink" }: { kicker: string; title: string; rate: number; captionText: string; tone?: string }) {
  return (
    <article className="progress-card">
      <div className="progress-top">
        <div>
          <p className="kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
        <strong>{percent(rate)}</strong>
      </div>
      <ProgressBar rate={rate} tone={tone} />
      <p className="progress-cap">{captionText}</p>
    </article>
  );
}

function Empty({ ctx, title, text, habit = false }: { ctx: TrackerContext; title: string; text: string; habit?: boolean }) {
  return (
    <section className="empty-hero">
      <div className="empty-checks" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} className={index % 4 === 0 ? "on" : ""} />)}
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="empty-actions">
        <button type="button" className="btn" onClick={() => ctx.actions.openAdd(habit)}>
          <Icon name="plus" size={16} /> {habit ? "Добавить привычку" : "Добавить задачу"}
        </button>
      </div>
    </section>
  );
}

function summaryValue(date: Date, tasks: Task[], completions: TrackerContext["completions"], today: Date, kind: string) {
  if (toISO(date) > toISO(today)) return "—";
  const progress = dayProgress(tasks, completions, date);
  if (!progress.total) return "—";
  if (kind === "done") return String(progress.done);
  if (kind === "left") return String(progress.left);
  return `${Math.round(progress.rate * 100)}%`;
}

function TaskTable({ ctx, dates, mode = "week", weeks = [], weekLabel = "" }: { ctx: TrackerContext; dates: Date[]; mode?: string; weeks?: { index: number; days: Date[] }[]; weekLabel?: string }) {
  if (!ctx.tasks.length) return null;
  const visible = ctx.tasks.filter((task) => dates.some((date) => isScheduled(task, date)));
  if (!visible.length) {
    return <div className="table-empty"><p>В этом виде ничего не запланировано.</p><button type="button" className="btn" onClick={() => ctx.actions.openAdd(false)}>Добавить задачу</button></div>;
  }
  return (
    <div className="table-scroll">
      <table className={`planner-table ${mode}`}>
        <thead>
          {mode === "month" ? (
            <>
              <tr>
                <th className="sticky task-head" rowSpan={2}><div className="week-mark"><strong>ЗАДАЧИ</strong><small>{formatMonthYear(ctx.cursorDate)}</small></div></th>
                {weeks.map((week) => <th key={week.index} className="week-group" colSpan={week.days.length}>Неделя {week.index}</th>)}
              </tr>
              <tr>{dates.map((date) => <DayHead key={toISO(date)} ctx={ctx} date={date} />)}</tr>
            </>
          ) : (
            <tr>
              <th className="sticky task-head"><div className="week-mark"><strong>{weekLabel}</strong><small>{formatRange(dates[0], dates[dates.length - 1])}</small></div></th>
              {dates.map((date) => <DayHead key={toISO(date)} ctx={ctx} date={date} />)}
            </tr>
          )}
        </thead>
        <tbody>
          {visible.map((task) => (
            <tr className="task-row" key={task.id}>
              <td className="sticky">
                <div className="task-name">
                  <span className="task-ico" style={{ background: `${task.color}66` }}>{task.icon}</span>
                  <span className="task-label">{task.name}</span>
                </div>
              </td>
              {dates.map((date) => <TaskCell key={toISO(date)} ctx={ctx} task={task} date={date} />)}
            </tr>
          ))}
          {([["done", "ГОТОВО", "row-done"], ["left", "ОСТАЛОСЬ", "row-left"], ["pct", "ПРОГРЕСС", "row-pct"]] as const).map(([kind, label, className]) => (
            <tr className={`summary ${className}`} key={kind}>
              <td className="sticky"><div className="sum-label">{label}</div></td>
              {dates.map((date) => <td key={toISO(date)} className={toISO(date) === toISO(ctx.today) ? "is-today" : ""}>{summaryValue(date, visible, ctx.completions, ctx.today, kind)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayHead({ ctx, date }: { ctx: TrackerContext; date: Date }) {
  const iso = toISO(date);
  const isToday = iso === toISO(ctx.today);
  return (
    <th className={`day-col ${isToday ? "is-today" : ""}`}>
      <button type="button" className="day-head" aria-label={`Открыть ${formatDayTitle(date)}`} onClick={() => ctx.actions.openDay(iso)}>
        <span className="dow">{DOW_SHORT[date.getDay()]}</span>
        <span className={`day-num ${isToday ? "today" : ""}`}>{date.getDate()}</span>
      </button>
    </th>
  );
}

function TaskCell({ ctx, task, date }: { ctx: TrackerContext; task: Task; date: Date }) {
  const iso = toISO(date);
  const todayISO = toISO(ctx.today);
  const future = iso > todayISO;
  const todayClass = iso === todayISO ? "is-today" : "";
  if (!isScheduled(task, date)) {
    return <td className={`tick is-na ${todayClass}`}><span className="na-box" title="Не запланировано" /></td>;
  }
  const done = isDone(ctx.completions, task.id, iso);
  const pop = ctx.fx.key === `${task.id}|${iso}`;
  return (
    <td className={`tick ${todayClass} ${done ? "is-done" : ""} ${future ? "is-future" : ""} ${pop ? "is-pop" : ""}`}>
      <button type="button" className={`check ${done ? "on" : ""}`} disabled={future} aria-pressed={done} aria-label={`${task.name}, ${formatDayTitle(date)}${done ? ", выполнено" : ""}`} onClick={() => ctx.actions.toggle(task.id, iso)}>
        <span className="box">{done ? <CheckIcon /> : null}</span>
      </button>
    </td>
  );
}

function MonthProgress({ ctx }: { ctx: TrackerContext }) {
  const cursor = ctx.cursorDate;
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const rows = ctx.tasks.map((task) => {
    const full = taskRangeProgress(task, ctx.completions, start, end);
    if (!full.total) return null;
    const soFar = start > ctx.today ? { done: 0, total: 0, rate: 0 } : taskRangeProgress(task, ctx.completions, start, ctx.today < end ? ctx.today : end);
    return { task, soFar };
  }).filter(Boolean) as { task: Task; soFar: { done: number; total: number; rate: number } }[];
  const done = rows.reduce((sum, row) => sum + row.soFar.done, 0);
  const total = rows.reduce((sum, row) => sum + row.soFar.total, 0);
  return (
    <aside className={`month-side ${ctx.ui.tableMode === "month" ? "wide" : ""}`}>
      <header className="side-head">
        <p>ПРОГРЕСС<br />ЗА МЕСЯЦ</p>
        <strong>{total ? `${done} / ${total}` : "—"}</strong>
      </header>
      <div className="bars">
        {rows.length ? rows.map(({ task, soFar }) => (
          <div className="m-row" key={task.id}>
            <div className="m-name"><span>{task.icon}</span> {task.name}</div>
            <div className="m-line">
              <ProgressBar rate={soFar.total ? soFar.rate : 0} />
              <b>{soFar.total ? percent(soFar.rate) : "—"}</b>
            </div>
          </div>
        )) : <p className="muted">В этом месяце задач нет.</p>}
      </div>
    </aside>
  );
}

export function PageView({ ctx }: { ctx: TrackerContext }) {
  if (ctx.ui.page === "dashboard") return <Dashboard ctx={ctx} />;
  if (ctx.ui.page === "tasks") return <TasksPage ctx={ctx} />;
  if (ctx.ui.page === "hours") return <HourWeek todayISO={toISO(ctx.today)} />;
  if (ctx.ui.page === "habits") return <HabitsPage ctx={ctx} />;
  if (ctx.ui.page === "calendar") return <CalendarPage ctx={ctx} />;
  if (ctx.ui.page === "statistics") return <StatisticsPage ctx={ctx} />;
  if (ctx.ui.page === "achievements") return <AchievementsPage ctx={ctx} />;
  if (ctx.ui.page === "finance") return <FinancePage />;
  return <SettingsPage ctx={ctx} />;
}

function itemLine(part: { taskDone: number; taskTotal: number; habitDone: number; habitTotal: number }) {
  const bits: string[] = [];
  if (part.taskTotal) bits.push(`${part.taskDone} из ${part.taskTotal} ${plural(part.taskTotal, "задача", "задачи", "задач")}`);
  if (part.habitTotal) bits.push(`${part.habitDone} из ${part.habitTotal} ${plural(part.habitTotal, "привычка", "привычки", "привычек")}`);
  return bits.join(" · ");
}

function WeekCompare({ ctx }: { ctx: TrackerContext }) {
  const report = compareWithPreviousWeek(ctx.tasks, ctx.completions, ctx.today);
  return (
    <section className="panel week-compare">
      <h2>Сравнение с прошлой неделей</h2>
      {report.comparable ? (
        <>
          <div className="week-compare-cols">
            <div>
              <span>Эта неделя</span>
              <strong>{report.currentPct}%</strong>
              <div className="bar" role="meter" aria-valuenow={report.currentPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Эта неделя: ${report.currentPct} процентов`}>
                <span style={{ width: `${report.currentPct}%` }} />
              </div>
              <small>{itemLine(report.current)}{report.partial ? " · пока" : ""}</small>
            </div>
            <div>
              <span>Прошлая неделя</span>
              <strong>{report.previousPct}%</strong>
              <div className="bar blue" role="meter" aria-valuenow={report.previousPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Прошлая неделя: ${report.previousPct} процентов`}>
                <span style={{ width: `${report.previousPct}%` }} />
              </div>
              <small>{itemLine(report.previous)}</small>
            </div>
          </div>
          <p className={`week-delta ${report.points > 0 ? "up" : report.points < 0 ? "down" : ""}`}>
            {report.points > 0 ? "↑" : report.points < 0 ? "↓" : "→"} {report.points > 0 ? `+${report.points}` : report.points} п.п.
          </p>
          {report.relative != null && report.points !== 0 ? (
            <p className="week-relative">
              Ты выполнила на {Math.abs(report.relative)}% {report.points > 0 ? "больше" : "меньше"} относительно прошлой недели
            </p>
          ) : null}
          <p className="week-note">
            {report.points > 0
              ? "Продуктивность выросла относительно прошлой недели."
              : report.points < 0
                ? "На этой неделе продуктивность ниже прошлой."
                : "Результат почти не изменился."}
          </p>
        </>
      ) : (
        <p className="muted">Недостаточно данных для сравнения</p>
      )}
    </section>
  );
}

function Dashboard({ ctx }: { ctx: TrackerContext }) {
  const mode = ctx.ui.tableMode;
  const days = weekDays(ctx.cursorDate, ctx.settings.weekStartsOn);
  const weeks = monthWeeks(ctx.cursorDate.getFullYear(), ctx.cursorDate.getMonth(), ctx.settings.weekStartsOn);
  const monthDates = weeks.flatMap((week) => week.days);
  const dates = mode === "month" ? monthDates : days;
  const weekNumber = weekIndexInMonth(ctx.cursorDate, ctx.settings.weekStartsOn);
  const weekProgress = periodProgress(ctx.tasks, ctx.completions, days[0], days[6], ctx.today);
  const monthStart = new Date(ctx.cursorDate.getFullYear(), ctx.cursorDate.getMonth(), 1);
  const monthEnd = new Date(ctx.cursorDate.getFullYear(), ctx.cursorDate.getMonth() + 1, 0);
  const monthProgress = periodProgress(ctx.tasks, ctx.completions, monthStart, monthEnd, ctx.today);
  return (
    <>
      <Topbar ctx={ctx} showMonth />
      <HourToday iso={toISO(ctx.today)} onOpenWeek={() => ctx.actions.nav("hours")} />
      {ctx.tasks.length ? (
        <section className="sheet">
          <div className="sheet-tools">
            <div className="week-nav">
              {mode === "week" ? (
                <>
                  <button type="button" className="icon-btn" aria-label="Предыдущая неделя" onClick={() => ctx.actions.shiftWeek(-1)}><Icon name="left" size={18} /></button>
                  <div>
                    <b>Неделя {weekNumber}</b>
                    <span>{formatRange(days[0], days[6])}</span>
                  </div>
                  <button type="button" className="icon-btn" aria-label="Следующая неделя" onClick={() => ctx.actions.shiftWeek(1)}><Icon name="right" size={18} /></button>
                </>
              ) : (
                <div>
                  <b>{formatMonthYear(ctx.cursorDate)}</b>
                  <span>Все дни месяца</span>
                </div>
              )}
            </div>
            <div className="sheet-tools-right">
              <div className="switch" role="tablist" aria-label="Вид планера">
                <button type="button" className={mode === "week" ? "on" : ""} onClick={() => ctx.actions.setTableMode("week")}>Неделя</button>
                <button type="button" className={mode === "month" ? "on" : ""} onClick={() => ctx.actions.setTableMode("month")}>Месяц</button>
              </div>
              <button type="button" className="btn" onClick={() => ctx.actions.openAdd(false)}><Icon name="plus" size={16} /> Добавить задачу</button>
            </div>
          </div>
          <div className={`planner-layout ${mode === "month" ? "stacked" : ""}`}>
            <TaskTable ctx={ctx} dates={dates} mode={mode} weeks={weeks} weekLabel={`Неделя ${weekNumber}`} />
            <MonthProgress ctx={ctx} />
          </div>
          <p className="sheet-hint">Нажми на клетку, чтобы отметить задачу. +10 XP · сложные +20 XP · идеальный день +50 XP.</p>
          <p className="scroll-hint">Листай вбок, чтобы увидеть остальные дни. Названия задач остаются на месте.</p>
        </section>
      ) : <Empty ctx={ctx} title="Планер пока пустой" text="Добавь задачу, отметь её — и серия начнётся." />}
      <DayReview iso={toISO(ctx.today)} history onOpen={ctx.actions.openDay} />
      <WeekCompare ctx={ctx} />
      <section className="progress-grid">
        <ProgressCard kicker={formatDayTitle(ctx.today)} title="Прогресс за сегодня" rate={ctx.stats.todayProgress.rate} captionText={caption(ctx.stats.todayProgress)} />
        <ProgressCard kicker={formatRange(days[0], days[6])} title="Прогресс за неделю" rate={weekProgress.rate} captionText={caption(weekProgress)} tone="blue" />
        <ProgressCard kicker={formatMonthYear(ctx.cursorDate)} title="Прогресс за месяц" rate={monthProgress.rate} captionText={caption(monthProgress)} tone="lilac" />
      </section>
    </>
  );
}

function TasksPage({ ctx }: { ctx: TrackerContext }) {
  const todayISO = toISO(ctx.today);
  const filter = ctx.ui.filter;
  const list = filter === "habits" ? ctx.tasks.filter((task) => task.isHabit)
    : filter === "tasks" ? ctx.tasks.filter((task) => !task.isHabit)
    : filter !== "all" ? ctx.tasks.filter((task) => task.category === filter)
    : ctx.tasks;
  const chips = [["all", "Все"], ["habits", "Привычки"], ["tasks", "Задачи"], ...CATEGORIES.map((item) => [item.id, `${item.icon} ${item.label}`])];
  if (!ctx.tasks.length) return <Empty ctx={ctx} title="Задач пока нет" text="Создай первую — она появится в планере." />;
  return (
    <>
      <div className="page-tools">
        <div className="chips">
          {chips.map(([id, label]) => (
            <button type="button" key={id} className={`chip ${ctx.ui.filter === id ? "on" : ""}`} onClick={() => ctx.actions.setFilter(id)}>{label}</button>
          ))}
        </div>
        <button type="button" className="btn" onClick={() => ctx.actions.openAdd(false)}><Icon name="plus" size={16} /> Добавить задачу</button>
      </div>
      <div className="task-list">
        {list.length ? list.map((task) => {
          const scheduled = isScheduled(task, ctx.today);
          const done = scheduled && isDone(ctx.completions, task.id, todayISO);
          const category = CATEGORIES.find((item) => item.id === task.category);
          return (
            <article className="task-card" key={task.id}>
              <span className="stripe" style={{ background: task.color }} />
              <span className="task-ico" style={{ background: `${task.color}55` }}>{task.icon}</span>
              <div className="task-copy">
                <h3>{task.name}</h3>
                <p>{category?.label || "Личное"} · {repeatLabel(task)} · {task.difficulty === "hard" ? "Сложная · +20 XP" : "+10 XP"} {task.isHabit ? "· Привычка" : ""}</p>
              </div>
              <div className="task-actions">
                {scheduled ? (
                  <button type="button" className={`check today-check ${done ? "on" : ""}`} aria-pressed={done} aria-label={done ? "Снять отметку за сегодня" : "Отметить выполненной"} onClick={() => ctx.actions.toggle(task.id, todayISO)}>
                    <span className="box">{done ? <CheckIcon /> : null}</span>
                  </button>
                ) : <span className="not-today">Не сегодня</span>}
                <button type="button" className="icon-btn tiny" aria-label={`Изменить ${task.name}`} onClick={() => ctx.actions.openEdit(task.id)}><Icon name="pencil" size={15} /></button>
                <button type="button" className="icon-btn tiny" aria-label={`Удалить ${task.name}`} onClick={() => ctx.actions.deleteAsk(task.id)}><Icon name="trash" size={15} /></button>
              </div>
            </article>
          );
        }) : <div className="table-empty"><p>В этом фильтре пусто.</p></div>}
      </div>
    </>
  );
}

function HabitsPage({ ctx }: { ctx: TrackerContext }) {
  const habits = ctx.tasks.filter((task) => task.isHabit);
  if (!habits.length) return <Empty ctx={ctx} title="Привычек пока нет" text="Привычки — это повторяющиеся задачи со своей серией." habit />;
  return (
    <>
      <div className="page-tools">
        <p className="tools-note">{habits.length} {plural(habits.length, "привычка", "привычки", "привычек")}</p>
        <button type="button" className="btn" onClick={() => ctx.actions.openAdd(true)}><Icon name="plus" size={16} /> Добавить привычку</button>
      </div>
      <div className="habit-grid">
        {habits.map((task) => {
          const snap = habitSnapshot(task, ctx.completions, ctx.today, ctx.settings.weekStartsOn);
          const category = CATEGORIES.find((item) => item.id === task.category);
          return (
            <article className="habit-card" key={task.id}>
              <header className="habit-head">
                <span className="task-ico" style={{ background: `${task.color}55` }}>{task.icon}</span>
                <div>
                  <h3>{task.name}</h3>
                  <p>{category?.label || "Привычка"}</p>
                </div>
                <div className="icon-actions">
                  <button type="button" className="icon-btn tiny" aria-label={`Изменить ${task.name}`} onClick={() => ctx.actions.openEdit(task.id)}><Icon name="pencil" size={15} /></button>
                  <button type="button" className="icon-btn tiny" aria-label={`Удалить ${task.name}`} onClick={() => ctx.actions.deleteAsk(task.id)}><Icon name="trash" size={15} /></button>
                </div>
              </header>
              <div className="habit-streaks">
                <p><strong>{snap.current}</strong><span>Серия</span></p>
                <p><strong>{snap.best}</strong><span>Рекорд</span></p>
              </div>
              <div className="dots" aria-label="Эта неделя">
                {snap.dots.map((dot) => (
                  <span className="dot-col" key={dot.iso}>
                    <i className={`dot ${dot.done ? "on" : ""} ${dot.future ? "fut" : ""} ${!dot.scheduled ? "na" : ""} ${dot.scheduled && !dot.done && !dot.future ? "miss" : ""}`} />
                    <small>{dot.label}</small>
                  </span>
                ))}
              </div>
              <div className="habit-bars">
                <div>
                  <span>Неделя {snap.week.total ? percent(snap.week.rate) : "—"}</span>
                  <ProgressBar rate={snap.week.rate} tone="blue" />
                </div>
                <div>
                  <span>Месяц {snap.month.total ? percent(snap.month.rate) : "—"}</span>
                  <ProgressBar rate={snap.month.rate} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function CalendarPage({ ctx }: { ctx: TrackerContext }) {
  const mode = ctx.ui.calMode;
  const days = weekDays(ctx.cursorDate, ctx.settings.weekStartsOn);
  const weekNumber = weekIndexInMonth(ctx.cursorDate, ctx.settings.weekStartsOn);
  const shift = mode === "day" ? ctx.actions.shiftDay : mode === "week" ? ctx.actions.shiftWeek : ctx.actions.shiftMonth;
  return (
    <>
      <div className="page-tools">
        <div className="week-nav">
          <button type="button" className="icon-btn" aria-label="Назад" onClick={() => shift(-1)}><Icon name="left" size={18} /></button>
          <div>
            <b>{mode === "day" ? formatDayTitle(ctx.cursorDate) : formatMonthYear(ctx.cursorDate)}</b>
            <span>{mode === "week" ? `Неделя ${weekNumber} · ${formatRange(days[0], days[6])}` : mode === "day" ? "Вид на день" : "Вид на месяц"}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="Вперёд" onClick={() => shift(1)}><Icon name="right" size={18} /></button>
          <button type="button" className="text-btn" onClick={ctx.actions.goToday}>Сегодня</button>
        </div>
        <div className="switch" aria-label="Вид календаря">
          {([["month", "Месяц"], ["week", "Неделя"], ["day", "День"]] as const).map(([item, label]) => (
            <button type="button" key={item} className={mode === item ? "on" : ""} onClick={() => ctx.actions.setCalMode(item)}>{label}</button>
          ))}
        </div>
      </div>
      {mode === "month" ? <MonthCalendar ctx={ctx} /> : null}
      {mode === "week" ? (
        <section className="sheet">
          <div className="planner-layout stacked">
            <TaskTable ctx={ctx} dates={days} weekLabel={`Неделя ${weekNumber}`} />
          </div>
        </section>
      ) : null}
      {mode === "day" ? <section className="day-sheet"><DayPanel ctx={ctx} iso={ctx.ui.cursor} /></section> : null}
    </>
  );
}

function MonthCalendar({ ctx }: { ctx: TrackerContext }) {
  const year = ctx.cursorDate.getFullYear();
  const month = ctx.cursorDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const gridStart = startOfWeek(first, ctx.settings.weekStartsOn);
  const gridEnd = addDays(startOfWeek(last, ctx.settings.weekStartsOn), 6);
  const days = eachDay(gridStart, gridEnd);
  const headers = dowOrder(ctx.settings.weekStartsOn).map((dow: number) => DOW_SHORT[dow]);
  const streak = new Set(ctx.stats.streakDays);
  const todayISO = toISO(ctx.today);
  return (
    <div className="calendar">
      <div className="cal-head">{headers.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
      <div className="cal-grid">
        {days.map((date) => {
          const iso = toISO(date);
          const inMonth = date.getMonth() === month;
          const future = iso > todayISO;
          const progress = dayProgress(ctx.tasks, ctx.completions, date);
          const heat = inMonth && !future && progress.total ? progress.rate : 0;
          const missed = inMonth && !future && progress.total > 0 && progress.done === 0;
          const classes = ["cal-day", inMonth ? "" : "out", iso === todayISO ? "is-today" : "", future ? "future" : "", missed ? "missed" : "", progress.perfect && inMonth ? "perfect" : ""].filter(Boolean).join(" ");
          return (
            <button type="button" key={iso} className={classes} style={{ ["--heat" as string]: heat.toFixed(3) }} onClick={() => ctx.actions.openDay(iso)}>
              <span className="cal-num">{date.getDate()}</span>
              {inMonth && progress.total && !future ? <><span className="cal-frac">{progress.done}/{progress.total}</span><span className="cal-pct">{Math.round(progress.rate * 100)}%</span></> : null}
              {streak.has(iso) && inMonth ? <span className="cal-flame" aria-hidden="true">🔥</span> : null}
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span><i className="swatch low" /> Спокойный день</span>
        <span><i className="swatch high" /> Сильный день</span>
        <span>🔥 Серия</span>
      </div>
    </div>
  );
}

export function DayPanel({ ctx, iso }: { ctx: TrackerContext; iso: string }) {
  const date = parseISO(iso);
  const todayISO = toISO(ctx.today);
  const isToday = iso === todayISO;
  const future = iso > todayISO;
  const list = tasksOnDate(ctx.tasks, date);
  const progress = dayProgress(ctx.tasks, ctx.completions, date);
  const perfect = progress.perfect && !future;
  return (
    <div className="day-panel">
      <div className="day-nav">
        <button type="button" className="icon-btn" aria-label="Предыдущий день" onClick={() => ctx.actions.shiftOpenDay(toISO(addDays(date, -1)))}><Icon name="left" size={18} /></button>
        <button type="button" className="icon-btn" aria-label="Следующий день" onClick={() => ctx.actions.shiftOpenDay(toISO(addDays(date, 1)))}><Icon name="right" size={18} /></button>
      </div>
      <p className="kicker">{isToday ? "Сегодня" : DOW[date.getDay()]}</p>
      <h2>{formatDayTitle(date)}</h2>
      <p className="day-sub">{future ? "Этот день можно отметить, когда он наступит." : isToday ? "Задачи на сегодня" : "Задачи"}</p>
      <HourDay iso={iso} />
      {perfect ? <div className="perfect-banner">Идеальный день!</div> : null}
      <DayReview iso={iso} locked={future} />
      <div className="day-list">
        {list.length ? list.map((task) => {
          const done = isDone(ctx.completions, task.id, iso);
          const pop = ctx.fx.key === `${task.id}|${iso}`;
          return (
            <button type="button" key={task.id} className={`day-item ${done ? "done" : ""} ${pop ? "is-pop" : ""}`} disabled={future} onClick={() => ctx.actions.toggle(task.id, iso)}>
              <span className="box">{done ? <CheckIcon /> : null}</span>
              <span className="task-ico" style={{ background: `${task.color}66` }}>{task.icon}</span>
              <span className="day-item-name">{task.name}</span>
              <span className="xp-tag">{task.difficulty === "hard" ? "+20" : "+10"}</span>
            </button>
          );
        }) : <div className="table-empty compact"><p>Ничего не запланировано.</p></div>}
      </div>
      <footer className="day-foot">
        <div className="progress-top">
          <strong>{progress.total ? `${progress.done} / ${progress.total} выполнено` : "Нет задач"}</strong>
          <span>{progress.total ? percent(progress.rate) : ""}</span>
        </div>
        {progress.total ? <ProgressBar rate={progress.rate} tone={perfect ? "blue" : "pink"} /> : null}
        <button type="button" className="btn ghost" onClick={() => ctx.actions.openAdd(false, iso)}>Добавить задачу</button>
      </footer>
    </div>
  );
}

function StatisticsPage({ ctx }: { ctx: TrackerContext }) {
  const series = activitySeries(ctx.tasks, ctx.completions, ctx.today, ctx.ui.range);
  const level = ctx.stats.level;
  const dense = ctx.ui.range > 7;
  return (
    <>
      <section className="stat-grid">
        <article className="streak-feature">
          <div>
            <p className="stat-label">Текущая серия</p>
            <p className="streak-num">{ctx.stats.streak}<small>{plural(ctx.stats.streak, "день", "дня", "дней")}</small></p>
          </div>
          <div className="streak-best"><span>Рекорд</span><strong>{ctx.stats.bestStreak}</strong></div>
        </article>
        <StatCard glyph="🏆" label="Рекорд серии" value={String(ctx.stats.bestStreak)} hint="Самая длинная" />
        <StatCard glyph="⭐" label="Всего XP" value={ctx.stats.xp.toLocaleString("ru-RU")} hint={level.next ? `${level.toNext.toLocaleString("ru-RU")} до следующего уровня` : "Максимум"} />
        <StatCard glyph="✓" label="Выполнено задач" value={String(ctx.stats.completed)} hint={`${ctx.stats.scheduled} запланировано`} />
        <StatCard glyph="📊" label="Процент выполнения" value={percent(ctx.stats.completionRate)} hint="До сегодня" />
      </section>
      <section className="level-card">
        <div className="level-copy">
          <p className="kicker">Уровень {level.level}</p>
          <h2>{level.name}</h2>
          <p>{level.next ? `${level.xp.toLocaleString("ru-RU")} XP · ещё ${level.toNext.toLocaleString("ru-RU")} XP до «${level.next.name}»` : `${level.xp.toLocaleString("ru-RU")} XP · это последний уровень`}</p>
        </div>
        <ProgressBar rate={level.progress} tone="ink" />
      </section>
      <section className="chart-card">
        <header className="chart-head">
          <div>
            <p className="kicker">Активность</p>
            <h2>Последние {ctx.ui.range} {plural(ctx.ui.range, "день", "дня", "дней")}</h2>
          </div>
          <div className="switch">
            <button type="button" className={ctx.ui.range === 7 ? "on" : ""} onClick={() => ctx.actions.setRange(7)}>7 дней</button>
            <button type="button" className={ctx.ui.range === 30 ? "on" : ""} onClick={() => ctx.actions.setRange(30)}>30 дней</button>
          </div>
        </header>
        <div className={`chart ${dense ? "dense" : ""}`}>
          {series.map((day) => {
            const height = day.total ? Math.max(8, Math.round(day.rate * 100)) : 0;
            const showTick = !dense || day.isToday || day.date.getDate() === 1 || day.date.getDate() % 5 === 0;
            return (
              <div className="chart-col" key={day.iso} title={`${formatDayTitle(day.date)}: ${day.done}/${day.total}`}>
                <div className="chart-bar-wrap"><div className={`chart-bar ${day.isToday ? "today" : ""} ${day.perfect ? "perfect" : ""}`} style={{ height: `${height}%` }} /></div>
                <span>{showTick ? day.tick : ""}</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function StatCard({ glyph, label, value, hint }: { glyph: string; label: string; value: string; hint: string }) {
  return (
    <article className="stat-card">
      <span aria-hidden="true">{glyph}</span>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-hint">{hint}</p>
    </article>
  );
}

function AchievementsPage({ ctx }: { ctx: TrackerContext }) {
  return (
    <>
      <p className="tools-note ach-count">{ctx.unlocked.length} из {ACHIEVEMENTS.length} открыто</p>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((item) => {
          const unlocked = ctx.unlocked.includes(item.id);
          return (
            <article className={`ach-card ${unlocked ? "is-open" : "is-locked"}`} key={item.id}>
              <span className="ach-icon" aria-hidden="true">{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className="ach-state">{unlocked ? "Открыто" : "Закрыто"}</span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function SettingsPage({ ctx }: { ctx: TrackerContext }) {
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>Профиль</h2>
        <form className="settings-form" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          ctx.actions.saveName(String(data.get("name") || ""));
        }}>
          <label className="field">
            <span>Имя</span>
            <input name="name" maxLength={40} defaultValue={ctx.settings.name} placeholder="Твоё имя" />
          </label>
          <button type="submit" className="btn">Сохранить имя</button>
        </form>
        <div className="field">
          <span>Неделя начинается</span>
          <div className="switch">
            <button type="button" className={ctx.settings.weekStartsOn === 1 ? "on" : ""} onClick={() => ctx.actions.setWeekStart(1)}>С понедельника</button>
            <button type="button" className={ctx.settings.weekStartsOn === 0 ? "on" : ""} onClick={() => ctx.actions.setWeekStart(0)}>С воскресенья</button>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>Данные на этом устройстве</h2>
        <p className="panel-copy">Задачи, привычки, короткие дела и прогресс хранятся в PostgreSQL на сервере. Перед очисткой лучше скачать копию.</p>
        <div className="settings-actions">
          <button type="button" className="btn" onClick={ctx.actions.exportData}>Экспорт</button>
          <label className="btn ghost file-btn">
            Импорт
            <input id="import-file" type="file" accept="application/json,.json" hidden onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  ctx.actions.importData(JSON.parse(String(reader.result)));
                } catch {
                  ctx.actions.importData(null);
                }
              };
              reader.readAsText(file);
            }} />
          </label>
          <button type="button" className="btn danger" onClick={ctx.actions.eraseAsk}>Стереть данные</button>
        </div>
      </section>
      <TelegramPanel />
      <section className="panel rules">
        <h2>Как начисляются очки</h2>
        <ul>
          <li>Обычная задача даёт <strong>+{taskXp({ difficulty: "normal" })} XP</strong>.</li>
          <li>Сложная задача даёт <strong>+{taskXp({ difficulty: "hard" })} XP</strong>.</li>
          <li>Закрой все задачи дня и получи <strong>+50 XP</strong>.</li>
          <li>Серия растёт в каждый день, где выполнена хотя бы одна задача. Сегодня не обрывает серию, пока ничего не отмечено.</li>
        </ul>
      </section>
    </div>
  );
}
