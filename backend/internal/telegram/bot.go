package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"tracker/internal/store"
)

var moods = map[string]string{
	"тяжело":    "hard",
	"нормально": "ok",
	"хорошо":    "good",
	"отлично":   "great",
}

var moodTitle = map[string]string{
	"hard": "Тяжело", "ok": "Нормально", "good": "Хорошо", "great": "Отлично",
}

var (
	stateMu   sync.Mutex
	lastError string
)

func LastError() string {
	stateMu.Lock()
	defer stateMu.Unlock()
	return lastError
}

func setError(err string) {
	stateMu.Lock()
	lastError = err
	stateMu.Unlock()
}

func Run(ctx context.Context, db *store.Store) {
	client := &http.Client{Timeout: 40 * time.Second}
	for {
		if ctx.Err() != nil {
			return
		}
		cfg, err := db.Telegram(ctx)
		if err != nil {
			setError("не удалось прочитать настройки бота")
			sleep(ctx, 5*time.Second)
			continue
		}
		token := activeToken(cfg)
		if token == "" {
			setError("")
			sleep(ctx, 5*time.Second)
			continue
		}
		ensurePolling(ctx, client, token)
		maybeRemind(ctx, client, db, cfg, token)
		updates, err := getUpdates(ctx, client, token, cfg.UpdateOffset)
		if err != nil {
			setError(friendly(err, token))
			sleep(ctx, 8*time.Second)
			continue
		}
		setError("")
		for _, update := range updates {
			handle(ctx, client, db, token, update)
			if err := db.SaveTelegramOffset(ctx, int64(update.UpdateID)+1); err != nil {
				log.Printf("telegram offset: %v", err)
			}
		}
	}
}

var pollingToken string

func ensurePolling(ctx context.Context, client *http.Client, token string) {
	if pollingToken == token {
		return
	}
	var body struct {
		OK bool `json:"ok"`
	}
	if err := call(ctx, client, token, "deleteWebhook", map[string]any{"drop_pending_updates": false}, &body); err != nil {
		return
	}
	pollingToken = token
}

func friendly(err error, token string) string {
	msg := strings.ReplaceAll(err.Error(), token, "")
	lower := strings.ToLower(msg)
	switch {
	case strings.Contains(lower, "unauthorized"):
		return "токен не подошёл"
	case strings.Contains(lower, "conflict"):
		return "бот уже получает сообщения в другом месте"
	case strings.Contains(lower, "нет связи"):
		return "нет связи с Telegram"
	default:
		return "Telegram сейчас не отвечает"
	}
}

func activeToken(cfg store.TelegramConfig) string {
	if env := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN")); env != "" {
		return env
	}
	return strings.TrimSpace(cfg.Token)
}

func CheckToken(ctx context.Context, token string) (string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	var me struct {
		OK     bool `json:"ok"`
		Result struct {
			Username string `json:"username"`
		} `json:"result"`
		Description string `json:"description"`
	}
	if err := call(ctx, client, token, "getMe", nil, &me); err != nil {
		return "", err
	}
	if !me.OK || me.Result.Username == "" {
		if me.Description == "" {
			me.Description = "токен не подошёл"
		}
		return "", fmt.Errorf("%s", me.Description)
	}
	return me.Result.Username, nil
}

type update struct {
	UpdateID int `json:"update_id"`
	Message  *struct {
		Text string `json:"text"`
		Chat struct {
			ID   int64  `json:"id"`
			Type string `json:"type"`
		} `json:"chat"`
		From struct {
			Username string `json:"username"`
		} `json:"from"`
	} `json:"message"`
}

func getUpdates(ctx context.Context, client *http.Client, token string, offset int64) ([]update, error) {
	var body struct {
		OK          bool     `json:"ok"`
		Result      []update `json:"result"`
		Description string   `json:"description"`
	}
	payload := map[string]any{"timeout": 25, "offset": offset}
	if err := call(ctx, client, token, "getUpdates", payload, &body); err != nil {
		return nil, err
	}
	if !body.OK {
		if body.Description == "" {
			body.Description = "Telegram не ответил"
		}
		return nil, fmt.Errorf("%s", body.Description)
	}
	return body.Result, nil
}

func handle(ctx context.Context, client *http.Client, db *store.Store, token string, item update) {
	if item.Message == nil || item.Message.Chat.Type != "private" {
		return
	}
	cfg, err := db.Telegram(ctx)
	if err != nil {
		return
	}
	text := strings.TrimSpace(item.Message.Text)
	chatID := item.Message.Chat.ID
	linked := cfg.ChatID != nil && *cfg.ChatID == chatID

	if strings.HasPrefix(text, "/start") {
		code := strings.TrimSpace(strings.TrimPrefix(text, "/start"))
		code = strings.TrimPrefix(code, "@")
		if fields := strings.Fields(text); len(fields) > 1 {
			code = fields[1]
		}
		if cfg.LinkCode != "" && code == cfg.LinkCode {
			name := item.Message.From.Username
			if err := db.ConnectTelegram(ctx, chatID, name); err != nil {
				send(ctx, client, token, chatID, "Не удалось связать чат. Попробуй ещё раз из настроек.", false)
				return
			}
			send(ctx, client, token, chatID, "Готово. Я буду напоминать о делах и принимать отчёт за день.\n\n/today — что осталось сегодня\n/report — как прошёл день", false)
			return
		}
		if cfg.ChatID != nil && *cfg.ChatID == chatID {
			send(ctx, client, token, chatID, "Чат уже связан.\n\n/today — что осталось сегодня\n/report — как прошёл день", false)
			return
		}
		send(ctx, client, token, chatID, "Открой на сайте Настройки → Telegram и отправь мне команду с кодом.", false)
		return
	}

	if !linked {
		send(ctx, client, token, chatID, "Этот чат ещё не связан с планером. Возьми код в настройках сайта.", false)
		return
	}

	if mood, ok := moods[strings.ToLower(text)]; ok {
		saveMood(ctx, db, mood)
		_ = db.SetTelegramAwaitNote(ctx, true)
		send(ctx, client, token, chatID, "Записала: "+moodTitle[mood]+". Напиши пару слов о дне или /skip.", false)
		return
	}

	switch {
	case text == "/today" || strings.EqualFold(text, "дела"):
		send(ctx, client, token, chatID, todayMessage(ctx, db), false)
	case text == "/report" || strings.EqualFold(text, "отчёт") || strings.EqualFold(text, "отчет"):
		_ = db.SetTelegramAwaitNote(ctx, false)
		send(ctx, client, token, chatID, "Как прошёл день?", true)
	case text == "/skip":
		_ = db.SetTelegramAwaitNote(ctx, false)
		send(ctx, client, token, chatID, "Оставила без заметки.", false)
	case cfg.AwaitNote && text != "" && !strings.HasPrefix(text, "/"):
		saveNote(ctx, db, text)
		_ = db.SetTelegramAwaitNote(ctx, false)
		send(ctx, client, token, chatID, "Сохранила отчёт на сегодня.", false)
	default:
		send(ctx, client, token, chatID, "Команды: /today — дела на сегодня, /report — как прошёл день.", false)
	}
}

func saveMood(ctx context.Context, db *store.Store, mood string) {
	day := time.Now().Format("2006-01-02")
	existing, _, _ := db.DayNoteOn(ctx, day)
	_, err := db.SaveDayNote(ctx, store.DayNote{Day: day, Mood: mood, Note: existing.Note})
	if err != nil {
		log.Printf("telegram mood: %v", err)
	}
}

func saveNote(ctx context.Context, db *store.Store, text string) {
	day := time.Now().Format("2006-01-02")
	existing, ok, _ := db.DayNoteOn(ctx, day)
	mood := existing.Mood
	if !ok || mood == "" {
		mood = "ok"
	}
	_, err := db.SaveDayNote(ctx, store.DayNote{Day: day, Mood: mood, Note: text})
	if err != nil {
		log.Printf("telegram note: %v", err)
	}
}

func maybeRemind(ctx context.Context, client *http.Client, db *store.Store, cfg store.TelegramConfig, token string) {
	if !cfg.ReminderEnabled || cfg.ChatID == nil {
		return
	}
	now := time.Now()
	today := now.Format("2006-01-02")
	if cfg.LastReminder == today {
		return
	}
	clock, err := time.Parse("15:04", cfg.ReminderTime)
	if err != nil {
		return
	}
	due := time.Date(now.Year(), now.Month(), now.Day(), clock.Hour(), clock.Minute(), 0, 0, now.Location())
	if now.Before(due) {
		return
	}
	if err := send(ctx, client, token, *cfg.ChatID, todayMessage(ctx, db)+"\n\nКак прошёл день — /report", false); err != nil {
		log.Printf("telegram reminder: %v", err)
		return
	}
	if err := db.MarkTelegramReminder(ctx, today); err != nil {
		log.Printf("telegram reminder mark: %v", err)
	}
}

func todayMessage(ctx context.Context, db *store.Store) string {
	state, err := db.Load(ctx)
	if err != nil {
		return "Не удалось открыть задачи."
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	iso := today.Format("2006-01-02")
	var open, done []string
	for _, task := range state.Tasks {
		if !scheduled(task, today) {
			continue
		}
		if state.Completions[task.ID+"|"+iso] {
			done = append(done, task.Icon+" "+task.Name)
		} else {
			open = append(open, "• "+task.Icon+" "+task.Name)
		}
	}
	hours := hourLines(ctx, db, int(today.Weekday()))
	if len(open) == 0 && len(done) == 0 && hours == "" {
		return "На сегодня ничего не запланировано."
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Сегодня, %d %s\n", today.Day(), monthName(today.Month()))
	if len(open) == 0 && len(done) == 0 {
		b.WriteString("Привычек на сегодня нет.")
	} else if len(open) == 0 {
		b.WriteString("Всё отмечено.")
	} else {
		b.WriteString("Осталось:\n")
		b.WriteString(strings.Join(open, "\n"))
	}
	if len(done)+len(open) > 0 {
		fmt.Fprintf(&b, "\n\nСделано %d из %d.", len(done), len(done)+len(open))
	}
	b.WriteString(hours)
	return b.String()
}

func hourLines(ctx context.Context, db *store.Store, weekday int) string {
	plan, err := db.ListHourTasks(ctx)
	if err != nil {
		return ""
	}
	var lines []string
	for _, task := range plan.Tasks {
		if task.Weekday != weekday {
			continue
		}
		lines = append(lines, "• "+task.Name+" — до "+task.Until)
	}
	if len(lines) == 0 {
		return ""
	}
	return "\n\nПо часам:\n" + strings.Join(lines, "\n")
}

func scheduled(task store.Task, day time.Time) bool {
	iso := day.Format("2006-01-02")
	if task.StartDate == "" || iso < task.StartDate {
		return false
	}
	if task.EndDate != nil && *task.EndDate != "" && iso > *task.EndDate {
		return false
	}
	dow := int(day.Weekday())
	switch task.Repeat {
	case "daily":
		return true
	case "weekdays":
		return dow >= 1 && dow <= 5
	case "weekends":
		return dow == 0 || dow == 6
	case "once":
		return iso == task.StartDate
	case "custom":
		for _, item := range task.Days {
			if item == dow {
				return true
			}
		}
		return false
	default:
		return false
	}
}

func monthName(month time.Month) string {
	names := []string{"", "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"}
	if int(month) < len(names) {
		return names[month]
	}
	return ""
}

func send(ctx context.Context, client *http.Client, token string, chatID int64, text string, withMoods bool) error {
	payload := map[string]any{"chat_id": chatID, "text": text}
	if withMoods {
		payload["reply_markup"] = map[string]any{
			"keyboard":          [][]string{{"Тяжело", "Нормально"}, {"Хорошо", "Отлично"}},
			"resize_keyboard":   true,
			"one_time_keyboard": true,
		}
	} else {
		payload["reply_markup"] = map[string]any{"remove_keyboard": true}
	}
	var body struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := call(ctx, client, token, "sendMessage", payload, &body); err != nil {
		return err
	}
	if !body.OK {
		if body.Description == "" {
			body.Description = "не удалось отправить сообщение"
		}
		return fmt.Errorf("%s", body.Description)
	}
	return nil
}

func call(ctx context.Context, client *http.Client, token, method string, payload any, dest any) error {
	var reader io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.telegram.org/bot"+token+"/"+method, reader)
	if err != nil {
		return err
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("нет связи с Telegram")
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return err
	}
	if err := json.Unmarshal(raw, dest); err != nil {
		return fmt.Errorf("Telegram ответил не так, как ожидалось")
	}
	return nil
}

func sleep(ctx context.Context, d time.Duration) {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}
