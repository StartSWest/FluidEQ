/**
 * What the sign-in form and the main process both check before a request.
 *
 * Shared so the form can disable its button on the same rule the main process
 * refuses on — a form that lets something through which the other side then
 * silently drops is a button that does nothing.
 */

/** The one-time code from the email: six digits, nothing else. */
export const CODE_LENGTH = 6;

/** The shortest password accepted, matched by the server's own setting. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 80;

/** Something with an @ and a dot after it. The server does the real check. */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validAccountEmail = (value: string): boolean =>
  value.trim().length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(value.trim());

/** Existing passwords are checked by the service, not today's signup minimum. */
export const validAccountPassword = (
  value: string,
  creating: boolean,
): boolean =>
  value.length >= (creating ? MIN_PASSWORD_LENGTH : 1) &&
  value.length <= MAX_PASSWORD_LENGTH;

export const isCode = (value: string): boolean =>
  new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value);
