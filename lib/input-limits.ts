/** Length limits for free-text fields people type in (checked on the server). */

/** Minimum length for a NEW password. Existing shorter passwords still sign in. */
export const MIN_PASSWORD_LENGTH = 8;
/** A person's or child's name. */
export const MAX_NAME_LENGTH = 80;
/** Notes on an order or a child. */
export const MAX_NOTES_LENGTH = 300;

/** True when `value` is a string longer than `max` characters (after trimming). */
export function tooLong(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.trim().length > max;
}

/** Session cookies are always Secure in production; locally they follow the request's protocol. */
export function secureCookie(isHttps: boolean): boolean {
  return process.env.NODE_ENV === 'production' || isHttps;
}
