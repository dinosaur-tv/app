export const displayModes = ["NOW", "TODAY", "WEEK"];
export const displayThemes = [
  "gallery", "home-day", "home-evening", "forest", "mountains", "sea", "space",
  "petersburg", "rome", "florence", "venice", "palace", "oak-study", "rus", "byzantium", "india", "italy",
];
export const displayMoods = ["home", "night", "play"];

const modeNames = { NOW: "Сейчас", TODAY: "Сегодня", WEEK: "Неделя" };
export const themeNames = {
  gallery: "Галерея",
  "home-day": "Дом · День",
  "home-evening": "Дом · Вечер",
  forest: "Лес",
  mountains: "Горы",
  sea: "Море",
  space: "Космос",
  petersburg: "Петербург",
  rome: "Рим",
  florence: "Флоренция",
  venice: "Венеция",
  palace: "Дворец",
  "oak-study": "Дубовый кабинет",
  rus: "Русский узор",
  byzantium: "Византия",
  india: "Индия",
  italy: "Итальянский узор",
};
export const moodNames = {
  home: "Дом",
  night: "Ночь",
  play: "Шалость",
};

export const noteDurations = [
  { minutes: 5, label: "5 мин" },
  { minutes: 10, label: "10 мин" },
  { minutes: 15, label: "15 мин" },
  { minutes: 30, label: "30 мин" },
  { minutes: 45, label: "45 мин" },
  { minutes: 60, label: "1 час" },
  { minutes: 120, label: "2 часа" },
  { minutes: 240, label: "4 часа" },
  { minutes: 360, label: "6 часов" },
  { minutes: 720, label: "12 часов" },
];

export const rotationPresets = [10, 15, 30, 45, 60, 120];

export function defaultRotation() {
  return { enabled: true, now: 30, today: 30, week: 30 };
}

export function clampRotationSeconds(value, fallback = 30) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(300, Math.max(5, Math.round(n)));
}

export function normalizeRotation(value = {}) {
  const base = defaultRotation();
  if (!value || typeof value !== "object") return base;
  const shared = value.seconds ?? value.interval;
  return {
    enabled: value.enabled !== false,
    now: clampRotationSeconds(value.now ?? shared, base.now),
    today: clampRotationSeconds(value.today ?? shared, base.today),
    week: clampRotationSeconds(value.week ?? shared, base.week),
  };
}

export function rotationSignature(rotation) {
  const value = normalizeRotation(rotation);
  return `${value.enabled ? "on" : "off"}:${value.now}:${value.today}:${value.week}`;
}

export function displayModeName(mode) {
  return modeNames[mode] || modeNames.NOW;
}

export function displayMoodName(mood) {
  return moodNames[mood] || moodNames.home;
}

export function screenTheme(display) {
  return display.mood === "home" ? display.theme : display.mood;
}

export function shouldApplyTvReload(appliedAt, incomingAt) {
  return Boolean(incomingAt) && incomingAt !== appliedAt;
}

export function normalizeNote(value, now = Date.now()) {
  if (!value || typeof value.text !== "string" || !value.text.trim()) return null;
  if (value.expiresAt && new Date(value.expiresAt).getTime() <= now) return null;
  return { text: value.text.trim().slice(0, 180), expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : "" };
}

export function normalizeNowPlaying(value = {}) {
  const volume = Number(value.volumePercent);
  return {
    title: typeof value.title === "string" ? value.title : "",
    artist: typeof value.artist === "string" ? value.artist : "",
    source: typeof value.source === "string" ? value.source : "Яндекс Музыка",
    isPlaying: value.isPlaying === true,
    volumePercent: Number.isFinite(volume) ? Math.max(0, Math.min(100, Math.round(volume))) : 50,
    artworkUrl: typeof value.artworkUrl === "string" ? value.artworkUrl : "",
    deviceName: typeof value.deviceName === "string" ? value.deviceName : "",
  };
}

export function normalizeDisplay(value = {}) {
  const legacyMood = value.theme === "night" || value.theme === "play" ? value.theme : "";
  let mood = displayMoods.includes(value.mood) ? value.mood : "home";
  if (legacyMood && mood === "home") mood = legacyMood;
  return {
    mode: displayModes.includes(value.mode) ? value.mode : "NOW",
    theme: displayThemes.includes(value.theme) ? value.theme : "gallery",
    mood,
    privacy: value.privacy === true,
    showWeather: value.showWeather !== false,
    showCalendar: value.showCalendar !== false,
    backgroundUrl: value.backgroundUrl || "",
    rotation: normalizeRotation(value.rotation),
  };
}
