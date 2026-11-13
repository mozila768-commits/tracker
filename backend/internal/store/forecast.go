package store

import (
	"context"
	"errors"
	"regexp"
	"time"
)

var monthRe = regexp.MustCompile(`^\d{4}-\d{2}$`)

type Forecast struct {
	Month   string `json:"month"`
	Income  int64  `json:"income"`
	Expense int64  `json:"expense"`
}

func (s *Store) ListForecasts(ctx context.Context) ([]Forecast, error) {
	rows, err := s.pool.Query(ctx, `SELECT month, income, expense FROM forecasts ORDER BY month`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Forecast{}
	for rows.Next() {
		var item Forecast
		var month time.Time
		if err := rows.Scan(&month, &item.Income, &item.Expense); err != nil {
			return nil, err
		}
		item.Month = month.Format("2006-01")
		list = append(list, item)
	}
	return list, rows.Err()
}

func (s *Store) SaveForecast(ctx context.Context, raw Forecast) (Forecast, error) {
	item, err := cleanForecast(raw)
	if err != nil {
		return Forecast{}, err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO forecasts (month, income, expense)
		VALUES ($1::date, $2, $3)
		ON CONFLICT (month) DO UPDATE SET income = EXCLUDED.income, expense = EXCLUDED.expense`,
		item.Month+"-01", item.Income, item.Expense)
	return item, err
}

func (s *Store) DeleteForecast(ctx context.Context, month string) error {
	if !monthRe.MatchString(month) {
		return errors.New("выбери месяц")
	}
	if _, err := time.Parse("2006-01", month); err != nil {
		return errors.New("выбери месяц")
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM forecasts WHERE month = $1::date`, month+"-01")
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("план на этот месяц не найден")
	}
	return nil
}

func cleanForecast(input Forecast) (Forecast, error) {
	if !monthRe.MatchString(input.Month) {
		return Forecast{}, errors.New("выбери месяц")
	}
	parsed, err := time.ParseInLocation("2006-01", input.Month, time.Local)
	if err != nil {
		return Forecast{}, errors.New("выбери месяц")
	}
	now := time.Now()
	current := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	if parsed.Before(current) {
		return Forecast{}, errors.New("план можно записать на этот месяц или на будущее")
	}
	if input.Income < 0 || input.Expense < 0 || input.Income > 10_000_000_000 || input.Expense > 10_000_000_000 {
		return Forecast{}, errors.New("укажи сумму в сомах")
	}
	if input.Income == 0 && input.Expense == 0 {
		return Forecast{}, errors.New("напиши ожидаемый доход или примерный расход")
	}
	return Forecast{Month: parsed.Format("2006-01"), Income: input.Income, Expense: input.Expense}, nil
}
