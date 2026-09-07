export const displayModes = ["NOW", "TODAY", "WEEK"];
export const displayThemes = ["gallery", "forest", "mountains", "sea", "space"];
export const displayMoods = ["home", "night", "play"];

const modeNames = { NOW: "Сейчас", TODAY: "Сегодня", WEEK: "Неделя" };
export const themeNames = {
  gallery: "Галерея",
  forest: "Лес",
  mountains: "Горы",
  sea: "Море",
  space: "Космос",
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
    backgroundUrl: value.backgroundUrl || "",
  };
}
