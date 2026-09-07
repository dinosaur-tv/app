export const displayModes = ["NOW", "TODAY", "WEEK", "MONTH"];
export const displayThemes = ["gallery", "tobacco", "taupe", "stone", "forest", "apple"];

const modeNames = { NOW: "Сейчас", TODAY: "Сегодня", WEEK: "Неделя", MONTH: "Месяц" };
export const themeNames = { gallery: "Галерея", tobacco: "Табак", taupe: "Тауп", stone: "Камень", forest: "Лес", apple: "Светлый" };

export function displayModeName(mode) {
  return modeNames[mode] || modeNames.NOW;
}

export function normalizeDisplay(value = {}) {
  return {
    mode: displayModes.includes(value.mode) ? value.mode : "NOW",
    theme: displayThemes.includes(value.theme) ? value.theme : "gallery",
    privacy: value.privacy === true,
  };
}
