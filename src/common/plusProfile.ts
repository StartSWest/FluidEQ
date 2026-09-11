/**
 * The member's name — the @handle and display name the leaderboard ranks and
 * the Visualizers gallery credits — as both processes know it.
 *
 * The rules are the server's (a unique handle, a check on its shape, a name of
 * at most forty characters); they are repeated here so the form can say what
 * is wrong before anything is sent, and main can refuse a malformed one
 * before it costs a request.
 */

export type TPlusRole = 'member' | 'admin';

export interface IPlusProfile {
  userId: string;
  handle: string;
  displayName: string;
  role: TPlusRole;
}

/** Exhaustive, so each has a sentence in every language. */
export type TProfileFailure =
  'handle_taken' | 'signed_out' | 'network' | 'rejected';

/** Letters, numbers and underscores, 3 to 20. */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

export const MAX_HANDLE = 20;

export const MAX_DISPLAY_NAME = 40;
