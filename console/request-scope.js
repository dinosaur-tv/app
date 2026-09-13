// Which calls may be made before you have an account, and before you have a home.
// This list is the reason the sign-in screen works at all, and it has broken twice by
// drifting out of step with the routes — hence its own module and its own tests.
const WITHOUT_ACCOUNT = ["/v1/miniapp/login", "/v1/miniapp/logout", "/v1/miniapp/pair/approve"];
const WITHOUT_HOME = [...WITHOUT_ACCOUNT, "/v1/miniapp/households"];

const matches = (list, path) => list.some((prefix) => path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?"));

/** True when the call cannot be made yet: it needs a home and none is chosen. */
export function needsHome(path) {
  return !matches(WITHOUT_HOME, path);
}

/** True when the call cannot be made yet: it needs an account and nobody is signed in. */
export function needsAccount(path) {
  return !matches(WITHOUT_ACCOUNT, path);
}
