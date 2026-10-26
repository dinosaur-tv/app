// Filmed loops under the clock. Each loop's first frame is also the scene's still picture
// (assets/scenes/<name>.webp), so the swap from the poster to the moving video never shows.
export const videoScenes = ["fireplace", "campfire", "rain-glass", "window-streams", "snowfall", "aurora", "starry-sky", "forest-stream", "mist-lake"];

export function sceneVideoUrl(scene) {
  return videoScenes.includes(scene) ? `/assets/scenes/motion/${scene}.mp4` : "";
}

const video = document.querySelector("#sceneVideo");
let wanted = "";

function showWhenMoving() {
  document.body.classList.add("video-live");
}

if (video) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = true;
  video.addEventListener("playing", showWhenMoving);
  // A loop that fails (no codec, a WebView that refuses to start media) leaves the poster.
  video.addEventListener("error", () => document.body.classList.remove("video-live"));
}

/**
 * Starts, swaps or stops the loop. `running` is false while the screen sleeps or the app
 * is behind another one: a paused video costs nothing, a hidden playing one still decodes.
 */
export function paintSceneVideo(scene, { running = true, customPhoto = false } = {}) {
  if (!video) return;
  const url = customPhoto ? "" : sceneVideoUrl(scene);
  document.body.classList.toggle("video-scene", Boolean(url));
  if (url !== wanted) {
    wanted = url;
    document.body.classList.remove("video-live");
    if (!url) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      return;
    }
    video.src = url;
  }
  if (!url) return;
  if (running && video.paused) {
    const started = video.play();
    if (started?.catch) started.catch(() => document.body.classList.remove("video-live"));
  } else if (!running && !video.paused) {
    video.pause();
  }
}
