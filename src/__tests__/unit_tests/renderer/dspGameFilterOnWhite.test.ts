/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Game filter's card on a white window (2026-11-24, the white theme):
 * its inks are lights for a dark window - the calm's amber, the voice's
 * gold, the environment's blue - and as words on white they stood at 1.2 to
 * 2:1, the old engine's notice among them; its lamps glowed. On a light
 * window the amber words take the caution ink, the gold and the blue are
 * held under the light window's ink ceiling, the lamps lose their glow and
 * the voice's lamp fills in the star's deep gold. jsdom paints nothing, so
 * the compiled rules are what is held.
 */

import {
  compileStylesheet,
  styleRules,
  type IRule,
} from '../../utils/stylesheetRules';

// As Sass writes it: the quotes round a plain word are dropped.
const LIGHT = ':root[data-window-ink=dark]';

describe('the Game filter on a white window', () => {
  const rules = styleRules(compileStylesheet('Dsp.scss'));
  const value = (selector: string, property: string) =>
    rules
      .filter((rule: IRule) => rule.selectors.includes(selector))
      .map((rule) => rule.declarations.get(property))
      .filter(Boolean);

  it.each([
    '.dsp-footsteps-engine > p',
    '.dsp-footsteps-status .is-calm',
    '.dsp-footsteps-reach.is-calm',
  ])('writes the amber of %s in the caution ink', (selector) => {
    // Positive control: the dark window's rule is the amber light.
    expect(value(selector, 'color').join(' ')).toMatch(/255, 176, 89|#ffb059/);
    expect(value(`${LIGHT} ${selector}`, 'color')).toEqual([
      'var(--ink-caution, #ffb059)',
    ]);
  });

  it.each([
    '.dsp-game-figure',
    '.dsp-game-meter.is-voice .dsp-footsteps-lamp-figure',
    '.dsp-footsteps-reach.is-voice',
    '.dsp-game-meter.is-ambience .dsp-footsteps-lamp-figure',
    '.dsp-footsteps-reach.is-environment',
  ])('holds %s under the ink ceiling', (selector) => {
    const [light] = value(`${LIGHT} ${selector}`, 'color');
    expect(light).toContain('min(l, var(--ink-ceiling');
  });

  it('takes the glow off every lamp and fills the voice in deep gold', () => {
    // Positive control: the lamps glow on a dark window.
    expect(value('.dsp-footsteps-lamp-fill', 'box-shadow').join(' ')).toMatch(
      /0 0 10px/,
    );
    expect(value(`${LIGHT} .dsp-footsteps-lamp-fill`, 'box-shadow')).toEqual([
      'none',
    ]);
    expect(
      value(`${LIGHT} .dsp-game-meter .dsp-footsteps-lamp-fill`, 'box-shadow'),
    ).toEqual(['none']);
    expect(
      value(
        `${LIGHT} .dsp-game-meter.is-voice .dsp-footsteps-lamp-fill`,
        'background',
      ).join(' '),
    ).toContain('var(--ink-star');
  });

  // The strip's steps band and calm, keyed in the legend: a pale grey and
  // the amber on a dark window, a cool grey and the caution ink on white,
  // as `DspFootstepsGraph.tsx` draws them.
  it('keys the steps band and the calm in inks that show on white', () => {
    expect(value('.dsp-footsteps-legend .is-steps', 'color')).toEqual([
      'rgba(206, 218, 228, 0.85)',
    ]);
    expect(value(`${LIGHT} .dsp-footsteps-legend .is-steps`, 'color')).toEqual([
      'rgba(112, 124, 134, 0.85)',
    ]);
    expect(value(`${LIGHT} .dsp-footsteps-legend .is-calmed`, 'color')).toEqual(
      ['var(--ink-caution, #ffb059)'],
    );
  });
});
