// Kept apart from the Electron window so it can be tested on its own.
/** Only a plain https origin, so a stray paste cannot point the screen somewhere odd. */
function screenUrl(input) {
  let parsed;
  try {
    parsed = new URL(String(input).trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  if (!["", "/", "/tv", "/tv/"].includes(parsed.pathname)) return null;
  parsed.pathname = "/tv/";
  return parsed.toString();
}

module.exports = { screenUrl };
