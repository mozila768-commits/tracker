import { useEffect, useState, type FormEvent } from "react";
import { api, type DayMood, type DayNote } from "./api";
import { formatDayTitle, parseISO } from "./logic";

const MOODS: { id: DayMood; label: string }[] = [
  { id: "hard", label: "Тяжело" },
  { id: "ok", label: "Нормально" },
  { id: "good", label: "Хорошо" },
  { id: "great", label: "Отлично" },
];

const EVENT = "tracker-day-note";

function moodLabel(id: string) {
  return MOODS.find((item) => item.id === id)?.label || "День";
}

export function DayReview({ iso, locked = false, history = false, onOpen }: { iso: string; locked?: boolean; history?: boolean; onOpen?: (iso: string) => void }) {
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [mood, setMood] = useState<DayMood | "">("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stop = false;
    api.dayNotes().then((rows) => {
      if (!stop) {
        setNotes(rows);
        setReady(true);
      }
    }).catch((err) => {
      if (!stop) setError(err instanceof Error ? err.message : "Не удалось открыть итог дня");
    });
    const onNote = (event: Event) => {
      const note = (event as CustomEvent<DayNote>).detail;
      setNotes((current) => [note, ...current.filter((item) => item.day !== note.day)]);
    };
    window.addEventListener(EVENT, onNote);
    return () => {
      stop = true;
      window.removeEventListener(EVENT, onNote);
    };
  }, []);

  useEffect(() => {
    const current = notes.find((item) => item.day === iso);
    setMood(current?.mood || "");
    setText(current?.note || "");
    setSaved(false);
    setError("");
  }, [iso, ready]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!mood) {
      setError("Выбери, как прошёл день.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const note = await api.saveDayNote({ day: iso, mood, note: text.trim(), updatedAt: 0 });
      setNotes((current) => [note, ...current.filter((item) => item.day !== note.day)]);
      setSaved(true);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: note }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const title = formatDayTitle(parseISO(iso));

  const past = [...notes].sort((a, b) => (a.day < b.day ? 1 : -1));

  return (
    <section className="day-review-block">
    <form className="panel day-review" onSubmit={save}>
      <div className="day-review-head">
        <h2>Как прошёл день</h2>
        <p>{title}</p>
      </div>
      {locked ? (
        <p className="muted">Этот день можно описать, когда он наступит.</p>
      ) : (
        <>
          <div className="mood-row" role="radiogroup" aria-label="Как прошёл день">
            {MOODS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`mood-btn is-${item.id} ${mood === item.id ? "on" : ""}`}
                aria-pressed={mood === item.id}
                onClick={() => {
                  setMood(item.id);
                  setSaved(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="field">
            Пара слов
            <textarea
              value={text}
              maxLength={280}
              rows={3}
              placeholder="Что запомнилось, что получилось, что утомило"
              onChange={(event) => {
                setText(event.target.value);
                setSaved(false);
              }}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="day-review-actions">
            <button type="submit" className="btn" disabled={busy || !ready}>{busy ? "Сохраняю…" : "Сохранить"}</button>
            {saved ? <span className="muted">Сохранено</span> : null}
          </div>
        </>
      )}
    </form>
    {history ? (
      <div className="panel day-history">
        <h2>Как прошли дни</h2>
        <p className="muted">Здесь остаются итоги прошлых дней. Нажми на день, чтобы открыть его.</p>
        {past.length ? (
          <ul>
            {past.map((item) => (
              <li key={item.day}>
                <button type="button" className={`day-history-row is-${item.mood}`} onClick={() => onOpen?.(item.day)}>
                  <span>{formatDayTitle(parseISO(item.day))}</span>
                  <b>{moodLabel(item.mood)}</b>
                  <small>{item.note || "Без заметки"}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Пока пусто. Сохрани сегодняшний итог — он появится в этом списке.</p>
        )}
      </div>
    ) : null}
    </section>
  );
}
