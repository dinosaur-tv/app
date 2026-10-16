// Small composited particles keep the native WebView moving without repainting
// a full-screen photograph or animating expensive blur filters.
export function sceneMotion(scene) {
  if (scene === "forest" || scene === "autumn-forest") return { kind: "leaf", count: 18 };
  if (["night", "space", "aurora"].includes(scene)) return { kind: "star", count: 32 };
  if (["sea", "venice", "peterhof", "oranienbaum", "mist-lake"].includes(scene)) return { kind: "glint", count: 18 };
  if (scene === "mountains") return { kind: "snow", count: 20 };
  return { kind: "mote", count: 14 };
}

let currentScene = "";

export function paintSceneMotion(scene, customPhoto = false) {
  const key = customPhoto ? "photo" : scene;
  if (key === currentScene) return;
  currentScene = key;
  const layer = document.querySelector("#sceneParticles");
  layer.replaceChildren();
  layer.dataset.motion = customPhoto ? "none" : sceneMotion(scene).kind;
  if (customPhoto) return;
  const { kind, count } = sceneMotion(scene);
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("i");
    // Deterministic positions avoid flicker when snapshots or agenda pages refresh.
    const x = (index * 37 + 7) % 100;
    const y = kind === "glint" ? 58 + (index * 11 % 38)
      : (index * 23 + 3) % (kind === "star" && scene !== "space" ? 60 : 100);
    const duration = (kind === "star" ? 3 : 12) + index * 7 % 13;
    particle.style.cssText = `--x:${x}%;--y:${y}%;--duration:${duration}s;--delay:-${index * 2.7 + 1}s;--size:${.55 + index % 5 * .16};--sway:${index % 2 ? 1 : -1};`;
    layer.append(particle);
  }
  if (kind === "star") {
    for (let index = 0; index < 2; index += 1) {
      const meteor = document.createElement("i");
      meteor.className = "meteor";
      meteor.style.cssText = `--x:${64 + index * 24}%;--y:${8 + index * 17}%;--duration:${13 + index * 6}s;--delay:-${index * 7 + 2}s;`;
      layer.append(meteor);
    }
  }
}
