/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { HELP_CHAPTERS } from 'common/helpGuide';
import { runsOnLinux } from '../utils/platform';

/**
 * Chapters about what only Windows has: desktop backgrounds sit behind
 * Windows' own desktop icons, and Dynamic lighting goes through Windows
 * Dynamic Lighting and Razer Chroma's Windows service.
 */
const WINDOWS_ONLY = new Set<string>(['desktop', 'lighting']);

/**
 * The guide as this window reads it: every chapter, less those on Linux.
 * The chapters' numbers follow what is shown, so a hidden chapter leaves no
 * gap.
 */
const shownHelpChapters = (): typeof HELP_CHAPTERS =>
  runsOnLinux()
    ? HELP_CHAPTERS.filter((chapter) => !WINDOWS_ONLY.has(chapter.id))
    : HELP_CHAPTERS;

export default shownHelpChapters;
