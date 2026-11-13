package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	_ "time/tzdata"

	"tracker/internal/store"
	"tracker/internal/telegram"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://tracker:tracker@127.0.0.1:5432/tracker?sslmode=disable"
	}
	ctx := context.Background()
	db, err := store.Connect(ctx, dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := db.Migrate(ctx); err != nil {
		log.Fatal(err)
	}
	go telegram.Run(context.Background(), db)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/telegram", func(w http.ResponseWriter, r *http.Request) {
		status, err := telegramStatus(r.Context(), db)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	})
	mux.HandleFunc("PUT /api/telegram", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Token           string `json:"token"`
			ReminderTime    string `json:"reminderTime"`
			ReminderEnabled bool   `json:"reminderEnabled"`
			ClearToken      bool   `json:"clearToken"`
		}
		if !readJSON(w, r, &body) {
			return
		}
		if body.ClearToken {
			if err := db.SaveTelegramToken(r.Context(), "", ""); err != nil {
				writeError(w, err)
				return
			}
			if err := db.DisconnectTelegram(r.Context()); err != nil {
				writeError(w, err)
				return
			}
		}
		if strings.TrimSpace(body.Token) != "" {
			name, err := telegram.CheckToken(r.Context(), strings.TrimSpace(body.Token))
			if err != nil {
				writeError(w, errors.New("токен не подошёл. Скопируй его заново у @BotFather"))
				return
			}
			if err := db.SaveTelegramToken(r.Context(), strings.TrimSpace(body.Token), name); err != nil {
				writeError(w, err)
				return
			}
		}
		if err := db.SaveTelegramReminder(r.Context(), body.ReminderTime, body.ReminderEnabled); err != nil {
			writeError(w, err)
			return
		}
		status, err := telegramStatus(r.Context(), db)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	})
	mux.HandleFunc("POST /api/telegram/link", func(w http.ResponseWriter, r *http.Request) {
		cfg, err := db.Telegram(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		if strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN")) == "" && strings.TrimSpace(cfg.Token) == "" {
			writeError(w, errors.New("сначала сохрани токен бота"))
			return
		}
		code := linkCode()
		if err := db.SaveTelegramLinkCode(r.Context(), code); err != nil {
			writeError(w, err)
			return
		}
		status, err := telegramStatus(r.Context(), db)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	})
	mux.HandleFunc("DELETE /api/telegram/link", func(w http.ResponseWriter, r *http.Request) {
		if err := db.DisconnectTelegram(r.Context()); err != nil {
			writeError(w, err)
			return
		}
		status, err := telegramStatus(r.Context(), db)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, status)
	})
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
	})
	mux.HandleFunc("GET /api/state", func(w http.ResponseWriter, r *http.Request) {
		state, err := db.Load(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
	})
	mux.HandleFunc("PUT /api/settings", func(w http.ResponseWriter, r *http.Request) {
		var body store.Settings
		if !readJSON(w, r, &body) {
			return
		}
		saved, err := db.SaveSettings(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	})
	mux.HandleFunc("POST /api/tasks", func(w http.ResponseWriter, r *http.Request) {
		var body store.Task
		if !readJSON(w, r, &body) {
			return
		}
		saved, err := db.SaveTask(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	})
	mux.HandleFunc("PUT /api/tasks/{id}", func(w http.ResponseWriter, r *http.Request) {
		var body store.Task
		if !readJSON(w, r, &body) {
			return
		}
		body.ID = r.PathValue("id")
		saved, err := db.SaveTask(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	})
	mux.HandleFunc("DELETE /api/tasks/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := db.DeleteTask(r.Context(), r.PathValue("id")); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("POST /api/completions/toggle", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			TaskID string `json:"taskId"`
			Date   string `json:"date"`
		}
		if !readJSON(w, r, &body) {
			return
		}
		done, err := db.Toggle(r.Context(), body.TaskID, body.Date)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"done": done})
	})
	mux.HandleFunc("POST /api/achievements", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			IDs []string `json:"ids"`
		}
		if !readJSON(w, r, &body) {
			return
		}
		ids, err := db.Unlock(r.Context(), body.IDs)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string][]string{"unlocked": ids})
	})
	mux.HandleFunc("POST /api/seed", func(w http.ResponseWriter, r *http.Request) {
		var body store.State
		if !readJSON(w, r, &body) {
			return
		}
		state, err := db.Seed(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
	})
	mux.HandleFunc("GET /api/ledger", func(w http.ResponseWriter, r *http.Request) {
		entries, err := db.ListLedger(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, entries)
	})
	mux.HandleFunc("POST /api/ledger", func(w http.ResponseWriter, r *http.Request) {
		var body store.LedgerEntry
		if !readJSON(w, r, &body) {
			return
		}
		saved, err := db.SaveLedger(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	})
	mux.HandleFunc("DELETE /api/ledger/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := db.DeleteLedger(r.Context(), r.PathValue("id")); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/forecasts", func(w http.ResponseWriter, r *http.Request) {
		list, err := db.ListForecasts(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})
	mux.HandleFunc("PUT /api/forecasts", func(w http.ResponseWriter, r *http.Request) {
		var body store.Forecast
		if !readJSON(w, r, &body) {
			return
		}
		saved, err := db.SaveForecast(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	})
	mux.HandleFunc("DELETE /api/forecasts/{month}", func(w http.ResponseWriter, r *http.Request) {
		if err := db.DeleteForecast(r.Context(), r.PathValue("month")); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("DELETE /api/ledger", func(w http.ResponseWriter, r *http.Request) {
		if err := db.ClearLedger(r.Context()); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/days", func(w http.ResponseWriter, r *http.Request) {
		notes, err := db.ListDayNotes(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, notes)
	})
	mux.HandleFunc("PUT /api/days/{day}", func(w http.ResponseWriter, r *http.Request) {
		var body store.DayNote
		if !readJSON(w, r, &body) {
			return
		}
		body.Day = r.PathValue("day")
		saved, err := db.SaveDayNote(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	})
	mux.HandleFunc("DELETE /api/days", func(w http.ResponseWriter, r *http.Request) {
		if err := db.ClearDayNotes(r.Context()); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/hours", func(w http.ResponseWriter, r *http.Request) {
		plan, err := db.ListHourTasks(r.Context())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, plan)
	})
	mux.HandleFunc("POST /api/hours", func(w http.ResponseWriter, r *http.Request) {
		var body store.HourTask
		if !readJSON(w, r, &body) {
			return
		}
		saved, err := db.SaveHourTask(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	})
	mux.HandleFunc("DELETE /api/hours/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := db.DeleteHourTask(r.Context(), r.PathValue("id")); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("POST /api/hours/toggle", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ID  string `json:"id"`
			Day string `json:"day"`
		}
		if !readJSON(w, r, &body) {
			return
		}
		done, err := db.ToggleHourTask(r.Context(), body.ID, body.Day)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"done": done})
	})
	mux.HandleFunc("DELETE /api/hours", func(w http.ResponseWriter, r *http.Request) {
		if err := db.ClearHourTasks(r.Context()); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("PUT /api/state", func(w http.ResponseWriter, r *http.Request) {
		var body store.State
		if !readJSON(w, r, &body) {
			return
		}
		state, err := db.Replace(r.Context(), body)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, state)
	})

	dist := os.Getenv("STATIC_DIR")
	if dist == "" {
		dist = filepath.Join("..", "frontend", "dist")
	}
	mux.Handle("/", spaHandler(dist))

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}
	log.Printf("трекер слушает http://127.0.0.1%s", addr)
	server := &http.Server{
		Addr:              addr,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Fatal(server.ListenAndServe())
}

func spaHandler(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serveIndex := r.URL.Path == "/" || r.URL.Path == "/index.html"
		if !serveIndex && !strings.HasPrefix(r.URL.Path, "/api/") {
			path := filepath.Join(dir, filepath.Clean(r.URL.Path))
			if info, err := os.Stat(path); err != nil || info.IsDir() {
				serveIndex = true
			}
		}
		if serveIndex {
			w.Header().Set("Cache-Control", "no-cache")
			http.ServeFile(w, r, filepath.Join(dir, "index.html"))
			return
		}
		files.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type telegramView struct {
	store.TelegramPublic
	LastError string `json:"lastError"`
}

func telegramStatus(ctx context.Context, db *store.Store) (telegramView, error) {
	cfg, err := db.Telegram(ctx)
	if err != nil {
		return telegramView{}, err
	}
	fromEnv := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN")) != ""
	clock := cfg.ReminderTime
	if clock == "" {
		clock = "20:00"
	}
	return telegramView{
		TelegramPublic: store.TelegramPublic{
			TokenSet:        strings.TrimSpace(cfg.Token) != "" || fromEnv,
			TokenFromEnv:    fromEnv,
			Connected:       cfg.ChatID != nil,
			Username:        cfg.Username,
			BotName:         cfg.BotName,
			ReminderTime:    clock,
			ReminderEnabled: cfg.ReminderEnabled,
			LinkCode:        cfg.LinkCode,
		},
		LastError: telegram.LastError(),
	}, nil
}

func linkCode() string {
	var buf [3]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%900000+100000)
	}
	n := int(buf[0])<<16 | int(buf[1])<<8 | int(buf[2])
	return fmt.Sprintf("%06d", 100000+(n%900000))
}

func readJSON(w http.ResponseWriter, r *http.Request, dest any) bool {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dest); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "не удалось прочитать запрос"})
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, err error) {
	status := http.StatusBadRequest
	if errors.Is(err, context.Canceled) {
		status = http.StatusRequestTimeout
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
