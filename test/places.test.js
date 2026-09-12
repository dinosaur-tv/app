import assert from "node:assert/strict";
import test from "node:test";
import { queryVariants, searchPlaces, toPlace, transliterate } from "../console/places.js";

test("Russian spells out into the Latin the index understands", () => {
  assert.equal(transliterate("Казань"), "Kazan");
  assert.equal(transliterate("Новосибирск"), "Novosibirsk");
  assert.equal(transliterate("Нижний Новгород"), "Nizhniy Novgorod");
  assert.equal(transliterate("Пермь"), "Perm");
});

test("a word starting with е becomes Ye, which is how the index spells it", () => {
  assert.equal(transliterate("Екатеринбург"), "Yekaterinburg");
  assert.equal(transliterate("Елец"), "Yelets");
});

test("names the index only knows in English are asked for by that name first", () => {
  assert.equal(queryVariants("Санкт-Петербург")[0], "Saint Petersburg");
  assert.equal(queryVariants("Ростов-на-Дону")[0], "Rostov-on-Don");
});

test("Latin input is sent as typed, without being mangled", () => {
  assert.deepEqual(queryVariants("Kazan"), ["Kazan"]);
  assert.deepEqual(queryVariants("  "), []);
});

test("towns outrank airports, and the bigger town comes first", async () => {
  const payload = {
    results: [
      { name: "Аэропорт Кольцово", latitude: 56.74, longitude: 60.8, timezone: "Asia/Yekaterinburg", feature_code: "AIRP", population: 0 },
      { name: "Берёзовский", latitude: 56.9, longitude: 60.8, timezone: "Asia/Yekaterinburg", feature_code: "PPL", population: 60000 },
      { name: "Екатеринбург", latitude: 56.8519, longitude: 60.6122, timezone: "Asia/Yekaterinburg", feature_code: "PPLA", population: 1349772, admin1: "Свердловская область", country: "Россия" },
    ],
  };
  const found = await searchPlaces("Екатеринбург", async () => ({ ok: true, json: async () => payload }));
  assert.deepEqual(found.map((p) => p.name), ["Екатеринбург", "Берёзовский", "Аэропорт Кольцово"]);
  assert.equal(found[0].timezone, "Asia/Yekaterinburg");
  assert.equal(found[0].region, "Свердловская область, Россия");
});

test("the next spelling is tried when the first finds nothing", async () => {
  const asked = [];
  const fetchImpl = async (url) => {
    asked.push(new URL(url).searchParams.get("name"));
    const empty = asked.length === 1;
    return { ok: true, json: async () => (empty ? {} : { results: [{ name: "Казань", latitude: 55.79, longitude: 49.12, timezone: "Europe/Moscow", feature_code: "PPLA" }] }) };
  };
  const found = await searchPlaces("Казань", fetchImpl);
  assert.deepEqual(asked, ["Казань", "Kazan"]);
  assert.equal(found[0].name, "Казань");
});

test("a search that fails everywhere returns nothing instead of throwing", async () => {
  const found = await searchPlaces("Казань", async () => { throw new Error("оффлайн"); });
  assert.deepEqual(found, []);
});

test("a result is trimmed to the four fields the household stores", () => {
  const place = toPlace({ name: "Сочи", latitude: 43.585472, longitude: 39.723098, timezone: "Europe/Moscow", admin1: "Краснодарский край", country: "Россия" });
  assert.deepEqual(place, { name: "Сочи", latitude: 43.5855, longitude: 39.7231, timezone: "Europe/Moscow", region: "Краснодарский край, Россия" });
});
