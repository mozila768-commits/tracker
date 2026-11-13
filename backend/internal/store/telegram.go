package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type TelegramConfig struct {
	Token           string
	ChatID          *int64
	Username        string
	BotName         string
	ReminderTime    string
	ReminderEnabled bool
	LinkCode        string
	LastReminder    string
	AwaitNote       bool
	UpdateOffset    int64
}

type TelegramPublic struct {
	TokenSet        bool   `json:"tokenSet"`
	TokenFromEnv    bool   `json:"tokenFromEnv"`
	Connected       bool   `json:"connected"`
	Username        string `json:"username"`
	BotName         string `json:"botName"`
	ReminderTime    string `json:"reminderTime"`
	ReminderEnabled bool   `json:"reminderEnabled"`
	LinkCode        string `json:"linkCode"`
}

func (s *Store) Telegram(ctx context.Context) (TelegramConfig, error) {
	var cfg TelegramConfig
	var chatID *int64
	var last *time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT token, chat_id, username, bot_name, reminder_time, reminder_enabled, link_code, last_reminder, await_note, update_offset
		FROM telegram WHERE id = 1`).
		Scan(&cfg.Token, &chatID, &cfg.Username, &cfg.BotName, &cfg.ReminderTime, &cfg.ReminderEnabled, &cfg.LinkCode, &last, &cfg.AwaitNote, &cfg.UpdateOffset)
	if err != nil {
		return TelegramConfig{}, err
	}
	cfg.ChatID = chatID
	if last != nil {
		cfg.LastReminder = last.Format("2006-01-02")
	}
	if !validClock(cfg.ReminderTime) {
		cfg.ReminderTime = "20:00"
	}
	return cfg, nil
}

func (s *Store) SaveTelegramToken(ctx context.Context, token, botName string) error {
	_, err := s.pool.Exec(ctx, `UPDATE telegram SET token = $1, bot_name = $2 WHERE id = 1`, strings.TrimSpace(token), botName)
	return err
}

func (s *Store) SaveTelegramReminder(ctx context.Context, clock string, enabled bool) error {
	clock = normalizeClock(clock)
	_, err := s.pool.Exec(ctx, `UPDATE telegram SET reminder_time = $1, reminder_enabled = $2 WHERE id = 1`, clock, enabled)
	return err
}

func (s *Store) SaveTelegramLinkCode(ctx context.Context, code string) error {
	_, err := s.pool.Exec(ctx, `UPDATE telegram SET link_code = $1 WHERE id = 1`, code)
	return err
}

func (s *Store) ConnectTelegram(ctx context.Context, chatID int64, username string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE telegram SET chat_id = $1, username = $2, link_code = '', await_note = false WHERE id = 1`, chatID, username)
	return err
}

func (s *Store) DisconnectTelegram(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE telegram SET chat_id = NULL, username = '', link_code = '', await_note = false WHERE id = 1`)
	return err
}

func (s *Store) MarkTelegramReminder(ctx context.Context, day string) error {
	_, err := s.pool.Exec(ctx, `UPDATE telegram SET last_reminder = $1::date WHERE id = 1`, day)
	return err
}

func (s *Store) SetTelegramAwaitNote(ctx context.Context, await bool) error {
	_, err := s.pool.Exec(ctx, `UPDATE telegram SET await_note = $1 WHERE id = 1`, await)
	return err
}

func (s *Store) SaveTelegramOffset(ctx context.Context, offset int64) error {
	_, err := s.pool.Exec(ctx, `UPDATE telegram SET update_offset = $1 WHERE id = 1`, offset)
	return err
}

func (s *Store) DayNoteOn(ctx context.Context, day string) (DayNote, bool, error) {
	var note DayNote
	var when time.Time
	err := s.pool.QueryRow(ctx, `SELECT day, mood, note, updated_at FROM day_notes WHERE day = $1::date`, day).
		Scan(&when, &note.Mood, &note.Note, &note.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DayNote{}, false, nil
		}
		return DayNote{}, false, err
	}
	note.Day = when.Format("2006-01-02")
	return note, true, nil
}

func normalizeClock(value string) string {
	if len(value) >= 5 {
		value = value[:5]
	}
	parsed, err := time.Parse("15:04", value)
	if err != nil || parsed.Format("15:04") != value {
		return "20:00"
	}
	return value
}

func validClock(value string) bool {
	return normalizeClock(value) == value
}
