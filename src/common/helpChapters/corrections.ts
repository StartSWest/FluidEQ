/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/**
 * Headphone corrections and Convolution, the EQ page's two correction pages,
 * read in place inside the sound chapters (`sound.ts`).
 */
const CORRECTION_CHAPTERS = [
  {
    id: 'headphones',
    group: 'sound',
    // Headphone corrections as it opens, on My curves with three made-up
    // curves (help/live/headphonesFigure).
    figures: [
      {
        live: 'headphones-page',
        width: 1000,
        height: 470,
        still: 'help/headphones-page.png',
        controls: [
          {
            target: '.autoeq-panel__libraries',
            name: 'help.headphones.tabsName',
            text: 'help.headphones.tabs',
          },
          {
            target: '.autoeq-update',
            name: 'help.headphones.libraryName',
            text: 'help.headphones.library',
          },
          {
            target: '.my-curves__pair:last-child .button:not(.subtle)',
            name: 'myCurves.add',
            text: 'help.headphones.add',
          },
          {
            target: '.my-curves__search',
            name: 'help.headphones.searchName',
            text: 'help.headphones.search',
          },
          {
            target:
              '.my-curves__list > li:nth-child(2) .my-curve__actions > .button:nth-child(2)',
            name: 'squigImport.apply',
            text: 'help.headphones.applyEq',
          },
          {
            target: '.my-curves__list > li:nth-child(3) .my-curve__more-button',
            name: 'help.headphones.moreName',
            text: 'help.headphones.more',
          },
        ],
      },
    ],
  },
  { id: 'mycurves', group: 'sound', figures: [] },
  {
    id: 'convolution',
    group: 'sound',
    // The Convolution page with one impulse applied and a model searched
    // (help/live/convolutionFigure).
    figures: [
      {
        live: 'convolution-page',
        width: 1000,
        height: 470,
        still: 'help/convolution-page.png',
        controls: [
          {
            target: '.convolution-panel__intro .convolution-button',
            name: 'convolution.import',
            text: 'help.convolution.import',
          },
          {
            target: '.convolution-applied',
            name: 'convolution.applied',
            text: 'help.convolution.applied',
          },
          {
            target: '.convolution-search__field',
            name: 'convolution.search',
            text: 'help.convolution.search',
          },
          {
            target:
              '.convolution-result:nth-child(2) .convolution-result__details',
            name: 'help.convolution.resultName',
            text: 'help.convolution.result',
          },
          {
            target: '.convolution-result:nth-child(2) .convolution-button',
            name: 'convolution.apply',
            text: 'help.convolution.apply',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default CORRECTION_CHAPTERS;
