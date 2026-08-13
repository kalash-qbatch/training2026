/** Normal login session length (hours). */
export const SESSION_DURATION_HOURS: number = 24;

/** Session length when "Remember me" is checked (hours). */
export const REMEMBER_ME_DURATION_HOURS: number = 48; // 2 days

export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_HOURS * 60 * 60;
export const REMEMBER_ME_MAX_AGE_SECONDS = REMEMBER_ME_DURATION_HOURS * 60 * 60;

export const SESSION_EXPIRY_DEFAULT = SESSION_MAX_AGE_SECONDS;
export const SESSION_EXPIRY_REMEMBER_ME = REMEMBER_ME_MAX_AGE_SECONDS;

export function sessionMaxAgeSeconds(remember?: boolean): number {
  return remember ? REMEMBER_ME_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
}

/** Change this one value to control reset-link lifetime (minutes). */
export const RESET_TOKEN_EXPIRY_MINUTES: number = 10;

export const RESET_TOKEN_EXPIRY_MS = RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000;

export function resetTokenExpiryLabel(): string {
  const m = RESET_TOKEN_EXPIRY_MINUTES;
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = m / 60;
  if (Number.isInteger(h)) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${m} minutes`;
}

export function getResetTokenExpiryDate(from = new Date()): Date {
  return new Date(from.getTime() + RESET_TOKEN_EXPIRY_MS);
}
