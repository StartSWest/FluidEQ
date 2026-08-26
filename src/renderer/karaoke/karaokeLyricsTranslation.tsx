/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ReactNode, useMemo, useRef, useState } from 'react';
import { IKaraokeLine, IKaraokeSong } from '../../common/karaoke/types';
import { KARAOKE_ORIGINAL_LANGUAGE } from '../../common/karaoke/makerProject';
import { karaokeLanguageName } from './karaokeLanguageName';
import {
  clamp,
  groupKaraokeTokensIntoWords,
  karaokeVisualWordDisplayText,
  LYRIC_FONT_FAMILY,
} from './karaokeLyricText';

/**
 * The player's second lyric row: which language it shows, and how it is
 * painted.
 *
 * `useKaraokeLyricsTranslationSelection` and `karaokeLyricsTranslationOptions`
 * are the pure-derivation half — which sheet is selected, whether its row is
 * empty, the picker's own option list — pulled out of `KaraokeLyrics.tsx` so
 * that render component holds only the JSX and the draw loop, not the state
 * arithmetic behind them.
 *
 * `karaokeLyricsTranslationBudget` and `paintKaraokeLyricsTranslationLine`
 * below are the paint half: one quiet, line-level label under whichever
 * language is currently focused, painted without the original's per-word
 * highlight.
 *
 * No highlight, ever, on purpose. `KaraokeLyrics.tsx` times its progress fill
 * to the Nth *original* word, and a translation's word order is not the
 * original's — the third Spanish word is routinely not what is being sung
 * when the third English word lights up. A wrong highlight reads as
 * confident and is worse than none, so this row paints static text only, the
 * same rule Task 9 wrote into the Maker's own
 * `makerCanvas/paintTranslation.ts`.
 *
 * The other half of that task's lesson is what this module exists to keep out
 * of `KaraokeLyrics.tsx`'s own draw loop: a second row of text is a budgeted
 * addition to the lane it sits under, never whatever height that lane
 * happened to have left over. `karaokeLyricsTranslationBudget` is the budget;
 * the caller adds its `rowHeight` to `rowSpacing` once per frame, before any
 * line is measured or placed, so every visible line's slot grows by the same
 * fixed amount regardless of which one is actually focused that frame.
 */

export interface IKaraokeLyricsTranslationSelection {
  /** `song.meta.language`, or the sentinel for a project that never declared
   * one. Never compared against directly elsewhere -- see the field's own
   * use below. */
  originalLanguage: string;
  translations: readonly { language: string; lines: IKaraokeLine[] }[];
  hasTranslations: boolean;
  /** The language currently showing as the second row -- `originalLanguage`
   * means "no row". Either this instance's own picker state, or, when
   * `externalLanguage` was supplied, exactly that value. */
  translationLanguage: string;
  /** Drives this instance's own picker. Harmless to call when an
   * `externalLanguage` is in effect -- nothing reads the state it would set. */
  setTranslationLanguage: (language: string) => void;
  /** The selected sheet exists but has no playable lines: the row must say
   * so rather than paint nothing. */
  isSelectedTranslationEmpty: boolean;
  /** Undefined means no row this frame. Rebuilt only when the selected sheet
   * itself changes, not every frame: sixty times a second across up to seven
   * visible lines is a lot of token-joining for text that only changes when
   * the picker does. */
  translationTextById?: Map<string, string>;
}

/**
 * Which translation is showing, and everything derived from that choice.
 *
 * `externalLanguage`, when supplied, overrides this instance's own picker
 * state entirely -- see `KaraokeLyrics.tsx`'s `translationLanguage` prop for
 * why an embedded preview needs this: its own picker is hidden, but the row
 * still has to paint whatever an *external* picker (the Maker's toolbar)
 * selected.
 */
export const useKaraokeLyricsTranslationSelection = (
  song: IKaraokeSong,
  externalLanguage?: string,
): IKaraokeLyricsTranslationSelection => {
  // Never compared against directly to detect the original: a project that
  // declares a language (every UltraStar import does) uses that real tag
  // instead, and this sentinel is only the fallback for one that never did.
  // Mirrors `KaraokeMakerToolbar.tsx`'s own `originalLanguage`.
  const originalLanguage = song.meta.language ?? KARAOKE_ORIGINAL_LANGUAGE;
  const translations = song.translations ?? [];
  const hasTranslations = translations.length > 0;
  const [pickedLanguage, setPickedLanguage] = useState(originalLanguage);
  // Reset synchronously with the incoming song, same as KaraokeLyrics.tsx's
  // own entranceStateRef: a stale language tag left over from the previous
  // song would either paint the wrong translation for one frame or fail to
  // find a sheet at all before this could otherwise run as an effect.
  const songIdRef = useRef(song.id);
  if (songIdRef.current !== song.id) {
    songIdRef.current = song.id;
    setPickedLanguage(originalLanguage);
  }
  const translationLanguage = externalLanguage ?? pickedLanguage;
  const activeTranslationSheet =
    translationLanguage === originalLanguage
      ? undefined
      : translations.find((entry) => entry.language === translationLanguage);
  const isSelectedTranslationEmpty =
    activeTranslationSheet !== undefined &&
    activeTranslationSheet.lines.length === 0;
  const translationTextById = useMemo(
    () =>
      activeTranslationSheet
        ? karaokeLyricsTranslationTextById(activeTranslationSheet.lines)
        : undefined,
    [activeTranslationSheet],
  );

  return {
    originalLanguage,
    translations,
    hasTranslations,
    translationLanguage,
    setTranslationLanguage: setPickedLanguage,
    isSelectedTranslationEmpty,
    translationTextById,
  };
};

export interface IKaraokeLyricsTranslationOption {
  value: string;
  label: string;
  display: ReactNode;
}

/**
 * The picker's own option list: the original first, named by `originalLabel`
 * (the caller's own translated "As recorded" string, since this module has
 * no `t()` of its own), then every translation named by its endonym.
 */
export const karaokeLyricsTranslationOptions = (
  originalLanguage: string,
  translations: readonly { language: string; lines: IKaraokeLine[] }[],
  originalLabel: string,
): IKaraokeLyricsTranslationOption[] => [
  {
    value: originalLanguage,
    label: originalLabel,
    display: originalLabel,
  },
  ...translations.map((entry) => ({
    value: entry.language,
    label: karaokeLanguageName(entry.language),
    // `lang` so Chromium picks the right face per script: the Han characters
    // are not the same shapes drawn Chinese or Japanese.
    display: (
      <span lang={entry.language}>{karaokeLanguageName(entry.language)}</span>
    ),
  })),
];

/**
 * Mirrors `$weight-regular` (400) in `_theme.scss`. A canvas `font` string
 * takes a plain number, not a Sass variable, so this is the same scale
 * spelled for a context that cannot import it — and never past
 * `$weight-bold`, the ceiling this project measured at UI sizes before 800
 * and 900 turned into `Segoe UI Black`. The original row already reaches for
 * 720-900; staying at the scale's lightest weight is what makes this one read
 * as quieter rather than merely smaller.
 */
const TRANSLATION_FONT_WEIGHT = 400;

/**
 * Reused, not invented: the same quiet secondary tone
 * `.karaoke-maker__lyrics-line-number` in Karaoke.scss already uses for a
 * line's own metadata, and the exact value the Maker's own
 * `makerCanvas/paintTranslation.ts` reused for the same reason.
 */
const TRANSLATION_TEXT_COLOR = 'rgba(169, 204, 216, 0.58)';

export interface IKaraokeLyricsTranslationBudget {
  /** This row's own font size, fixed for the frame — see the module doc. */
  fontSize: number;
  /** Clearance between the original line's own bottom edge and this row. */
  gap: number;
  /**
   * How much this frame's `rowSpacing` must grow by. Added once, outside the
   * per-line loop, so it is the same for every visible line regardless of
   * which one is focused — see the module doc comment.
   */
  rowHeight: number;
}

/**
 * Budgeted off the same `width`/`rowSpacing` the original lyric geometry
 * already scales by, never a literal painted for one particular pitch: a
 * resized window, or the reader's own text-size slider, changes this exactly
 * as it changes everything else in `KaraokeLyrics.tsx`.
 */
export const karaokeLyricsTranslationBudget = (
  width: number,
  rowSpacing: number,
  textScale: number,
): IKaraokeLyricsTranslationBudget => {
  // 10-13px: close to the original row's own smallest resting size
  // (12-17px, see KaraokeLyrics.tsx), which is what "as quiet as a line
  // already at rest" looks like. Always well under the original's focused
  // range (22-38px), so the two rows never compete for attention.
  const fontSize = clamp(width * 0.0105, 10, 13) * textScale;
  // 3-8px, a fraction of the row the lines already scale by — grows and
  // shrinks with the same 38-96px range `rowSpacing` is clamped to.
  const gap = clamp(rowSpacing * 0.08, 3, 8);
  return { fontSize, gap, rowHeight: gap + fontSize * 1.2 };
};

/**
 * Every translatable line's plain text, keyed by the id the original line at
 * the same position was stamped with — see `song.ts`'s
 * `karaokeMakerProjectToSong` for why the ids match.
 *
 * Section markers are excluded. They carry the same bracketed label in every
 * sheet, so a second copy of "[Chorus]" under the first would be noise, not a
 * translation.
 */
export const karaokeLyricsTranslationTextById = (
  lines: readonly IKaraokeLine[],
): Map<string, string> => {
  const textById = new Map<string, string>();
  lines.forEach((line) => {
    if (line.kind === 'section') {
      return;
    }
    const words = groupKaraokeTokensIntoWords(line.tokens);
    let text = '';
    words.forEach((word, index) => {
      text += karaokeVisualWordDisplayText(word, index, words[index - 1]);
    });
    if (text) {
      textById.set(line.id, text);
    }
  });
  return textById;
};

export interface IKaraokeLyricsTranslationLineInput {
  context: CanvasRenderingContext2D;
  /** Canvas width in CSS pixels, for centring and the overflow fit below. */
  width: number;
  /** The original line's own vertical centre this frame. */
  y: number;
  /**
   * The original line's own rendered font size this frame, after its
   * overflow fit — where this row starts is relative to what is actually on
   * screen above it, not to the budget's worst case.
   */
  originalFontSize: number;
  budget: IKaraokeLyricsTranslationBudget;
  /**
   * The original line's own fade — distance-from-centre, entrance, both —
   * reused so the translation dims and enters with the line it belongs to.
   */
  alpha: number;
  text: string;
}

/**
 * One translated line, line-level and unhighlighted — see the module doc for
 * why. Horizontally centred on its own measured width, independent of where
 * the original text starts: a translation is routinely a different length
 * than the words above it, and anchoring it to the original's own left edge
 * would put it off-centre under its own line.
 */
export const paintKaraokeLyricsTranslationLine = ({
  context,
  width,
  y,
  originalFontSize,
  budget,
  alpha,
  text,
}: IKaraokeLyricsTranslationLineInput): void => {
  if (!text || alpha <= 0) {
    return;
  }
  context.save();
  context.globalAlpha = alpha;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = TRANSLATION_TEXT_COLOR;
  let { fontSize } = budget;
  context.font = `${TRANSLATION_FONT_WEIGHT} ${fontSize}px ${LYRIC_FONT_FAMILY}`;
  const textWidth = context.measureText(text).width;
  // Matches the original line's own overflow fit in KaraokeLyrics.tsx: shrink
  // to the available width rather than clip mid-word. The vertical placement
  // below stays keyed to `budget.fontSize`, not this shrunk value, so a long
  // translation never nudges this row's own height and drifts it against the
  // next line.
  const availableWidth = Math.max(1, width - 40);
  if (textWidth > availableWidth) {
    fontSize = Math.max(1, fontSize * (availableWidth / textWidth));
    context.font = `${TRANSLATION_FONT_WEIGHT} ${fontSize}px ${LYRIC_FONT_FAMILY}`;
  }
  // 0.68 is the original line's own half-height, the same fraction
  // KaraokeLyrics.tsx already uses to size that line's hit region
  // (`y - fontSize * 0.68` / `y + fontSize * 0.68`) -- reused here rather
  // than re-derived, so this row starts exactly where that hit region ends.
  // 0.6 is this row's own half-height, at `textBaseline: 'middle'`.
  const translationY =
    y + originalFontSize * 0.68 + budget.gap + budget.fontSize * 0.6;
  context.fillText(text, width / 2, translationY);
  context.restore();
};
