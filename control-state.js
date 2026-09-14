export const displayModes = ["TODAY", "TOMORROW", "WEEK"];
export const displayThemes = [
  "gallery", "home-day", "home-evening", "forest", "autumn-forest", "mountains", "sea", "space",
  "petersburg", "petersburg-streets", "oranienbaum", "peterhof", "rome", "florence", "venice", "italy-sunset",
  "palace", "oak-study", "palace-study", "rus", "gzhel", "soviet-carpet", "byzantium", "india", "italy",
];
export const displayMoods = ["home", "night", "play"];

const modeNames = { TODAY: "Сегодня", TOMORROW: "Завтра", WEEK: "Неделя" };
export const themeNames = {
  gallery: "Галерея",
  "home-day": "Дом · День",
  "home-evening": "Дом · Вечер",
  forest: "Лес",
  "autumn-forest": "Осенний лес",
  mountains: "Горы",
  sea: "Море",
  space: "Космос",
  petersburg: "Петербург",
  "petersburg-streets": "Улицы Петербурга",
  oranienbaum: "Ораниенбаум",
  peterhof: "Петергоф",
  rome: "Рим",
  florence: "Флоренция",
  venice: "Венеция",
  "italy-sunset": "Итальянский закат",
  palace: "Дворец",
  "oak-study": "Дубовый кабинет",
  "palace-study": "Дворцовый кабинет",
  rus: "Русский узор",
  gzhel: "Гжель",
  "soviet-carpet": "Советский ковёр",
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
  return { enabled: true, today: 30, tomorrow: 30, week: 30 };
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
    today: clampRotationSeconds(value.today ?? value.now ?? shared, base.today),
    tomorrow: clampRotationSeconds(value.tomorrow ?? value.today ?? value.now ?? shared, base.tomorrow),
    week: clampRotationSeconds(value.week ?? shared, base.week),
  };
}

export function rotationSignature(rotation) {
  const value = normalizeRotation(rotation);
  return `${value.enabled ? "on" : "off"}:${value.today}:${value.tomorrow}:${value.week}`;
}

export function displayModeName(mode) {
  return modeNames[mode === "NOW" ? "TODAY" : mode] || modeNames.TODAY;
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

/**
 * A stopped player still leaves its notification and its MediaSession behind, so a title
 * alone is not evidence that anything is playing. The screen shows a track only while it
 * actually plays; otherwise the bar would sit there for hours after the music ended.
 */
function namedTrack(track) {
  if (!track || typeof track.title !== "string" || !track.title.trim()) return null;
  return track;
}

/**
 * A paused track is still what is on the player, so the screen keeps showing it — quietly,
 * without the wave. A track only disappears when the television stops reporting one at
 * all, which is how a player that has been closed leaves the screen.
 * Of the two sources, whichever says it is playing wins: a stale copy usually says paused.
 */
export function pickNowPlaying(native, snapshot) {
  const heard = [namedTrack(native), namedTrack(snapshot?.nowPlaying)].filter(Boolean);
  return heard.find((track) => track.isPlaying !== false) ?? heard[0] ?? null;
}

export function tvRemoteStatus({ tvOnline = false, tvPower = "on", nowPlaying = {} } = {}) {
  const title = typeof nowPlaying.title === "string" ? nowPlaying.title.trim() : "";
  if (tvOnline) {
    return { state: title ? "поверх музыки" : "на экране", power: "Выкл" };
  }
  if (title) {
    return { state: nowPlaying.isPlaying === false ? "на паузе" : "музыка", power: "Поверх" };
  }
  return { state: tvPower === "off" ? "выключен" : "не на связи", power: "Вкл" };
}

export function musicRemoteCopy({ tvOnline = false, nowPlaying = {}, canOverlay = true } = {}) {
  const title = typeof nowPlaying.title === "string" ? nowPlaying.title.trim() : "";
  // Android will not let one app draw over another without permission, and the television
  // is the only place it can be granted. Better to say so than to offer a dead button.
  if (!canOverlay) {
    return {
      toTv: "Поверх музыки",
      blocked: true,
      hint: "Телевизору не разрешено показывать Dino поверх других приложений. Включите это в настройках телевизора: Приложения → Dino TV → Поверх других приложений.",
    };
  }
  if (tvOnline && title) {
    return {
      toTv: "Уже на экране",
      hint: "Dino поверх музыки. «Выкл» в шапке спрячет его, трек останется.",
    };
  }
  if (title) {
    return {
      toTv: "Поверх музыки",
      hint: "Играет на телевизоре. Кнопка откроет Dino поверх, не останавливая трек.",
    };
  }
  return {
    toTv: "Поверх музыки",
    hint: "Запустите Яндекс Музыку в Кинопоиске. Пульт покажет трек, а кнопка откроет Dino поверх.",
  };
}

export function normalizeDisplay(value = {}) {
  const legacyMood = value.theme === "night" || value.theme === "play" ? value.theme : "";
  const requestedMode = value.mode === "NOW" ? "TODAY" : value.mode;
  let mood = displayMoods.includes(value.mood) ? value.mood : "home";
  if (legacyMood && mood === "home") mood = legacyMood;
  return {
    mode: displayModes.includes(requestedMode) ? requestedMode : "TODAY",
    theme: displayThemes.includes(value.theme) ? value.theme : "gallery",
    mood,
    privacy: value.privacy === true,
    showWeather: value.showWeather !== false,
    showCalendar: value.showCalendar !== false,
    backgroundUrl: value.backgroundUrl || "",
    rotation: normalizeRotation(value.rotation),
  };
}
