/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IHelpFigure } from './model';

/**
 * WRITTEN BY `scripts/help-captures/capture.ts`; do not edit by hand.
 *
 * The figures that script takes, each with the boxes of its numbered
 * controls as measured in the same render as the picture in `docs/`. Retake
 * a picture and its boxes come with it: run the script again (its README says
 * how), never move a box here.
 */
const CAPTURED = {
  '14-share-audio-roles.png': {
    image: '14-share-audio-roles.png',
    width: 2560,
    height: 1392,
  },
} as const satisfies Record<string, IHelpFigure>;

export default CAPTURED;
