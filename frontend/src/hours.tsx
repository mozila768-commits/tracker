import { useCallback, useEffect, useState } from "react";
import { api, type HourPlan, type HourTask } from "./api";
import { Icon } from "./icons";
import { DOW, parseISO } from "./logic";

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const ON_DAY = ["воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу"];

function useHourPlan() {
  const [plan, setPlan] = useState<HourPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.hours().then((next) => {
      setPlan({ tasks: next.tasks || [], done: next.done || {} });
      setError("");
    }).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onReload = () => load();
    window.addEventListener("tracker-hours-reload", onReload);
    return () => window.removeEventListener("tracker-hours-reload", onReload);
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      window.dispatchEvent(new Event("tracker-hours-reload"));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { plan, error, busy, run };
}

function tasksFor(plan: HourPlan | null, weekday: number) {
  return (plan?.tasks || [])
    .filter((task) => task.weekday === weekday)
    .slice()
    .sort((a, b) => a.until.localeCompare(b.until) || a.position - b.position);
}

function DayColumn({
  weekday,
  tasks,
  iso,
  done,
  busy,
  onAdd,
  onDelete,
  onToggle,
}: {
  weekday: number;
  tasks: HourTask[];
  iso?: string;
  done: Record<string, boolean>;
  busy: boolean;
  onAdd: (weekday: number, name: string, until: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onToggle: (id: string, day: string) => Promise<boolean>;
}) {
  const future = iso ? iso > todayISO() : false;
  return (
    <article className={`hour-day ${iso && !future && iso === todayISO() ? "is-today" : ""}`}>
      <h3>{DOW[weekday]}</h3>
      {tasks.length ? (
        <ul className={`hour-list ${iso ? "has-check" : ""}`}>
          {tasks.map((task) => {
            const checked = iso ? !!done[`${task.id}|${iso}`] : false;
            return (
              <li key={task.id} className={checked ? "is-done" : ""}>
                {iso ? (
                  <button type="button" className={`box ${checked ? "on" : ""}`} disabled={future || busy} aria-label={checked ? "Снять отметку" : "Отметить"} onClick={() => void onToggle(task.id, iso)}>
                    {checked ? "✓" : ""}
                  </button>
                ) : null}
                <span className="hour-name">{task.name}</span>
                <span className="hour-until">до {task.until}</span>
                <button type="button" className="icon-btn" aria-label={`Удалить ${task.name}`} disabled={busy} onClick={() => void onDelete(task.id)}>
                  <Icon name="trash" size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="hour-empty">Пока пусто</p>}
      <form className="hour-add" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const name = String(data.get("name") || "").trim();
        const until = String(data.get("until") || "");
        if (!name) return;
        void onAdd(weekday, name, until).then((saved) => { if (saved) form.reset(); });
      }}>
        <input name="name" maxLength={80} placeholder="Что сделать" aria-label={`Дело на ${ON_DAY[weekday]}`} />
        <input name="until" type="time" required aria-label={`До какого времени, ${ON_DAY[weekday]}`} />
        <button type="submit" className="btn" disabled={busy}>Добавить</button>
      </form>
    </article>
  );
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function HourWeek({ todayISO: iso }: { todayISO: string }) {
  const { plan, error, busy, run } = useHourPlan();
  const todayDow = parseISO(iso).getDay();
  return (
    <section className="hour-board">
      <p className="panel-copy">У каждого дня свой список. Это не привычки и не даёт XP: просто что сделать и до какого времени.</p>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="hour-week">
        {WEEK.map((weekday) => (
          <DayColumn
            key={weekday}
            weekday={weekday}
            tasks={tasksFor(plan, weekday)}
            iso={weekday === todayDow ? iso : undefined}
            done={plan?.done || {}}
            busy={busy}
            onAdd={(day, name, until) => run(() => api.saveHour({ weekday: day, name, until }))}
            onDelete={(id) => run(() => api.deleteHour(id))}
            onToggle={(id, day) => run(() => api.toggleHour(id, day))}
          />
        ))}
      </div>
    </section>
  );
}

export function HourToday({ iso, onOpenWeek }: { iso: string; onOpenWeek: () => void }) {
  const { plan, error, busy, run } = useHourPlan();
  const weekday = parseISO(iso).getDay();
  return (
    <section className="hour-board hour-today">
      <div className="hour-head">
        <div>
          <h2>Короткие дела</h2>
          <p className="panel-copy">Отдельно от привычек. На {ON_DAY[weekday]} — что сделать и до какого времени.</p>
        </div>
        <button type="button" className="btn ghost" onClick={onOpenWeek}>Вся неделя</button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <DayColumn
        weekday={weekday}
        tasks={tasksFor(plan, weekday)}
        iso={iso}
        done={plan?.done || {}}
        busy={busy}
        onAdd={(day, name, until) => run(() => api.saveHour({ weekday: day, name, until }))}
        onDelete={(id) => run(() => api.deleteHour(id))}
        onToggle={(id, day) => run(() => api.toggleHour(id, day))}
      />
    </section>
  );
}

export function HourDay({ iso }: { iso: string }) {
  const { plan, error, busy, run } = useHourPlan();
  const weekday = parseISO(iso).getDay();
  const future = iso > todayISO();
  return (
    <section className="hour-board hour-drawer">
      <h3>По часам</h3>
      <p className="panel-copy">{future ? "План на этот день. Отметить можно, когда он наступит." : "Короткий список отдельно от задач."}</p>
      {error ? <p className="form-error">{error}</p> : null}
      <DayColumn
        weekday={weekday}
        tasks={tasksFor(plan, weekday)}
        iso={future ? undefined : iso}
        done={plan?.done || {}}
        busy={busy}
        onAdd={(day, name, until) => run(() => api.saveHour({ weekday: day, name, until }))}
        onDelete={(id) => run(() => api.deleteHour(id))}
        onToggle={(id, day) => run(() => api.toggleHour(id, day))}
      />
    </section>
  );
}
