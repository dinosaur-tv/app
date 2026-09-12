// The forecast now comes straight from the screen. Open-Meteo needs no key and allows
// browser requests, so the server no longer stands between the television and the weather:
// it only stores which place to look up. The screen keeps the last good answer, so a
// dropped connection shows yesterday's reading rather than a blank.

const CODE_NAMES = {
  0: "Ясно", 1: "Преимущественно ясно", 2: "Переменная облачность", 3: "Пасмурно",
  45: "Туман", 48: "Изморозь", 51: "Лёгкая морось", 53: "Морось", 55: "Сильная морось",
  61: "Небольшой дождь", 63: "Дождь", 65: "Сильный дождь", 71: "Небольшой снег",
  73: "Снег", 75: "Сильный снег", 80: "Ливень", 81: "Ливень", 82: "Сильный ливень",
  95: "Гроза", 96: "Гроза с градом", 99: "Сильная гроза с градом",
};

export const weatherPeriods = [
  { id: "morning", label: "Утро", hour: 8 },
  { id: "day", label: "День", hour: 13 },
  { id: "evening", label: "Вечер", hour: 19 },
  { id: "night", label: "Ночь", hour: 23 },
];

export function describeWeather(code) {
  return CODE_NAMES[code ?? -1] ?? "Нет данных";
}

/** Open-Meteo returns local stamps plus the offset that made them; both are needed to place an hour in time. */
export function offsetSuffix(offsetSeconds) {
  const total = Math.round((Number(offsetSeconds) || 0) / 60);
  const sign = total < 0 ? "-" : "+";
  const abs = Math.abs(total);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function parseLocal(stamp, offset) {
  const normalized = stamp.length <= 16 ? `${stamp}:00` : stamp;
  return Date.parse(`${normalized}${offset}`);
}

export function pickClosestHour(hourly, day, hour, offset) {
  const target = Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00${offset}`);
  if (!Number.isFinite(target)) return undefined;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [index, stamp] of hourly.time.entries()) {
    if (!stamp.startsWith(day)) continue;
    const distance = Math.abs(parseLocal(stamp, offset) - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  if (bestIndex < 0) return undefined;
  const stamp = hourly.time[bestIndex];
  return {
    time: stamp,
    hour: Number(stamp.slice(11, 13)),
    temperature: Math.round(hourly.temperature[bestIndex] ?? 0),
    description: describeWeather(hourly.codes[bestIndex]),
  };
}

export function periodsFromHourly(hourly, day, offset) {
  return weatherPeriods.flatMap((period) => {
    const match = pickClosestHour(hourly, day, period.hour, offset);
    if (!match) return [];
    return [{ id: period.id, label: period.label, hour: period.hour, temperature: match.temperature, description: match.description }];
  });
}

export function upcomingHours(hourly, now, offset, count = 8) {
  const nowMs = now.getTime();
  return hourly.time
    .map((stamp, index) => ({
      time: stamp,
      hour: Number(stamp.slice(11, 13)),
      temperature: Math.round(hourly.temperature[index] ?? 0),
      description: describeWeather(hourly.codes[index]),
      at: parseLocal(stamp, offset),
    }))
    .filter((item) => Number.isFinite(item.at) && item.at >= nowMs - 30 * 60 * 1000)
    .slice(0, count)
    .map((item) => ({ time: item.time, hour: item.hour, temperature: item.temperature, description: item.description }));
}

export function weekDaysFromForecast(daily, hourly, offset) {
  return daily.time.slice(0, 7).map((date, index) => ({
    date,
    high: Math.round(daily.high[index] ?? 0),
    low: Math.round(daily.low[index] ?? 0),
    description: describeWeather(daily.codes[index]),
    periods: periodsFromHourly(hourly, date, offset),
  }));
}

export function fallbackWeather(name = "") {
  return { temperature: 0, feelsLike: 0, description: "Нет данных", high: 0, low: 0, location: name, periods: [], hours: [], days: [] };
}

export function forecastUrl(place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,apparent_temperature,weather_code",
    hourly: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    forecast_days: "8",
    timezone: place.timezone,
  }).toString();
  return url.toString();
}

export function readForecast(data, place, now = new Date()) {
  const offset = offsetSuffix(data.utc_offset_seconds);
  const hourly = {
    time: data.hourly?.time ?? [],
    temperature: data.hourly?.temperature_2m ?? [],
    codes: data.hourly?.weather_code ?? [],
  };
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: place.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return {
    temperature: Math.round(data.current?.temperature_2m ?? 0),
    feelsLike: Math.round(data.current?.apparent_temperature ?? 0),
    description: describeWeather(data.current?.weather_code),
    high: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
    low: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
    location: place.name,
    periods: periodsFromHourly(hourly, day, offset),
    hours: upcomingHours(hourly, now, offset),
    days: weekDaysFromForecast({
      time: data.daily?.time ?? [],
      high: data.daily?.temperature_2m_max ?? [],
      low: data.daily?.temperature_2m_min ?? [],
      codes: data.daily?.weather_code ?? [],
    }, hourly, offset),
  };
}

export async function fetchWeather(place, now = new Date(), fetchImpl = fetch) {
  const response = await fetchImpl(forecastUrl(place), { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
  return readForecast(await response.json(), place, now);
}

/** Same place, same day, same hour: no reason to ask again. */
export function placeKey(place) {
  return place ? `${place.latitude},${place.longitude},${place.timezone}` : "";
}
