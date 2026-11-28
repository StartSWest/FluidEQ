/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The tool row's last fit, Auto EQ's own name given up (2026-11-28): in
 * French the amp's "Égalisation auto" ran 39 px off the row's end with every
 * other word already gone. The row reaches that fit only when nothing short
 * of it fits, so English, German and Russian keep the word; there the name is
 * hidden from sight and kept for a screen reader, whole on the key's tooltip.
 *
 * jsdom lays nothing out, so the tools' width is stood in for, per fit, the
 * way the amp measured it in the harness.
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import useToolRowFit from 'renderer/eq/useToolRowFit';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

/** The amp's tool slot at its one width. */
const SLOT = 452;

const Row = () => {
  const row = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  useToolRowFit(row, slot, tools);
  return (
    <div className="eq-layer-tabs" ref={row}>
      <div className="eq-layer-tabs__slot" ref={slot}>
        <div className="eq-layer-tabs__tools" ref={tools} />
      </div>
    </div>
  );
};

/** Each fit's width of the tools, as the row is tried at it. */
const fitAt = (widths: Record<string, number>): string | undefined => {
  const offsetWidth = jest
    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function measured(this: HTMLElement) {
      const fit = this.closest<HTMLElement>('.eq-layer-tabs')?.dataset.fit;
      return fit === undefined ? 0 : (widths[fit] ?? 0);
    });
  const clientWidth = jest
    .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockImplementation(() => SLOT);
  const { container, unmount } = render(<Row />);
  const fit =
    container.querySelector<HTMLElement>('.eq-layer-tabs')?.dataset.fit;
  unmount();
  offsetWidth.mockRestore();
  clientWidth.mockRestore();
  return fit;
};

// The amp's row as measured (2026-11-28): every fit before the glyphs is
// wider still, so only the last three are given.
const WIDE = 900;
const french = {
  full: WIDE,
  uncaptioned: WIDE,
  'quiet-bands': WIDE,
  'bare-tabs': WIDE,
  icons: 534,
  'icon-tabs': 491,
  'icon-auto': 416,
};
const english = { ...french, icons: 455, 'icon-tabs': 446, 'icon-auto': 384 };

it('gives up Auto EQ’s name only where nothing short of it fits', () => {
  expect(fitAt(french)).toBe('icon-auto');
  expect(fitAt(english)).toBe('icon-tabs');
});

it('hides the name from sight at that fit, never from a screen reader', () => {
  const rules = styleRules(compileStylesheet('EqLayers.scss')).filter(
    ({ selectors }) =>
      selectors.some(
        (selector) =>
          selector.includes('icon-auto') && selector.endsWith('.eq-auto__name'),
      ),
  );
  expect(rules).toHaveLength(1);
  const [{ declarations, selectors }] = rules;
  // Clipped in place (`words-hidden`), not `display: none`.
  expect(declarations.get('position')).toBe('absolute');
  expect(declarations.get('clip-path')).toBe('inset(50%)');
  expect(declarations.has('display')).toBe(false);
  // At that fit alone: no other fit's selector shares the rule.
  expect(
    selectors.every((selector) => !/icons\b|icon-tabs/.test(selector)),
  ).toBe(true);
});
