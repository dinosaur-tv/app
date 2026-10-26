/**
 * Four compositions instead of forty one-off layouts:
 *  - split:  clock on the left, agenda on the right (most scenes);
 *  - mirror: the same, swapped, for pictures whose subject is on the right;
 *  - art:    the painting whole, clock and agenda in a rail beside it;
 *  - night:  a large dim clock and a quiet agenda with no panel.
 */
const MIRRORED = new Set([
  "home-day", "play", "petersburg", "rome", "mountains", "oranienbaum",
  "space", "forest", "venice", "italy-sunset",
]);

export function sceneLayout(theme, { artwork = false, customPhoto = false } = {}) {
  if (artwork && !customPhoto) return "art";
  if (theme === "night") return "night";
  if (!customPhoto && MIRRORED.has(theme)) return "mirror";
  return "split";
}
