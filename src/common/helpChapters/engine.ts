/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/** Choosing the audio engine, the last of the start chapters (`start.ts`). */
const ENGINE_CHAPTER = {
  id: 'engine',
  group: 'start',
  figures: [
    {
      // The engine dialog drawn by its own frame (help/live/engineFigure).
      live: 'engine-dialog',
      width: 620,
      height: 480,
      frame: '.engine-dialog',
      still: '15-engine-dialog.png',
      controls: [
        {
          target: '.engine-dialog__option:nth-child(1)',
          name: 'engine.fluid.name',
          text: 'help.engine.fluid',
        },
        {
          target: '.engine-dialog__option:nth-child(2)',
          name: 'engine.apo.name',
          text: 'help.engine.apo',
        },
        {
          target: '.engine-dialog__now',
          name: 'help.engine.nowName',
          text: 'help.engine.now',
        },
        {
          target: '.dialog-frame__actions .button:not(.subtle)',
          name: 'engine.apply',
          text: 'help.engine.apply',
        },
      ],
    },
  ],
} as const satisfies IHelpChapter;

export default ENGINE_CHAPTER;
