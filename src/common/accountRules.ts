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

/** Something with an @ and a dot after it. The server does the real check. */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isCode = (value: string): boolean =>
  new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value);
