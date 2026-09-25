/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  canonicalGraphStyle,
  GRAPH_STYLES,
  SELECTABLE_GRAPH_STYLES,
} from '../../../common/graphStyles';
import {
  promptWithIdea,
  SCENE_FALLBACK_STYLES,
} from '../../../renderer/studio/aiPrompt';

describe('the fallback forms the scene brief offers', () => {
  it('are forms the app still draws as themselves', () => {
    // A retired form still loads but lands on the Analyzer or the RTA, so a
    // brief offering one would have authors choose what nobody ever sees.
    SCENE_FALLBACK_STYLES.forEach((style) => {
      expect(GRAPH_STYLES).toContain(style);
      expect(canonicalGraphStyle(style)).toBe(style);
    });
  });

  it('leave out the measuring views and nothing else', () => {
    // Every other selectable form is offered, so a visualizer added to the
    // app is offered to scene authors without anybody editing the brief.
    const offered = new Set(SCENE_FALLBACK_STYLES);
    const leftOut = SELECTABLE_GRAPH_STYLES.filter((s) => !offered.has(s));
    expect(leftOut).toEqual([
      'analyzer',
      'compare',
      'spectrogram',
      'rta',
      'average',
      'waterfall',
      'loudness',
      'scope',
      'midside',
      'notes',
      'energy',
      'phase',
    ]);
  });

  it('are exactly the ones the brief lists', () => {
    expect(promptWithIdea('')).toContain(
      `Use one of:\n  ${SCENE_FALLBACK_STYLES.join(', ')}.`,
    );
  });

  it('include the form the brief uses as its example', () => {
    expect(promptWithIdea('')).toContain('"fallbackStyle": "skyline",');
    expect(SCENE_FALLBACK_STYLES).toContain('skyline');
  });
});
