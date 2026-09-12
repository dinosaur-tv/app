// City lookup for the weather place. Open-Meteo's index is keyed on Latin names and
// answers nothing to Cyrillic, so a Russian query is transliterated before it is sent.

const LETTERS = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya",
};

// The index carries the English forms of these, which no letter-by-letter rule produces.
const ALIASES = {
  "санкт-петербург": "Saint Petersburg",
  "петербург": "Saint Petersburg",
  "спб": "Saint Petersburg",
  "ростов-на-дону": "Rostov-on-Don",
  "москва": "Moscow",
};

export function transliterate(text) {
  const letters = [...String(text).toLowerCase()]
    .map((letter) => (letter in LETTERS ? LETTERS[letter] : letter))
    .join("");
  // A Russian word starting with "е" is written "Ye" in English: Yekaterinburg, not Ekaterinburg.
  const yeFixed = letters.replace(/(^|[\s-])e/g, (match, lead) => `${lead}ye`);
  return yeFixed.replace(/(^|[\s-])(\p{Ll})/gu, (match, lead, letter) => lead + letter.toUpperCase());
}

/** Raw first: a query already in Latin should not be mangled on its way out. */
export function queryVariants(query) {
  const text = String(query).trim();
  if (!text) return [];
  const variants = [text];
  const alias = ALIASES[text.toLowerCase()];
  if (alias) variants.unshift(alias);
  if (/[а-яё]/i.test(text)) variants.push(transliterate(text));
  return [...new Set(variants.filter(Boolean))];
}

function rank(results) {
  return [...results]
    .filter((item) => item && Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.timezone)
    // Towns and cities before airports, rivers and mountains; bigger before smaller.
    .sort((left, right) => {
      const populated = Number(String(right.feature_code ?? "").startsWith("PPL")) - Number(String(left.feature_code ?? "").startsWith("PPL"));
      return populated || (right.population ?? 0) - (left.population ?? 0);
    });
}

export function toPlace(result) {
  return {
    name: String(result.name).slice(0, 60),
    latitude: Math.round(result.latitude * 1e4) / 1e4,
    longitude: Math.round(result.longitude * 1e4) / 1e4,
    timezone: result.timezone,
    region: [result.admin1, result.country].filter(Boolean).join(", "),
  };
}

export async function searchPlaces(query, fetchImpl = fetch) {
  for (const variant of queryVariants(query)) {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({ name: variant, count: "8", language: "ru", format: "json" }).toString();
    let data;
    try {
      const response = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) continue;
      data = await response.json();
    } catch {
      continue;
    }
    const found = rank(data?.results ?? []).slice(0, 6).map(toPlace);
    if (found.length) return found;
  }
  return [];
}
