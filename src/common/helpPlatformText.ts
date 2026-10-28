/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { HELP_CHAPTERS, isLiveFigure, type HelpChapterId } from './helpGuide';
import type { TranslationKey } from './i18n';

/**
 * The guide where the FluidEQ Engine is part of the app (macOS).
 *
 * The guide was written for Windows' engine: chosen at setup, installed into
 * Windows' audio service with a permission prompt, mended by restarting
 * Windows audio. On a Mac none of that exists, and a guide that tells somebody
 * to press a button their window does not have is worse than one that says
 * nothing. Two chapters are about nothing else and are left out; the lines
 * elsewhere that mention it have a Mac wording of their own, `<key>.mac`,
 * with as many lines as the Windows one has in that language's Mac copy, so
 * the search's pairing of a translated line with its English one holds.
 */
const WINDOWS_ONLY_CHAPTERS: ReadonlySet<HelpChapterId> = new Set([
  'requirements',
  'engine',
]);

const MAC_TEXT: Partial<Record<TranslationKey, TranslationKey>> = {
  'help.start.steps': 'help.start.steps.mac',
  'help.start.tip': 'help.start.tip.mac',
  'help.window.tip': 'help.window.tip.mac',
  'help.window.actions': 'help.window.actions.mac',
  'help.trouble.steps': 'help.trouble.steps.mac',
};

/** The line to read for `key` on this platform. */
export const helpTextKey = (
  key: TranslationKey,
  isEngineBuiltIn: boolean,
): TranslationKey => (isEngineBuiltIn ? (MAC_TEXT[key] ?? key) : key);

/**
 * The chapters this platform's guide shows, each figure's lines already the
 * platform's, so everything that draws a figure reads the right one without
 * asking.
 */
export const helpChaptersFor = (
  isEngineBuiltIn: boolean,
): typeof HELP_CHAPTERS =>
  isEngineBuiltIn
    ? HELP_CHAPTERS.filter(
        (chapter) => !WINDOWS_ONLY_CHAPTERS.has(chapter.id),
      ).map((chapter) => ({
        ...chapter,
        // Live panels address controls by selector; captures use pixel boxes.
        // Keep that distinction when applying the Mac-only wording.
        figures: chapter.figures.map((figure) => {
          if (!figure.controls) {
            return figure;
          }
          return isLiveFigure(figure)
            ? {
                ...figure,
                controls: figure.controls?.map((control) => ({
                  ...control,
                  text: helpTextKey(control.text, true),
                })),
              }
            : {
                ...figure,
                controls: figure.controls.map((control) => ({
                  ...control,
                  text: helpTextKey(control.text, true),
                })),
              };
        }),
      }))
    : HELP_CHAPTERS;
