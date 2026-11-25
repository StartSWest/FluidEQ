/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IHelpLayout } from '../../common/helpCallouts';

/**
 * The last captures the guide shipped with numbered controls (2.5, before
 * every figure became live in 2.6), each with the boxes measured in the same
 * render as its picture. The call-out planner still lays out every live
 * figure, and these are real layouts to hold it to: crowded menus, a row of
 * tabs, a tall rail, a wide page.
 */
const SHIPPED_CAPTURES: readonly (IHelpLayout & { readonly image: string })[] =
  [
    {
      image: '39-rail-left.png',
      width: 140,
      height: 1270,
      controls: [
        { box: [18, 22, 96, 123] },
        { box: [18, 166, 96, 123] },
        { box: [18, 297, 96, 43] },
        { box: [18, 361, 96, 43] },
        { box: [18, 425, 96, 827] },
      ],
    },
    {
      image: '15-engine-dialog.png',
      width: 832,
      height: 453,
      controls: [
        { box: [309, 65, 478, 159] },
        { box: [309, 232, 478, 119] },
        { box: [743, 389, 54, 32] },
      ],
    },
    {
      image: '17-band-menu.png',
      width: 236,
      height: 311,
      controls: [
        { box: [26, 140, 188, 34] },
        { box: [26, 175, 188, 34] },
        { box: [26, 220, 188, 34] },
        { box: [26, 255, 188, 34] },
      ],
    },
    {
      image: '19-band-designs.png',
      width: 358,
      height: 286,
      controls: [{ box: [29, 91, 300, 70] }, { box: [219, 225, 111, 32] }],
    },
    {
      image: '21-graph-strip.png',
      width: 694,
      height: 44,
      controls: [
        { box: [12, 8, 81, 28] },
        { box: [102, 13, 16, 18] },
        { box: [128, 8, 194, 28] },
        { box: [332, 13, 16, 18] },
        { box: [358, 8, 99, 28] },
        { box: [468, 13, 18, 18] },
        { box: [496, 8, 67, 28] },
        { box: [572, 13, 18, 18] },
        { box: [600, 13, 18, 18] },
        { box: [628, 8, 56, 28] },
      ],
    },
    {
      image: '22-graph-strip-plus.png',
      width: 767,
      height: 44,
      controls: [
        { box: [513, 8, 94, 28] },
        { box: [461, 8, 42, 28] },
        { box: [617, 13, 18, 18] },
        { box: [645, 13, 18, 18] },
      ],
    },
  ];

export default SHIPPED_CAPTURES;
