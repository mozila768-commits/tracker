package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

type HourTask struct {
	ID       string `json:"id"`
	Weekday  int    `json:"weekday"`
	Name     string `json:"name"`
	Until    string `json:"until"`
	Position int    `json:"position"`
}

type HourPlan struct {
	Tasks []HourTask      `json:"tasks"`
	Done  map[string]bool `json:"done"`
}

func (s *Store) ListHourTasks(ctx context.Context) (HourPlan, error) {
	plan := HourPlan{Tasks: []HourTask{}, Done: map[string]bool{}}
	rows, err := s.pool.Query(ctx, `
		SELECT id, weekday, name, until_time, position
		FROM hour_tasks ORDER BY weekday, until_time, position, id`)
	if err != nil {
		return plan, err
	}
	defer rows.Close()
	for rows.Next() {
		var task HourTask
		if err := rows.Scan(&task.ID, &task.Weekday, &task.Name, &task.Until, &task.Position); err != nil {
			return plan, err
		}
		plan.Tasks = append(plan.Tasks, task)
	}
	if err := rows.Err(); err != nil {
		return plan, err
	}
	doneRows, err := s.pool.Query(ctx, `
		SELECT task_id, day FROM hour_done WHERE day >= CURRENT_DATE - 400`)
	if err != nil {
		return plan, err
	}
	defer doneRows.Close()
	for doneRows.Next() {
		var id string
		var day time.Time
		if err := doneRows.Scan(&id, &day); err != nil {
			return plan, err
		}
		plan.Done[id+"|"+day.Format("2006-01-02")] = true
	}
	return plan, doneRows.Err()
}

func (s *Store) SaveHourTask(ctx context.Context, raw HourTask) (HourTask, error) {
	task, err := cleanHourTask(raw)
	if err != nil {
		return HourTask{}, err
	}
	task.ID = fmt.Sprintf("h_%d", time.Now().UnixNano())
	err = s.pool.QueryRow(ctx, `
		INSERT INTO hour_tasks (id, weekday, name, until_time, position, created_at)
		VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(position) FROM hour_tasks WHERE weekday = $2), 0) + 1, $5)
		RETURNING id, weekday, name, until_time, position`,
		task.ID, task.Weekday, task.Name, task.Until, time.Now().UnixMilli()).
		Scan(&task.ID, &task.Weekday, &task.Name, &task.Until, &task.Position)
	return task, err
}

func (s *Store) DeleteHourTask(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM hour_tasks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("дело не найдено")
	}
	return nil
}

func (s *Store) ToggleHourTask(ctx context.Context, id, day string) (bool, error) {
	if !dateRe.MatchString(day) {
		return false, errors.New("неверная дата")
	}
	parsed, err := time.ParseInLocation("2006-01-02", day, time.Local)
	if err != nil {
		return false, errors.New("неверная дата")
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	if parsed.After(today) {
		return false, errors.New("этот день ещё не наступил")
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM hour_tasks WHERE id = $1)`, id).Scan(&exists); err != nil {
		return false, err
	}
	if !exists {
		return false, errors.New("дело не найдено")
	}
	var marked bool
	err = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM hour_done WHERE task_id = $1 AND day = $2::date)`, id, day).Scan(&marked)
	if err != nil {
		return false, err
	}
	if marked {
		_, err = s.pool.Exec(ctx, `DELETE FROM hour_done WHERE task_id = $1 AND day = $2::date`, id, day)
		return false, err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO hour_done (task_id, day) VALUES ($1, $2::date)`, id, day)
	return true, err
}

func (s *Store) ClearHourTasks(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM hour_tasks`)
	return err
}

func cleanHourTask(input HourTask) (HourTask, error) {
	if input.Weekday < 0 || input.Weekday > 6 {
		return HourTask{}, errors.New("выбери день")
	}
	name := strings.TrimSpace(strings.NewReplacer("<", "", ">", "").Replace(input.Name))
	if name == "" {
		return HourTask{}, errors.New("напиши, что сделать")
	}
	if utf8.RuneCountInString(name) > 80 {
		name = string([]rune(name)[:80])
	}
	until := input.Until
	if len(until) >= 5 {
		until = until[:5]
	}
	parsed, err := time.Parse("15:04", until)
	if err != nil || parsed.Format("15:04") != until {
		return HourTask{}, errors.New("укажи, до какого времени")
	}
	return HourTask{Weekday: input.Weekday, Name: name, Until: until}, nil
}
