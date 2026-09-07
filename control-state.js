export const displayModes = ["NOW", "TODAY", "WEEK"];
export const displayThemes = ["gallery", "tobacco", "taupe", "stone", "forest", "apple"];
export const displayMoods = ["home", "night", "play"];

const modeNames = { NOW: "Сейчас", TODAY: "Сегодня", WEEK: "Неделя" };
export const themeNames = {
  gallery: "Галерея",
  tobacco: "Табак",
  taupe: "Тауп",
  stone: "Камень",
  forest: "Лес",
  apple: "Светлый",
};
export const moodNames = {
  home: "Дом",
  night: "Ночь",
  play: "Шалость",
};

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
