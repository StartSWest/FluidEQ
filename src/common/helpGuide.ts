/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import DSP_CHAPTERS from './helpChapters/dsp';
import LISTEN_CHAPTERS from './helpChapters/listen';
import type { IHelpChapter } from './helpChapters/model';
import PLUS_CHAPTERS from './helpChapters/plus';
import SOUND_CHAPTERS from './helpChapters/sound';
import START_CHAPTERS from './helpChapters/start';
import VISUAL_CHAPTERS from './helpChapters/visuals';

/**
 * The user guide's chapters, their captures, and the controls each capture
 * explains. The shipped reader and the exported documents both read this, so
 * a capture renamed here cannot leave either behind.
 *
 * The chapters themselves live in `helpChapters/`, one module per part of the
 * guide: in one file they had grown past eleven hundred lines, most of it
 * boxes, and every retaken capture meant scrolling through all of them.
 */

export type {
  IHelpChapter,
  IHelpControl,
  IHelpFigure,
  THelpBox,
  THelpGroup,
} from './helpChapters/model';
export { HELP_GROUPS } from './helpChapters/model';

/**
 * What a capture is drawn down by, so it is never shown larger than it was
 * on screen: drawn to the reading column's full width, the
 * band menu came out nearly three times its size and EQ mode 2,229px tall.
 * The whole-window captures are wider than any column either way.
 */
export const HELP_CAPTURE_SCALE = 1.5;

/**
 * The tallest a capture is drawn, as a share of the window's height, so a tall
 * panel shrinks to be read above its numbered list instead of scrolled past.
 * Enlarging it still shows every pixel.
 */
export const HELP_CAPTURE_MAX_VIEWPORT = 0.72;

/** In reading order: the modules follow the guide's groups. */
const CHAPTERS = [
  ...START_CHAPTERS,
  ...SOUND_CHAPTERS,
  ...DSP_CHAPTERS,
  ...VISUAL_CHAPTERS,
  ...PLUS_CHAPTERS,
  ...LISTEN_CHAPTERS,
] as const;

export type HelpChapterId = (typeof CHAPTERS)[number]['id'];

/** Every capture the guide shows, once. */
export type THelpImage = (typeof CHAPTERS)[number]['figures'][number]['image'];

/**
 * The chapters, read as chapters. The literal lists keep the ids and file
 * names exact; read through them directly, a figure without a caption or
 * controls has no such property at all rather than an optional one.
 */
export const HELP_CHAPTERS: readonly IHelpChapter<HelpChapterId, THelpImage>[] =
  CHAPTERS;
