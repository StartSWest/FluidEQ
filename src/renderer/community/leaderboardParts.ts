import type { TranslationKey } from 'common/i18n/en';
import type { TScorePart } from 'common/leaderboardScore';
import type { TCommunityGlyph } from './Glyph';

/**
 * What each part of a score is called and drawn as, wherever it appears: the
 * standing bar's key, the guide beside the board and the figures under every
 * name. One table, so a part cannot wear two pictures on the same screen.
 */

export const PART_KEYS: Readonly<Record<TScorePart, TranslationKey>> = {
  hours: 'leaderboard.part.hours',
  days: 'leaderboard.part.days',
  messages: 'leaderboard.part.messages',
  mentions: 'leaderboard.part.mentions',
};

export const PART_GLYPHS: Readonly<Record<TScorePart, TCommunityGlyph>> = {
  hours: 'headphones',
  days: 'calendar',
  messages: 'general',
  mentions: 'mention',
};
