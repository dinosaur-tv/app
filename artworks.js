// The catalogue is local: TV rendering never depends on a museum/CDN connection.
// Full source and rights records live in assets/art/sources.json.
export const artworks = [
  { id: "art-levitan", file: "levitan-peace", artist: "Исаак Левитан", title: "Над вечным покоем", year: "1894", collection: "Русская классика", wall: "#3d474c", tone: "dark" },
  { id: "art-shishkin", file: "shishkin-rye", artist: "Иван Шишкин", title: "Рожь", year: "1878", collection: "Русская классика", wall: "#e4dfd2", tone: "light" },
  { id: "art-aivazovsky", file: "aivazovsky-wave", artist: "Иван Айвазовский", title: "Девятый вал", year: "1850", collection: "Русская классика", wall: "#e5dac7", tone: "light" },
  { id: "art-monet", file: "monet-lilies", artist: "Клод Моне", title: "Кувшинки", year: "1906", collection: "Импрессионизм", wall: "#dce2db", tone: "light" },
  { id: "art-renoir", file: "renoir-sisters", artist: "Пьер Огюст Ренуар", title: "Две сестры. На террасе", year: "1881", collection: "Импрессионизм", wall: "#e8e0d5", tone: "light" },
  { id: "art-pissarro", file: "pissarro-palace", artist: "Камиль Писсарро", title: "Хрустальный дворец", year: "1871", collection: "Импрессионизм", wall: "#dfded4", tone: "light" },
  { id: "art-kandinsky", file: "kandinsky-improvisation", artist: "Василий Кандинский", title: "Импровизация № 30. Пушки", year: "1913", collection: "Авангард", wall: "#e8e2d7", tone: "light" },
  { id: "art-malevich", file: "malevich-composition", artist: "Казимир Малевич", title: "Супрематическая композиция", year: "1916", collection: "Авангард", wall: "#e5e2da", tone: "light" },
  { id: "art-mondrian", file: "mondrian-lozenge", artist: "Пит Мондриан", title: "Ромбическая композиция", year: "1921", collection: "Авангард", wall: "#e6e6e1", tone: "light" },
];

export const artworkThemes = artworks.map((work) => work.id);

export function artworkFor(theme) {
  return artworks.find((work) => work.id === theme) || null;
}

export function artworkUrl(work) {
  return `/assets/art/${work.file}.webp`;
}

export function artworkThumbnailUrl(work) {
  return `/assets/art/thumbs/${work.file}.webp`;
}
