import { useEffect, useState } from "react";
import { api, type TelegramStatus } from "./api";

export function TelegramPanel() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [token, setToken] = useState("");
  const [time, setTime] = useState("20:00");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.telegram().then((next) => {
      setStatus(next);
      setTime(next.reminderTime || "20:00");
      setEnabled(next.reminderEnabled);
    }).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!status?.linkCode || status.connected) return;
    const timer = window.setInterval(() => {
      api.telegram().then((next) => {
        setStatus(next);
        if (next.connected) setCopied(false);
      }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [status?.linkCode, status?.connected]);

  async function run(action: () => Promise<TelegramStatus>) {
    setBusy(true);
    setError("");
    try {
      const next = await action();
      setStatus(next);
      setTime(next.reminderTime || "20:00");
      setEnabled(next.reminderEnabled);
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const bot = status?.botName ? `@${status.botName}` : "бота";

  return (
    <section className="panel telegram-panel">
      <h2>Telegram</h2>
      <p className="panel-copy">Бот напомнит о делах и примет короткий отчёт за день. Сообщение приходит один раз в выбранное время.</p>
      {!status ? <p className="panel-copy">Загружаю…</p> : (
        <>
          <ol className="tg-steps">
            <li>В Telegram открой <strong>@BotFather</strong>, отправь <strong>/newbot</strong> и скопируй токен.</li>
            <li>Вставь токен сюда. Сайт его больше не показывает.</li>
            <li>Нажми «Создать код» и отправь боту команду <strong>/start</strong> с этим кодом.</li>
          </ol>
          {status.connected ? (
            <p className="tg-state">Связано{status.username ? ` с @${status.username}` : ""}{status.botName ? ` · бот @${status.botName}` : ""}.</p>
          ) : status.tokenSet ? (
            <p className="tg-state">Токен сохранён{status.botName ? `, бот @${status.botName}` : ""}. Чат ещё не связан.</p>
          ) : (
            <p className="tg-state">Токен ещё не сохранён.</p>
          )}
          {status.tokenFromEnv ? <p className="panel-copy">Токен задан на сервере, вставлять его здесь не нужно.</p> : (
            <form className="settings-form" onSubmit={(event) => {
              event.preventDefault();
              if (!token.trim()) {
                setError("Вставь токен от @BotFather");
                return;
              }
              void run(() => api.saveTelegram({ token: token.trim(), reminderTime: time, reminderEnabled: enabled }));
            }}>
              <label className="field">
                <span>Токен бота</span>
                <input name="token" type="password" autoComplete="off" value={token} placeholder="123456:ABC…" onChange={(event) => setToken(event.target.value)} />
              </label>
              <button type="submit" className="btn" disabled={busy}>Сохранить токен</button>
              {status.tokenSet && <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => api.saveTelegram({ clearToken: true, reminderTime: time, reminderEnabled: enabled }))}>Убрать токен</button>}
            </form>
          )}
          <form className="settings-form" onSubmit={(event) => {
            event.preventDefault();
            void run(() => api.saveTelegram({ reminderTime: time, reminderEnabled: enabled }));
          }}>
            <label className="field">
              <span>Напоминание</span>
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
            <label className="tg-check">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              <span>Присылать каждый день</span>
            </label>
            <button type="submit" className="btn ghost" disabled={busy}>Сохранить время</button>
          </form>
          {status.linkCode && !status.connected && (
            <div className="tg-code-box">
              <span>Напиши {bot === "бота" ? "боту" : bot}</span>
              <strong className="tg-code">/start {status.linkCode}</strong>
              <button type="button" className="btn ghost" onClick={() => {
                void navigator.clipboard?.writeText(`/start ${status.linkCode}`).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}>{copied ? "Скопировано" : "Скопировать"}</button>
              <p className="panel-copy">Жду сообщение в Telegram…</p>
            </div>
          )}
          <div className="settings-actions">
            <button type="button" className="btn" disabled={busy || !status.tokenSet} onClick={() => void run(() => api.telegramLink())}>Создать код</button>
            {status.connected && <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => api.telegramUnlink())}>Отвязать чат</button>}
          </div>
          <p className="panel-copy">В чате: <strong>/today</strong> — что осталось сегодня, <strong>/report</strong> — настроение и пара слов. Отчёт попадает в «Как прошёл день».</p>
          {status.lastError && <p className="form-error">{status.lastError}</p>}
          {error && <p className="form-error">{error}</p>}
        </>
      )}
    </section>
  );
}
