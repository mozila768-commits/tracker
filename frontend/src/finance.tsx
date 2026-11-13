import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type Forecast, type LedgerEntry, type LedgerKind } from "./api";
import { Icon } from "./icons";
import { addMonths, formatDayTitle, formatMonthYear, parseISO, plural, toISO } from "./logic";

const KINDS: { id: LedgerKind; label: string; hint: string }[] = [
  { id: "income", label: "Доход", hint: "Деньги, которые пришли" },
  { id: "expense", label: "Расход", hint: "Выбери, на что потратила" },
  { id: "saving", label: "Накопление", hint: "Деньги, которые отложила" },
];

const KIND_LABEL: Record<LedgerKind, string> = {
  income: "Доход",
  expense: "Расход",
  saving: "Накопление",
};

const SPEND = [
  { id: "food", label: "Еда" },
  { id: "transport", label: "Транспорт" },
  { id: "home", label: "Дом" },
  { id: "study", label: "Учёба" },
  { id: "health", label: "Здоровье" },
  { id: "clothes", label: "Одежда" },
  { id: "phone", label: "Связь" },
  { id: "fun", label: "Развлечения" },
  { id: "other", label: "Другое" },
];

const NOTE_LABEL: Record<LedgerKind, [string, string]> = {
  income: ["Откуда", "Зарплата"],
  expense: ["Подробнее", "Хлеб, автобус"],
  saving: ["На что копишь", "На учёбу"],
};

function spendLabel(id: string) {
  return SPEND.find((item) => item.id === id)?.label || "Другое";
}

function formatMoney(cents: number) {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = whole.toLocaleString("ru-RU");
  const word = frac ? "сома" : plural(whole, "сом", "сома", "сомов");
  const num = frac ? `${body},${String(frac).padStart(2, "0")}` : body;
  return `${sign}${num} ${word}`;
}

function parseMoney(raw: string) {
  const cleaned = raw.replace(/\s/g, "").replace(/сом(а|ов)?/gi, "").replace("₸", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 10_000_000_000) return null;
  return cents;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function canPlan(date: Date) {
  const now = new Date();
  return monthStart(date).getTime() >= monthStart(now).getTime();
}

function centsToInput(cents: number) {
  if (!cents) return "";
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return frac ? `${whole},${String(frac).padStart(2, "0")}` : String(whole);
}

export function FinancePage() {
  const today = toISO(new Date());
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[] | null>(null);
  const [planIncome, setPlanIncome] = useState("");
  const [planExpense, setPlanExpense] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<LedgerKind>("expense");
  const [category, setCategory] = useState("food");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    let stop = false;
    api.ledger().then((rows) => {
      if (!stop) setEntries(rows);
    }).catch((err) => {
      if (!stop) setError(err instanceof Error ? err.message : "Не удалось открыть финансы");
    });
    api.forecasts().then((rows) => {
      if (!stop) setForecasts(rows);
    }).catch((err) => {
      if (!stop) setError(err instanceof Error ? err.message : "Не удалось открыть план");
    });
    return () => {
      stop = true;
    };
  }, []);

  const key = monthKey(month);
  const monthEntries = useMemo(
    () => (entries || []).filter((entry) => entry.day.startsWith(key)),
    [entries, key],
  );
  const sum = (list: LedgerEntry[], id: LedgerKind) => list.filter((entry) => entry.kind === id).reduce((total, entry) => total + entry.amount, 0);
  const income = sum(monthEntries, "income");
  const expense = sum(monthEntries, "expense");
  const savedMonth = sum(monthEntries, "saving");
  const savedAll = sum(entries || [], "saving");
  const left = income - expense - savedMonth;
  const planned = (forecasts || []).find((item) => item.month === key);
  const planReady = canPlan(month);

  useEffect(() => {
    setPlanIncome(centsToInput(planned?.income || 0));
    setPlanExpense(centsToInput(planned?.expense || 0));
  }, [key, planned?.income, planned?.expense]);
  const spend = SPEND.map((item) => ({
    ...item,
    amount: monthEntries.filter((entry) => entry.kind === "expense" && (entry.category || "other") === item.id).reduce((total, entry) => total + entry.amount, 0),
  })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    const cents = parseMoney(amount);
    if (cents == null) {
      setError("Напиши сумму в сомах, например 1500 или 1500,50.");
      return;
    }
    if (kind === "expense" && !SPEND.some((item) => item.id === category)) {
      setError("Выбери, на что потратила.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError("Укажи дату.");
      return;
    }
    setBusy(true);
    setError("");
    const draft: LedgerEntry = {
      id: "",
      kind,
      amount: cents,
      note: note.trim(),
      category: kind === "expense" ? category : "",
      day,
      createdAt: 0,
    };
    try {
      const saved = await api.saveLedger(draft);
      setEntries((current) => [saved, ...(current || [])]);
      setAmount("");
      setNote("");
      const savedMonth = parseISO(saved.day);
      setMonth(new Date(savedMonth.getFullYear(), savedMonth.getMonth(), 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const previous = entries;
    setEntries((current) => (current || []).filter((entry) => entry.id !== id));
    try {
      await api.deleteLedger(id);
    } catch (err) {
      setEntries(previous);
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault();
    const incomeCents = planIncome.trim() ? parseMoney(planIncome) : 0;
    const expenseCents = planExpense.trim() ? parseMoney(planExpense) : 0;
    if (incomeCents == null || expenseCents == null) {
      setError("Напиши сумму в сомах, например 20000.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await api.saveForecast({ month: key, income: incomeCents, expense: expenseCents });
      setForecasts((current) => {
        const rest = (current || []).filter((item) => item.month !== saved.month);
        return [...rest, saved].sort((a, b) => a.month.localeCompare(b.month));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить план");
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(monthId: string) {
    const previous = forecasts;
    setForecasts((current) => (current || []).filter((item) => item.month !== monthId));
    try {
      await api.deleteForecast(monthId);
    } catch (err) {
      setForecasts(previous);
      setError(err instanceof Error ? err.message : "Не удалось удалить план");
    }
  }

  const [noteLabel, notePlaceholder] = NOTE_LABEL[kind];
  const planLeft = (planned?.income || 0) - (planned?.expense || 0);

  return (
    <section className="finance">
      <div className="money-grid">
        <article className="stat-card money-income">
          <small>Доход</small>
          <strong>{formatMoney(income)}</strong>
          <span>пришло за месяц</span>
        </article>
        <article className="stat-card money-expense">
          <small>Расход</small>
          <strong>{formatMoney(expense)}</strong>
          <span>ушло за месяц</span>
        </article>
        <article className="stat-card money-saving">
          <small>Накопления</small>
          <strong>{formatMoney(savedAll)}</strong>
          <span>в этом месяце {formatMoney(savedMonth)}</span>
        </article>
      </div>

      <p className={`money-left ${left < 0 ? "is-over" : ""}`}>
        Осталось <strong>{formatMoney(left)}</strong>
        <span>доход минус расход и то, что отложила в этом месяце</span>
      </p>

      <form className="money-form panel" onSubmit={savePlan}>
        <h2>В будущем</h2>
        <p className="muted">Это ещё не пришло и не потрачено. Ожидаемый доход и примерный расход на {formatMonthYear(month)}.</p>
        {planReady ? (
          <>
            <div className="money-fields">
              <label className="field">
                Ожидаемый доход, сом
                <input inputMode="decimal" value={planIncome} onChange={(event) => setPlanIncome(event.target.value)} placeholder="20000" />
              </label>
              <label className="field">
                Примерный расход, сом
                <input inputMode="decimal" value={planExpense} onChange={(event) => setPlanExpense(event.target.value)} placeholder="8000" />
              </label>
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" className="btn" disabled={busy}>{busy ? "Сохраняю…" : "Сохранить план"}</button>
          </>
        ) : (
          <p className="muted">На прошлый месяц план не пишется. Переключись на этот месяц или на следующий.</p>
        )}
        {planned ? (
          <p className={`money-left ${planLeft < 0 ? "is-over" : ""}`}>
            Примерно останется <strong>{formatMoney(planLeft)}</strong>
            <span>ожидаемый доход минус примерный расход</span>
          </p>
        ) : null}
        {(forecasts || []).length ? (
          <ul className="forecast-list">
            {(forecasts || []).map((item) => {
              const when = parseISO(`${item.month}-01`);
              const rest = item.income - item.expense;
              return (
                <li key={item.month}>
                  <button type="button" className="forecast-open" onClick={() => setMonth(monthStart(when))}>
                    <b>{formatMonthYear(when)}</b>
                    <small>ждёшь {formatMoney(item.income)}, примерно уйдёт {formatMoney(item.expense)}, останется {formatMoney(rest)}</small>
                  </button>
                  <button type="button" className="icon-btn tiny" aria-label={`Удалить план на ${formatMonthYear(when)}`} onClick={() => removePlan(item.month)}>
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">Плана на будущее пока нет.</p>
        )}
      </form>

      <form className="money-form panel" onSubmit={addEntry}>
        <h2>Новая запись</h2>
        <div className="kind-row" role="radiogroup" aria-label="Тип записи">
          {KINDS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`kind-btn ${kind === item.id ? "on" : ""}`}
              aria-pressed={kind === item.id}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="muted">{KINDS.find((item) => item.id === kind)?.hint}</p>
        {kind === "expense" ? (
          <div className="spend-picks" role="radiogroup" aria-label="На что потратила">
            {SPEND.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`spend-pick ${category === item.id ? "on" : ""}`}
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="money-fields">
          <label className="field">
            Сумма, сом
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1500" required />
          </label>
          <label className="field">
            {noteLabel}
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={notePlaceholder} maxLength={80} />
          </label>
          <label className="field">
            Дата
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} required />
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Сохраняю…" : "Добавить"}</button>
      </form>

      <div className="panel money-list">
        <div className="week-nav">
          <button type="button" className="icon-btn" aria-label="Предыдущий месяц" onClick={() => setMonth((current) => addMonths(current, -1))}><Icon name="left" size={18} /></button>
          <strong>{formatMonthYear(month)}</strong>
          <button type="button" className="icon-btn" aria-label="Следующий месяц" onClick={() => setMonth((current) => addMonths(current, 1))}><Icon name="right" size={18} /></button>
        </div>

        <h2 className="spend-title">На что ушло</h2>
        {spend.length ? (
          <div className="spend-list">
            {spend.map((item) => {
              const share = expense ? Math.round((item.amount / expense) * 100) : 0;
              return (
                <div key={item.id} className="spend-row">
                  <span>{item.label}</span>
                  <div className="bar" role="meter" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100} aria-label={`${item.label}: ${share} процентов расходов`}>
                    <span style={{ width: `${share}%` }} />
                  </div>
                  <b>{formatMoney(item.amount)}</b>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Расходов в этом месяце ещё нет.</p>
        )}

        <h2 className="spend-title">Все записи</h2>
        {entries == null ? <p className="muted">Открываю записи…</p> : monthEntries.length ? (
          <ul>
            {monthEntries.map((entry) => {
              const title = entry.kind === "expense" ? spendLabel(entry.category) : (entry.note || KIND_LABEL[entry.kind]);
              const detail = entry.kind === "expense" && entry.note
                ? `${formatDayTitle(parseISO(entry.day))} · ${entry.note}`
                : formatDayTitle(parseISO(entry.day));
              return (
                <li key={entry.id} className={`money-row is-${entry.kind}`}>
                  <span className="money-kind">{KIND_LABEL[entry.kind]}</span>
                  <span>
                    <b>{title}</b>
                    <small>{detail}</small>
                  </span>
                  <strong>{entry.kind === "expense" ? "−" : "+"}{formatMoney(entry.amount)}</strong>
                  <button type="button" className="icon-btn tiny" aria-label={`Удалить ${title}`} onClick={() => remove(entry.id)}>
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">В этом месяце записей нет.</p>
        )}
      </div>
    </section>
  );
}
