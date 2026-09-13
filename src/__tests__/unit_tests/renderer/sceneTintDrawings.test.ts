/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What keeps a resting look of its own and takes a Plus scene's colours only
 * while the scene lends them: the titlebar wave and the level meter, the
 * DSP graphs' second and third colours, the knobs, and the graph's backdrop
 * while a scene loads.
 */

import { baseCurveInk, spectrumInk } from '../../../renderer/dsp/dspInks';
import {
  isSceneTinted,
  tintedSpectrumHue,
  tintedStops,
} from '../../../renderer/utils/sceneAccentRamp';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const root = document.documentElement;

/** A scene's tint as the store paints it: tokens inline, and the mark. */
const tint = (tokens: Record<string, string>) => {
  Object.entries(tokens).forEach(([name, value]) =>
    root.style.setProperty(name, value),
  );
  root.setAttribute('data-scene-tint', '');
};

afterEach(() => {
  root.removeAttribute('style');
  root.removeAttribute('data-scene-tint');
});

const RESTING = [
  { offset: 0, colour: '#005b7f' },
  { offset: 1, colour: '#c8fff8' },
];

describe('the drawings’ resting colours', () => {
  it('keep their own colours with no scene tinting the window', () => {
    root.style.setProperty('--accent', '#ff66cc');
    expect(isSceneTinted()).toBe(false);
    expect(tintedStops(RESTING, [{ role: 'darker' }, { role: 'light' }])).toBe(
      RESTING,
    );
    const flat = (across: number) => 184 + across * 112;
    expect(tintedSpectrumHue(flat)).toBe(flat);
  });

  it('take the scene’s accents in the same roles while it tints the window, alpha kept', () => {
    tint({ '--accent-darker': '#5a1040', '--accent-light': '#ffd0ee' });
    const stops = tintedStops(RESTING, [
      { role: 'darker' },
      { role: 'light', alpha: 0.42 },
    ]);
    expect(stops).toEqual([
      { offset: 0, colour: '#5a1040' },
      { offset: 1, colour: 'rgba(255, 208, 238, 0.42)' },
    ]);
    // Asked again every frame, answered with the same array.
    expect(
      tintedStops(RESTING, [
        { role: 'darker' },
        { role: 'light', alpha: 0.42 },
      ]),
    ).toBe(stops);
  });

  it('sweep the spectrum bars round the scene’s accent instead of cyan into violet', () => {
    tint({ '--accent': '#ff0000' });
    const hue = tintedSpectrumHue((across) => 184 + across * 112);
    const middle = hue(0.5, 0);
    expect(Math.min(middle, 360 - middle)).toBeLessThan(5);
    expect(hue(1, 0) - hue(0, 0)).not.toBe(112);
  });
});

describe('the DSP graphs’ colours', () => {
  it('read their tokens as channels, and their own colour without one', () => {
    expect(baseCurveInk()).toBe('64, 214, 200');
    root.style.setProperty('--dsp-base-curve', '#a4c8ff');
    root.style.setProperty('--dsp-spectrum', '#123456');
    expect(baseCurveInk()).toBe('164, 200, 255');
    expect(spectrumInk()).toBe('18, 52, 86');
  });

  const app = styleRules(compileStylesheet('App.scss'));
  const declared = (selector: string, name: string) =>
    app
      .find(
        ({ selectors, declarations }) =>
          selectors.includes(selector) && declarations.has(name),
      )
      ?.declarations.get(name);

  it.each([
    ['--dsp-base-curve', '#40d6c8', 'var(--active)'],
    ['--dsp-contrast', '#ffb059', 'var(--active)'],
    ['--dsp-output', '#ffffff', 'var(--active)'],
    ['--dsp-applied', '#c58af9', 'var(--accent)'],
    ['--dsp-sky', '#54c8ff', 'var(--accent-light)'],
    ['--dsp-field', '#96cdff', 'var(--active)'],
    ['--dsp-spectrum', 'var(--accent)', 'var(--active)'],
  ])(
    '%s is %s at rest and the scene’s %s under its tint',
    (name, resting, tinted) => {
      expect(declared(':root', name)).toBe(resting);
      expect(declared(':root[data-scene-tint]', name)).toBe(tinted);
    },
  );
});

describe('the knob', () => {
  const rules = styleRules(compileStylesheet('Knob.scss'));
  const stopColour = (fragment: string, tinted: boolean) =>
    rules
      .find(({ selectors }) =>
        selectors.some(
          (selector) =>
            selector.endsWith(fragment) &&
            selector.startsWith(':root[data-scene-tint]') === tinted,
        ),
      )
      ?.declarations.get('stop-color');

  it('keeps its slate at rest and is built from the scene’s field under its tint', () => {
    expect(stopColour('.knob__stop--body-top', false)).toBe('#33637e');
    expect(stopColour('.knob__stop--body-top', true)).toMatch(
      /^color-mix\(in oklab, var\(--surface-field\), var\(--accent-light\) \d+%\)$/,
    );
    expect(stopColour('.knob__stop--face-edge', true)).toContain(
      'var(--surface-field)',
    );
  });
});

describe('the graph while a scene loads', () => {
  const rules = styleRules(compileStylesheet('GraphTheme.scss'));
  const backdrop = (selector: string) =>
    rules.find(({ selectors }) => selectors.includes(selector))?.declarations;

  it('puts its backdrop up at once and only fades it out after the scene has faded in', () => {
    // A backdrop that faded in let the chart's lighter card show through
    // between two scenes: a flash on every switch.
    const resting = rules
      .filter(({ selectors }) => selectors.includes('.chart-scene-backdrop'))
      .map(({ declarations }) => declarations.get('transition'))
      .filter(Boolean);
    expect(resting).toEqual([]);
    expect(
      backdrop('.chart-scene-backdrop.is-settled')?.get('transition'),
    ).toMatch(/^opacity \d+ms .+ \d+ms$/);
  });
});
