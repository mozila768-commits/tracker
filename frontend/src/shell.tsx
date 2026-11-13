import { Icon } from "./icons";
import { PageView, Topbar } from "./pages";
import { ConfirmDialog, DayDrawer, TaskModal } from "./overlays";
import type { Page, TrackerContext } from "./types";

const NAV: [Page, string, string][] = [
  ["dashboard", "Главная", "grid"],
  ["tasks", "Задачи", "tasks"],
  ["hours", "Часы", "clock"],
  ["habits", "Привычки", "habits"],
  ["calendar", "Календарь", "calendar"],
  ["statistics", "Статистика", "chart"],
  ["achievements", "Достижения", "trophy"],
  ["finance", "Финансы", "wallet"],
  ["settings", "Настройки", "settings"],
];

const TABS: [Page, string, string][] = [
  ["dashboard", "Главная", "grid"],
  ["tasks", "Задачи", "tasks"],
  ["hours", "Часы", "clock"],
  ["habits", "Привычки", "habits"],
  ["calendar", "План", "calendar"],
  ["statistics", "Статы", "chart"],
  ["achievements", "Награды", "trophy"],
  ["finance", "Деньги", "wallet"],
  ["settings", "Настр.", "settings"],
];

export function Shell({ ctx }: { ctx: TrackerContext }) {
  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <button type="button" className="brand" onClick={() => ctx.actions.nav("dashboard")}>
            <span className="mark" aria-hidden="true"><Icon name="tasks" size={16} /></span>
            <span className="brand-name">ТРЕКЕР<br />ЖИЗНИ</span>
          </button>
          <nav className="side-nav" aria-label="Основное">
            {NAV.map(([id, label, glyph]) => (
              <button type="button" key={id} className={`nav-btn ${ctx.ui.page === id ? "on" : ""}`} onClick={() => ctx.actions.nav(id)}>
                <Icon name={glyph} size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="side-foot">
            <button type="button" className="side-stat" onClick={() => ctx.actions.nav("statistics")}>
              <span aria-hidden="true">🔥</span>
              <span><strong>{ctx.stats.streak}</strong><small>Серия</small></span>
            </button>
            <button type="button" className="side-stat" onClick={() => ctx.actions.nav("statistics")}>
              <span aria-hidden="true">⭐</span>
              <span><strong>{ctx.stats.xp.toLocaleString("ru-RU")}</strong><small>Всего XP</small></span>
            </button>
          </div>
        </aside>
        <main className={`main ${ctx.ui.enter ? "is-enter" : ""}`}>
          <div className="page">
            {ctx.ui.page === "dashboard" ? null : <Topbar ctx={ctx} />}
            <PageView ctx={ctx} />
          </div>
        </main>
        <nav className="tabbar" aria-label="Основное">
          {TABS.map(([id, label, glyph]) => (
            <button type="button" key={id} className={`tab ${ctx.ui.page === id ? "on" : ""}`} onClick={() => ctx.actions.nav(id)}>
              <Icon name={glyph} size={18} />
              <small>{label}</small>
            </button>
          ))}
        </nav>
      </div>
      {ctx.ui.day ? <DayDrawer ctx={ctx} iso={ctx.ui.day} /> : null}
      {ctx.ui.modal ? <TaskModal ctx={ctx} /> : null}
      {ctx.ui.confirm ? <ConfirmDialog ctx={ctx} /> : null}
    </>
  );
}


