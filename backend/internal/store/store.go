package store

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var dateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

var categories = map[string]bool{
	"study": true, "work": true, "sport": true, "health": true,
	"reading": true, "creative": true, "personal": true, "finance": true,
}

var icons = map[string]bool{
	"📚": true, "💻": true, "🏃": true, "🧘": true, "📖": true, "🎨": true, "💧": true, "⭐": true,
	"🌙": true, "🥗": true, "📝": true, "🎯": true, "🧠": true, "💪": true, "☀️": true, "🎧": true,
	"✍️": true, "🧹": true, "🚶": true, "🍎": true, "💤": true, "🌿": true, "✨": true, "❤️": true, "💰": true,
}

var colors = map[string]bool{
	"#E9B7BD": true, "#F4D6D9": true, "#BFD4E8": true, "#DDEAF4": true,
	"#DDD0EA": true, "#D7EFE4": true, "#F6E3C5": true, "#F3C7BE": true,
}

var repeats = map[string]bool{
	"daily": true, "weekdays": true, "weekends": true, "custom": true, "once": true,
}

var spendCategories = map[string]bool{
	"food": true, "transport": true, "home": true, "study": true, "health": true,
	"clothes": true, "phone": true, "fun": true, "other": true,
}

var achievements = map[string]bool{
	"first-task": true, "ten-tasks": true, "fifty-tasks": true,
	"xp-100": true, "xp-500": true,
	"streak-3": true, "streak-7": true, "streak-14": true, "streak-30": true,
	"perfect-day": true, "perfect-week": true, "level-5": true,
}

type Task struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Icon       string  `json:"icon"`
	Category   string  `json:"category"`
	Color      string  `json:"color"`
	Difficulty string  `json:"difficulty"`
	Repeat     string  `json:"repeat"`
	Days       []int   `json:"days"`
	StartDate  string  `json:"startDate"`
	EndDate    *string `json:"endDate"`
	IsHabit    bool    `json:"isHabit"`
	CreatedAt  int64   `json:"createdAt"`
}

type Settings struct {
	Name         string `json:"name"`
	WeekStartsOn int    `json:"weekStartsOn"`
}

type State struct {
	Tasks        []Task          `json:"tasks"`
	Completions  map[string]bool `json:"completions"`
	Settings     Settings        `json:"settings"`
	Unlocked     []string        `json:"unlocked"`
	Initialized  bool            `json:"initialized"`
}

type Store struct {
	pool *pgxpool.Pool
}

func Connect(ctx context.Context, dsn string) (*Store, error) {
	var last error
	for i := 0; i < 30; i++ {
		pool, err := pgxpool.New(ctx, dsn)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				return &Store{pool: pool}, nil
			}
			pool.Close()
		}
		last = err
		time.Sleep(time.Second)
	}
	return nil, fmt.Errorf("postgres: %w", last)
}

func (s *Store) Close() { s.pool.Close() }

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS settings (
			id int PRIMARY KEY CHECK (id = 1),
			name text NOT NULL,
			week_starts_on int NOT NULL,
			initialized boolean NOT NULL DEFAULT false
		);
		INSERT INTO settings (id, name, week_starts_on, initialized)
		VALUES (1, 'Аделя', 1, false)
		ON CONFLICT (id) DO NOTHING;
		CREATE TABLE IF NOT EXISTS tasks (
			id text PRIMARY KEY,
			name text NOT NULL,
			icon text NOT NULL,
			category text NOT NULL,
			color text NOT NULL,
			difficulty text NOT NULL,
			repeat text NOT NULL,
			days int[] NOT NULL DEFAULT '{}',
			start_date date NOT NULL,
			end_date date,
			is_habit boolean NOT NULL,
			created_at bigint NOT NULL,
			position int NOT NULL
		);
		CREATE TABLE IF NOT EXISTS completions (
			task_id text NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
			day date NOT NULL,
			PRIMARY KEY (task_id, day)
		);
		CREATE TABLE IF NOT EXISTS achievements (
			id text PRIMARY KEY
		);
		CREATE TABLE IF NOT EXISTS ledger (
			id text PRIMARY KEY,
			kind text NOT NULL,
			amount bigint NOT NULL,
			note text NOT NULL DEFAULT '',
			category text NOT NULL DEFAULT '',
			day date NOT NULL,
			created_at bigint NOT NULL
		);
		ALTER TABLE ledger ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
		CREATE TABLE IF NOT EXISTS day_notes (
			day date PRIMARY KEY,
			mood text NOT NULL,
			note text NOT NULL DEFAULT '',
			updated_at bigint NOT NULL
		);
		CREATE TABLE IF NOT EXISTS telegram (
			id int PRIMARY KEY CHECK (id = 1),
			token text NOT NULL DEFAULT '',
			chat_id bigint,
			username text NOT NULL DEFAULT '',
			bot_name text NOT NULL DEFAULT '',
			reminder_time text NOT NULL DEFAULT '20:00',
			reminder_enabled boolean NOT NULL DEFAULT true,
			link_code text NOT NULL DEFAULT '',
			last_reminder date,
			await_note boolean NOT NULL DEFAULT false,
			update_offset bigint NOT NULL DEFAULT 0
		);
		INSERT INTO telegram (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
		CREATE TABLE IF NOT EXISTS hour_tasks (
			id text PRIMARY KEY,
			weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
			name text NOT NULL,
			until_time text NOT NULL,
			position int NOT NULL,
			created_at bigint NOT NULL
		);
		CREATE TABLE IF NOT EXISTS hour_done (
			task_id text NOT NULL REFERENCES hour_tasks(id) ON DELETE CASCADE,
			day date NOT NULL,
			PRIMARY KEY (task_id, day)
		);
		CREATE TABLE IF NOT EXISTS forecasts (
			month date PRIMARY KEY,
			income bigint NOT NULL,
			expense bigint NOT NULL
		);
	`)
	return err
}

func (s *Store) Load(ctx context.Context) (State, error) {
	state := State{
		Tasks:       []Task{},
		Completions: map[string]bool{},
		Unlocked:    []string{},
		Settings:    Settings{Name: "Аделя", WeekStartsOn: 1},
	}
	err := s.pool.QueryRow(ctx, `SELECT name, week_starts_on, initialized FROM settings WHERE id = 1`).
		Scan(&state.Settings.Name, &state.Settings.WeekStartsOn, &state.Initialized)
	if err != nil {
		return state, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, name, icon, category, color, difficulty, repeat, days, start_date, end_date, is_habit, created_at
		FROM tasks ORDER BY position, id`)
	if err != nil {
		return state, err
	}
	defer rows.Close()
	for rows.Next() {
		var task Task
		var days []int32
		var start time.Time
		var end *time.Time
		if err := rows.Scan(&task.ID, &task.Name, &task.Icon, &task.Category, &task.Color, &task.Difficulty, &task.Repeat, &days, &start, &end, &task.IsHabit, &task.CreatedAt); err != nil {
			return state, err
		}
		task.Days = make([]int, len(days))
		for i, day := range days {
			task.Days[i] = int(day)
		}
		task.StartDate = start.Format("2006-01-02")
		if end != nil {
			value := end.Format("2006-01-02")
			task.EndDate = &value
		}
		state.Tasks = append(state.Tasks, task)
	}
	if err := rows.Err(); err != nil {
		return state, err
	}

	comp, err := s.pool.Query(ctx, `SELECT task_id, day FROM completions`)
	if err != nil {
		return state, err
	}
	defer comp.Close()
	for comp.Next() {
		var id string
		var day time.Time
		if err := comp.Scan(&id, &day); err != nil {
			return state, err
		}
		state.Completions[id+"|"+day.Format("2006-01-02")] = true
	}
	if err := comp.Err(); err != nil {
		return state, err
	}

	ach, err := s.pool.Query(ctx, `SELECT id FROM achievements ORDER BY id`)
	if err != nil {
		return state, err
	}
	defer ach.Close()
	for ach.Next() {
		var id string
		if err := ach.Scan(&id); err != nil {
			return state, err
		}
		state.Unlocked = append(state.Unlocked, id)
	}
	return state, ach.Err()
}

func (s *Store) SaveSettings(ctx context.Context, settings Settings) (Settings, error) {
	settings = cleanSettings(settings)
	err := s.pool.QueryRow(ctx, `
		UPDATE settings SET name = $1, week_starts_on = $2 WHERE id = 1
		RETURNING name, week_starts_on`, settings.Name, settings.WeekStartsOn).
		Scan(&settings.Name, &settings.WeekStartsOn)
	return settings, err
}

func (s *Store) SaveTask(ctx context.Context, raw Task) (Task, error) {
	task, err := sanitizeTask(raw, "")
	if err != nil {
		return Task{}, err
	}
	var count int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM tasks WHERE id <> $1`, task.ID).Scan(&count); err != nil {
		return Task{}, err
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)`, task.ID).Scan(&exists); err != nil {
		return Task{}, err
	}
	if !exists && count >= 80 {
		return Task{}, errors.New("слишком много задач")
	}
	days := make([]int32, len(task.Days))
	for i, day := range task.Days {
		days[i] = int32(day)
	}
	if exists {
		_, err = s.pool.Exec(ctx, `
			UPDATE tasks SET name=$2, icon=$3, category=$4, color=$5, difficulty=$6, repeat=$7, days=$8,
				start_date=$9::date, end_date=NULLIF($10, '')::date, is_habit=$11
			WHERE id=$1`,
			task.ID, task.Name, task.Icon, task.Category, task.Color, task.Difficulty, task.Repeat, days,
			task.StartDate, endOrEmpty(task.EndDate), task.IsHabit)
	} else {
		_, err = s.pool.Exec(ctx, `
			INSERT INTO tasks (id, name, icon, category, color, difficulty, repeat, days, start_date, end_date, is_habit, created_at, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date, NULLIF($10, '')::date, $11, $12, (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks))`,
			task.ID, task.Name, task.Icon, task.Category, task.Color, task.Difficulty, task.Repeat, days,
			task.StartDate, endOrEmpty(task.EndDate), task.IsHabit, task.CreatedAt)
	}
	return task, err
}

func (s *Store) DeleteTask(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("задача не найдена")
	}
	return nil
}

func (s *Store) Toggle(ctx context.Context, taskID, day string) (bool, error) {
	if !dateRe.MatchString(day) {
		return false, errors.New("неверная дата")
	}
	parsed, err := time.ParseInLocation("2006-01-02", day, time.Local)
	if err != nil {
		return false, errors.New("неверная дата")
	}
	today := time.Now()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.Local)
	if parsed.After(today) {
		return false, errors.New("этот день ещё не наступил")
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)`, taskID).Scan(&exists); err != nil {
		return false, err
	}
	if !exists {
		return false, errors.New("задача не найдена")
	}
	var done bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM completions WHERE task_id = $1 AND day = $2::date)`, taskID, day).Scan(&done); err != nil {
		return false, err
	}
	if done {
		_, err = s.pool.Exec(ctx, `DELETE FROM completions WHERE task_id = $1 AND day = $2::date`, taskID, day)
		return false, err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO completions (task_id, day) VALUES ($1, $2::date)`, taskID, day)
	return true, err
}

func (s *Store) Unlock(ctx context.Context, ids []string) ([]string, error) {
	for _, id := range ids {
		if !achievements[id] {
			continue
		}
		if _, err := s.pool.Exec(ctx, `INSERT INTO achievements (id) VALUES ($1) ON CONFLICT DO NOTHING`, id); err != nil {
			return nil, err
		}
	}
	state, err := s.Load(ctx)
	if err != nil {
		return nil, err
	}
	return state.Unlocked, nil
}

func (s *Store) Seed(ctx context.Context, raw State) (State, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return State{}, err
	}
	defer tx.Rollback(ctx)
	var initialized bool
	if err := tx.QueryRow(ctx, `SELECT initialized FROM settings WHERE id = 1 FOR UPDATE`).Scan(&initialized); err != nil {
		return State{}, err
	}
	if initialized {
		if err := tx.Commit(ctx); err != nil {
			return State{}, err
		}
		return s.Load(ctx)
	}
	if err := writeState(ctx, tx, raw, true); err != nil {
		return State{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return State{}, err
	}
	return s.Load(ctx)
}

func (s *Store) Replace(ctx context.Context, raw State) (State, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return State{}, err
	}
	defer tx.Rollback(ctx)
	if err := writeState(ctx, tx, raw, true); err != nil {
		return State{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return State{}, err
	}
	return s.Load(ctx)
}

func writeState(ctx context.Context, tx pgx.Tx, raw State, initialized bool) error {
	tasks := make([]Task, 0, len(raw.Tasks))
	seen := map[string]bool{}
	for _, item := range raw.Tasks {
		task, err := sanitizeTask(item, "")
		if err != nil {
			continue
		}
		if seen[task.ID] {
			continue
		}
		seen[task.ID] = true
		tasks = append(tasks, task)
		if len(tasks) == 80 {
			break
		}
	}
	settings := cleanSettings(raw.Settings)
	if _, err := tx.Exec(ctx, `DELETE FROM achievements`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM tasks`); err != nil {
		return err
	}
	for i, task := range tasks {
		days := make([]int32, len(task.Days))
		for n, day := range task.Days {
			days[n] = int32(day)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO tasks (id, name, icon, category, color, difficulty, repeat, days, start_date, end_date, is_habit, created_at, position)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date, NULLIF($10, '')::date, $11, $12, $13)`,
			task.ID, task.Name, task.Icon, task.Category, task.Color, task.Difficulty, task.Repeat, days,
			task.StartDate, endOrEmpty(task.EndDate), task.IsHabit, task.CreatedAt, i); err != nil {
			return err
		}
	}
	for key, on := range raw.Completions {
		if !on {
			continue
		}
		sep := strings.IndexByte(key, '|')
		if sep <= 0 {
			continue
		}
		id, day := key[:sep], key[sep+1:]
		if !seen[id] || !dateRe.MatchString(day) {
			continue
		}
		if _, err := tx.Exec(ctx, `INSERT INTO completions (task_id, day) VALUES ($1, $2::date) ON CONFLICT DO NOTHING`, id, day); err != nil {
			return err
		}
	}
	for _, id := range raw.Unlocked {
		if !achievements[id] {
			continue
		}
		if _, err := tx.Exec(ctx, `INSERT INTO achievements (id) VALUES ($1) ON CONFLICT DO NOTHING`, id); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `UPDATE settings SET name = $1, week_starts_on = $2, initialized = $3 WHERE id = 1`, settings.Name, settings.WeekStartsOn, initialized)
	return err
}

func cleanSettings(settings Settings) Settings {
	name := strings.TrimSpace(settings.Name)
	if name == "" {
		name = "Аделя"
	}
	if utf8.RuneCountInString(name) > 40 {
		runes := []rune(name)
		name = string(runes[:40])
	}
	week := 1
	if settings.WeekStartsOn == 0 {
		week = 0
	}
	return Settings{Name: name, WeekStartsOn: week}
}

func sanitizeTask(input Task, fallback string) (Task, error) {
	name := strings.TrimSpace(strings.NewReplacer("<", "", ">", "").Replace(input.Name))
	if utf8.RuneCountInString(name) > 40 {
		name = string([]rune(name)[:40])
	}
	if name == "" {
		return Task{}, errors.New("назови задачу")
	}
	category := input.Category
	if !categories[category] {
		category = "personal"
	}
	icon := input.Icon
	if !icons[icon] {
		icon = "⭐"
	}
	color := input.Color
	if !colors[color] {
		color = "#E9B7BD"
	}
	repeat := input.Repeat
	if !repeats[repeat] {
		repeat = "daily"
	}
	days := []int{}
	seen := map[int]bool{}
	if repeat == "custom" {
		for _, day := range input.Days {
			if day < 0 || day > 6 || seen[day] {
				continue
			}
			seen[day] = true
			days = append(days, day)
		}
	}
	start := input.StartDate
	if !dateRe.MatchString(start) {
		start = time.Now().Format("2006-01-02")
	}
	var end *string
	if input.EndDate != nil && dateRe.MatchString(*input.EndDate) {
		value := *input.EndDate
		if value < start {
			value = start
		}
		end = &value
	}
	id := input.ID
	if id == "" || strings.Contains(id, "|") || utf8.RuneCountInString(id) > 40 {
		id = fallback
	}
	if id == "" {
		id = fmt.Sprintf("t_%d", time.Now().UnixNano())
	}
	difficulty := "normal"
	if input.Difficulty == "hard" {
		difficulty = "hard"
	}
	created := input.CreatedAt
	if created == 0 {
		created = time.Now().UnixMilli()
	}
	return Task{
		ID: id, Name: name, Icon: icon, Category: category, Color: color,
		Difficulty: difficulty, Repeat: repeat, Days: days,
		StartDate: start, EndDate: end, IsHabit: input.IsHabit, CreatedAt: created,
	}, nil
}

func endOrEmpty(end *string) string {
	if end == nil {
		return ""
	}
	return *end
}

type LedgerEntry struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Amount    int64  `json:"amount"`
	Note      string `json:"note"`
	Category  string `json:"category"`
	Day       string `json:"day"`
	CreatedAt int64  `json:"createdAt"`
}

func (s *Store) ListLedger(ctx context.Context) ([]LedgerEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, kind, amount, note, category, day, created_at
		FROM ledger ORDER BY day DESC, created_at DESC LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := []LedgerEntry{}
	for rows.Next() {
		var entry LedgerEntry
		var day time.Time
		if err := rows.Scan(&entry.ID, &entry.Kind, &entry.Amount, &entry.Note, &entry.Category, &day, &entry.CreatedAt); err != nil {
			return nil, err
		}
		entry.Day = day.Format("2006-01-02")
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (s *Store) SaveLedger(ctx context.Context, raw LedgerEntry) (LedgerEntry, error) {
	entry, err := cleanLedger(raw)
	if err != nil {
		return LedgerEntry{}, err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO ledger (id, kind, amount, note, category, day, created_at)
		VALUES ($1, $2, $3, $4, $5, $6::date, $7)`,
		entry.ID, entry.Kind, entry.Amount, entry.Note, entry.Category, entry.Day, entry.CreatedAt)
	return entry, err
}

func (s *Store) DeleteLedger(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM ledger WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("запись не найдена")
	}
	return nil
}

func (s *Store) ClearLedger(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, `DELETE FROM ledger`); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx, `DELETE FROM forecasts`)
	return err
}

func cleanLedger(input LedgerEntry) (LedgerEntry, error) {
	kind := input.Kind
	if kind != "income" && kind != "expense" && kind != "saving" {
		return LedgerEntry{}, errors.New("выбери доход, расход или накопление")
	}
	if input.Amount <= 0 || input.Amount > 10_000_000_000 {
		return LedgerEntry{}, errors.New("укажи сумму больше нуля")
	}
	if !dateRe.MatchString(input.Day) {
		return LedgerEntry{}, errors.New("неверная дата")
	}
	note := strings.TrimSpace(strings.NewReplacer("<", "", ">", "").Replace(input.Note))
	if utf8.RuneCountInString(note) > 80 {
		note = string([]rune(note)[:80])
	}
	category := ""
	if kind == "expense" {
		if !spendCategories[input.Category] {
			return LedgerEntry{}, errors.New("выбери, на что потратила")
		}
		category = input.Category
	}
	id := input.ID
	if id == "" || strings.Contains(id, "|") || utf8.RuneCountInString(id) > 40 {
		id = fmt.Sprintf("m_%d", time.Now().UnixNano())
	}
	created := input.CreatedAt
	if created == 0 {
		created = time.Now().UnixMilli()
	}
	return LedgerEntry{
		ID: id, Kind: kind, Amount: input.Amount, Note: note, Category: category, Day: input.Day, CreatedAt: created,
	}, nil
}

var dayMoods = map[string]bool{
	"hard": true, "ok": true, "good": true, "great": true,
}

type DayNote struct {
	Day       string `json:"day"`
	Mood      string `json:"mood"`
	Note      string `json:"note"`
	UpdatedAt int64  `json:"updatedAt"`
}

func (s *Store) ListDayNotes(ctx context.Context) ([]DayNote, error) {
	rows, err := s.pool.Query(ctx, `SELECT day, mood, note, updated_at FROM day_notes ORDER BY day DESC LIMIT 400`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	notes := []DayNote{}
	for rows.Next() {
		var note DayNote
		var day time.Time
		if err := rows.Scan(&day, &note.Mood, &note.Note, &note.UpdatedAt); err != nil {
			return nil, err
		}
		note.Day = day.Format("2006-01-02")
		notes = append(notes, note)
	}
	return notes, rows.Err()
}

func (s *Store) SaveDayNote(ctx context.Context, raw DayNote) (DayNote, error) {
	note, err := cleanDayNote(raw)
	if err != nil {
		return DayNote{}, err
	}
	err = s.pool.QueryRow(ctx, `
		INSERT INTO day_notes (day, mood, note, updated_at)
		VALUES ($1::date, $2, $3, $4)
		ON CONFLICT (day) DO UPDATE SET mood = EXCLUDED.mood, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at
		RETURNING day, mood, note, updated_at`,
		note.Day, note.Mood, note.Note, note.UpdatedAt).Scan(new(time.Time), &note.Mood, &note.Note, &note.UpdatedAt)
	return note, err
}

func (s *Store) ClearDayNotes(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM day_notes`)
	return err
}

func cleanDayNote(input DayNote) (DayNote, error) {
	if !dateRe.MatchString(input.Day) {
		return DayNote{}, errors.New("неверная дата")
	}
	parsed, err := time.ParseInLocation("2006-01-02", input.Day, time.Local)
	if err != nil {
		return DayNote{}, errors.New("неверная дата")
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	if parsed.After(today) {
		return DayNote{}, errors.New("этот день ещё не наступил")
	}
	if !dayMoods[input.Mood] {
		return DayNote{}, errors.New("выбери, как прошёл день")
	}
	note := strings.TrimSpace(strings.NewReplacer("<", "", ">", "").Replace(input.Note))
	if utf8.RuneCountInString(note) > 280 {
		note = string([]rune(note)[:280])
	}
	updated := input.UpdatedAt
	if updated == 0 {
		updated = time.Now().UnixMilli()
	}
	return DayNote{Day: input.Day, Mood: input.Mood, Note: note, UpdatedAt: updated}, nil
}
