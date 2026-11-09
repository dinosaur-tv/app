// What a screen running in a browser can honestly say about itself, so the phone shows
// «Dino TV на Мониторе» or «LG webOS» instead of a second nameless «Телевизор». Anything
// it cannot tell for certain it leaves blank, and the server keeps the default.

const PLATFORMS = [
  [/webos|web0s/i, "LG webOS"],
  [/tizen/i, "Samsung Tizen"],
  [/android\s*tv|googletv/i, "Android TV"],
  [/aft[a-z]/i, "Fire TV"],
];

/**
 * @param {string} userAgent  what the browser says it is
 * @param {string} [host]     the computer's own name, which only the desktop app knows
 */
export function screenNameFrom(userAgent = "", host = "") {
  const computer = String(host).trim();
  if (computer) return `Dino TV на ${computer}`.slice(0, 40);
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent));
  return platform ? platform[1] : "";
}

/**
 * The name as it may travel in the x-dino-screen-name header. fetch() refuses any header
 * value outside Latin-1, so «Dino TV на Кабинет» sent as is made every request of a paired
 * desktop screen throw before it left the browser. The server decodes it back.
 * @param {string} name  what screenNameFrom returned
 */
export function screenNameHeader(name = "") {
  return name ? encodeURIComponent(name) : "";
}
