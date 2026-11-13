import { buildSampleData, computeStats, earnedAchievementIds, sanitizeTask } from "./logic.js";

const KEY = "mylife-tracker-v2";

function defaultSettings() {
  return { name: "Аделя", weekStartsOn: 1 };
}

export function createSampleState(now = new Date()) {
  const sample = buildSampleData(now);
  return {
    tasks: sample.tasks,
    completions: sample.completions,
    settings: defaultSettings(),
    unlocked: [],
  };
}

function normalize(raw) {
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
    .map((task) => sanitizeTask(task))
    .filter(Boolean)
    .slice(0, 80);
  const known = new Set(tasks.map((task) => task.id));
  const completions = {};
  if (raw.completions && typeof raw.completions === "object") {
    for (const [key, value] of Object.entries(raw.completions)) {
      if (!value) continue;
      const id = key.split("|")[0];
      if (known.has(id)) completions[key] = true;
    }
  }
  return {
    tasks,
    completions,
    settings: {
      name: String(raw.settings?.name ?? "Аделя").slice(0, 40),
      weekStartsOn: raw.settings?.weekStartsOn === 0 ? 0 : 1,
    },
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter((id) => typeof id === "string") : [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createSampleState();
    return normalize(JSON.parse(raw));
  } catch {
    return createSampleState();
  }
}

export const data = loadState();

export function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function syncUnlocked(today) {
  const stats = computeStats(data.tasks, data.completions, today, data.settings.weekStartsOn);
  const earned = new Set(earnedAchievementIds(stats));
  const fresh = [];
  for (const id of earned) {
    if (!data.unlocked.includes(id)) fresh.push(id);
  }
  if (fresh.length) data.unlocked = [...data.unlocked, ...fresh];
  return fresh;
}
