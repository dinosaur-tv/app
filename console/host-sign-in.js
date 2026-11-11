/**
 * The console framed inside DinoOS signs itself in: when it has no session it asks the page
 * around it, and DinoOS — already signed in as its owner — answers with a one-time code.
 * Only the hosts named here are asked or listened to; anyone else framing the console gets
 * nothing and can hand it nothing.
 */
export const TRUSTED_HOSTS = ["https://dashboard.dym-dino.ru"];

export function createHostSignIn({ win, claim, hosts = TRUSTED_HOSTS }) {
  let asked = false;
  win.addEventListener("message", async (event) => {
    if (!hosts.includes(event.origin) || event.source !== win.parent) return;
    const data = event.data;
    if (!data || data.type !== "dino-tv:sign-in-code" || typeof data.code !== "string" || !/^\d{8}$/.test(data.code)) return;
    if (await claim(data.code)) asked = false;
  });
  return {
    /** Once per signed-out spell: a refused code is not asked for again in a loop. */
    ask() {
      if (win.parent === win || asked) return;
      asked = true;
      for (const host of hosts) win.parent.postMessage({ type: "dino-tv:sign-in-needed" }, host);
    },
  };
}
