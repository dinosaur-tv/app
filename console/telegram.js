export function shouldLoadTelegramSdk({
  hasTelegram = false,
  isNative = false,
  userAgent = "",
  hasTelegramProxy = false,
} = {}) {
  if (hasTelegram || isNative) return false;
  return Boolean(hasTelegramProxy) || /Telegram/i.test(userAgent);
}
