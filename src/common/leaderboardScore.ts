/**
 * How a place on the leaderboard is scored.
 *
 * The server ranks — the migrations in the private repository compute the
 * points in the database, where no copy of the app can change them — and this
 * says the same numbers so the app can explain them: it splits a score into
 * the parts it came from, lists the rules beside the board, and scores the
 * development sample cast. A change here without the migration beside it is a
 * board whose explanation disagrees with its order.
 *
 * Two things score: listening, and the likes a member's scenes receive.
 * Everyone earns them the same way, the maker included. Messages and mentions
 * in the community's channels scored too until the channels were removed in
 * favour of the Forum tab (migration 0014); an earlier version paid fifty
 * points for a reply from the maker, which made the board a measure of being
 * noticed by one person instead of a measure of taking part.
 *
 * A like is worth five points: one per member per scene, never on the
 * author's own, so it cannot be farmed by clicking and a scene that many
 * people enjoy is a real contribution.
 */

export type TScorePart = 'hours' | 'days' | 'likes';

/** In the order the parts are listed and drawn: the steady ones first. */
export const SCORE_PARTS: readonly TScorePart[] = ['hours', 'days', 'likes'];

/** Points per unit of each part. */
export const PART_POINTS: Readonly<Record<TScorePart, number>> = {
  hours: 10,
  days: 20,
  likes: 5,
};

/** Listening past this in a day is a machine left playing, not a person. */
export const DAILY_LISTENING_CAP_HOURS = 16;

/** A day with at least this much listening counts as an active day. */
export const ACTIVE_DAY_MINUTES = 30;

/**
 * How far back a day of listening is still accepted. The server drops older
 * days, so the app neither keeps nor sends them. It matches the fortnight Plus
 * keeps working offline, after which there is nothing to rank anyway.
 */
export const LISTENING_WINDOW_DAYS = 14;

/**
 * The least time between two uploads triggered by somebody coming back to the
 * machine. Opening the board sends at once regardless: it is the moment a
 * person wants to see their own minutes on it.
 */
export const LISTENING_UPLOAD_INTERVAL_HOURS = 4;

export interface IScoreInputs {
  minutes: number;
  activeDays: number;
  /** Likes other members gave the scenes this person made. */
  likes: number;
}

/**
 * Points per part. Listening counts whole points only, as the server's integer
 * division does: ten an hour is one per six minutes, and a stray five minutes
 * is worth nothing yet.
 */
export const scoreParts = (
  score: IScoreInputs,
): Readonly<Record<TScorePart, number>> => ({
  hours: Math.floor((score.minutes * PART_POINTS.hours) / 60),
  days: score.activeDays * PART_POINTS.days,
  likes: score.likes * PART_POINTS.likes,
});

export const scoreOf = (score: IScoreInputs): number => {
  const parts = scoreParts(score);
  return SCORE_PARTS.reduce((sum, part) => sum + parts[part], 0);
};
