import { useState } from "react";
import { CATEGORIES, COLOR_SWATCHES, ICON_CHOICES } from "./logic";
import { Icon } from "./icons";
import { DayPanel } from "./pages";
import { formatDayTitle, parseISO } from "./logic";
import type { Task } from "./api";
import type { TrackerContext } from "./types";

const DAY_LABELS: [number, string, string][] = [
  [1, "Пн", "Понедельник"],
  [2, "Вт", "Вторник"],
  [3, "Ср", "Среда"],
  [4, "Чт", "Четверг"],
  [5, "Пт", "Пятница"],
  [6, "Сб", "Суббота"],
  [0, "Вс", "Воскресенье"],
];

const CATEGORY_ICONS: Record<string, string> = {
  study: "📚",
  work: "💻",
  sport: "🏃",
  health: "💧",
  reading: "📖",
  creative: "🎨",
  personal: "⭐",
  finance: "💰",
};

export function DayDrawer({ ctx, iso }: { ctx: TrackerContext; iso: string }) {
  return (
    <>
      <div className="drawer-back" onClick={ctx.actions.closeDay} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={formatDayTitle(parseISO(iso))}>
        <button type="button" className="icon-btn drawer-close" aria-label="Закрыть" onClick={ctx.actions.closeDay}><Icon name="close" size={18} /></button>
        <DayPanel ctx={ctx} iso={iso} />
      </aside>
    </>
  );
}

export function ConfirmDialog({ ctx }: { ctx: TrackerContext }) {
  const confirm = ctx.ui.confirm;
  if (!confirm) return null;
  const presets = {
    erase: {
      title: "Стереть все данные?",
      body: "Задачи, привычки, короткие дела, XP, значки, финансы и итоги дней пропадут из базы.",
      ok: "Стереть",
      run: ctx.actions.confirmErase,
    },
    delete: {
      title: `Удалить «${confirm.name}»?`,
      body: "Отметки этой задачи исчезнут, и её XP уйдёт из общего счёта.",
      ok: "Удалить",
      run: ctx.actions.confirmDelete,
    },
  };
  const preset = presets[confirm.kind];
  return (
    <div className="overlay confirm" onClick={(event) => { if (event.target === event.currentTarget) ctx.actions.closeConfirm(); }}>
      <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{preset.title}</h2>
        <p>{preset.body}</p>
        <footer className="modal-actions">
          <span />
          <div className="modal-actions-right">
            <button type="button" className="btn ghost" onClick={ctx.actions.closeConfirm}>Отмена</button>
            <button type="button" className="btn danger" onClick={preset.run}>{preset.ok}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function TaskModal({ ctx }: { ctx: TrackerContext }) {
  const modal = ctx.ui.modal;
  if (!modal) return null;
  const editing = modal.mode === "edit" ? ctx.tasks.find((task) => task.id === modal.id) : null;
  const task: Task = editing || {
    id: "",
    name: "",
    category: modal.isHabit ? "health" : "study",
    icon: modal.isHabit ? "💧" : "📚",
    color: COLOR_SWATCHES[0],
    difficulty: "normal",
    repeat: "daily",
    days: [1, 2, 3, 4, 5],
    startDate: modal.presetDate || `${ctx.today.getFullYear()}-${String(ctx.today.getMonth() + 1).padStart(2, "0")}-${String(ctx.today.getDate()).padStart(2, "0")}`,
    endDate: "",
    isHabit: !!modal.isHabit,
    createdAt: 0,
  } as Task;
  const [repeat, setRepeat] = useState(task.repeat);
  const [iconTouched, setIconTouched] = useState(false);
  const [error, setError] = useState("");
  const todayISO = `${ctx.today.getFullYear()}-${String(ctx.today.getMonth() + 1).padStart(2, "0")}-${String(ctx.today.getDate()).padStart(2, "0")}`;
  if (!editing && !modal.presetDate) task.startDate = todayISO;

  return (
    <div className="overlay" onClick={(event) => { if (event.target === event.currentTarget) ctx.actions.closeModal(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" autoComplete="off" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        const days = fd.getAll("days").map(Number);
        const message = ctx.actions.saveTask({
          id: String(fd.get("id") || ""),
          name: String(fd.get("name") || ""),
          icon: String(fd.get("icon") || task.icon),
          category: String(fd.get("category") || task.category),
          color: String(fd.get("color") || task.color),
          difficulty: String(fd.get("difficulty") || "normal") === "hard" ? "hard" : "normal",
          repeat: String(fd.get("repeat") || "daily") as Task["repeat"],
          days,
          startDate: String(fd.get("startDate") || todayISO),
          endDate: String(fd.get("endDate") || "") || null,
          isHabit: fd.get("habit") === "on",
          createdAt: Number(fd.get("createdAt")) || Date.now(),
        });
        if (message) setError(message);
      }}>
        <header className="modal-head">
          <h2 id="modal-title">{editing ? "Изменить задачу" : modal.isHabit ? "Новая привычка" : "Новая задача"}</h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={ctx.actions.closeModal}><Icon name="close" size={18} /></button>
        </header>
        <input type="hidden" name="id" defaultValue={task.id} />
        <input type="hidden" name="createdAt" defaultValue={task.createdAt || ""} />
        <label className="field">
          <span>Название</span>
          <input name="name" maxLength={40} required placeholder="Учёба, вода, тренировка…" defaultValue={task.name} />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Категория</span>
            <select name="category" defaultValue={task.category} onChange={(event) => {
              if (iconTouched) return;
              const next = CATEGORY_ICONS[event.target.value];
              const radio = event.currentTarget.form?.querySelector<HTMLInputElement>(`input[name="icon"][value="${next}"]`);
              if (radio) radio.checked = true;
            }}>
              {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Повтор</span>
            <select name="repeat" value={repeat} onChange={(event) => setRepeat(event.target.value as Task["repeat"])}>
              <option value="daily">Каждый день</option>
              <option value="weekdays">Будни</option>
              <option value="weekends">Выходные</option>
              <option value="custom">Свои дни</option>
              <option value="once">Один раз</option>
            </select>
          </label>
        </div>
        <div className="custom-days" hidden={repeat !== "custom"}>
          <span>Дни</span>
          <div className="daypicks">
            {DAY_LABELS.map(([value, label, title]) => (
              <label className="daypick" title={title} key={value}>
                <input type="checkbox" name="days" value={value} defaultChecked={task.days?.includes(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Иконка</span>
          <div className="icon-grid">
            {ICON_CHOICES.map((item) => (
              <label className="icon-opt" key={item}>
                <input type="radio" name="icon" value={item} defaultChecked={item === task.icon} onChange={() => setIconTouched(true)} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Цвет</span>
          <div className="color-row">
            {COLOR_SWATCHES.map((color) => (
              <label className="color-opt" key={color}>
                <input type="radio" name="color" value={color} defaultChecked={color === task.color} />
                <span style={{ background: color }} />
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Сложность</span>
          <div className="seg">
            <label><input type="radio" name="difficulty" value="normal" defaultChecked={task.difficulty !== "hard"} /><span>Обычная · +10 XP</span></label>
            <label><input type="radio" name="difficulty" value="hard" defaultChecked={task.difficulty === "hard"} /><span>Сложная · +20 XP</span></label>
          </div>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Начало</span>
            <input type="date" name="startDate" required defaultValue={task.startDate} />
          </label>
          <label className="field">
            <span>Конец</span>
            <input type="date" name="endDate" defaultValue={task.endDate || ""} />
          </label>
        </div>
        <label className="checkline">
          <input type="checkbox" name="habit" defaultChecked={task.isHabit} />
          <span>Показывать в привычках</span>
        </label>
        <p className="form-error" role="alert">{error}</p>
        <footer className="modal-actions">
          {editing ? <button type="button" className="btn danger" onClick={() => ctx.actions.deleteAsk(task.id)}>Удалить</button> : <span />}
          <div className="modal-actions-right">
            <button type="button" className="btn ghost" onClick={ctx.actions.closeModal}>Отмена</button>
            <button type="submit" className="btn">{editing ? "Сохранить" : "Добавить"}</button>
          </div>
        </footer>
      </form>
    </div>
  );
}
