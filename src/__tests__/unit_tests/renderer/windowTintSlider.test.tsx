/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Tint's two swatches (Ivan, 2026-11-18: "I need to be able to also
 * select the secondary colour in the picker, so I have control of both
 * colours"; "by default the primary and the secondary have the same colour,
 * and if the user changes it, the gradient is created"). Each opens FluidEQ's
 * own colour picker, the Studio's, with Accept and Cancel ("use the same
 * colour picker we did for the Studio in the app settings"). The second
 * follows the first, drawn as a ring of it with a plus, until a colour is
 * picked there; then it is filled, with a small cross that gives back one
 * colour. Cancel puts the Tint back as it stood when the picker opened.
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/** The renderer of the last mount, to clean up after each case. */
let mounted: typeof TestingLibrary | undefined;

/** The slider and its store, from a registry that has read `stored`. */
const mount = (stored: Record<string, string> = {}) => {
  window.localStorage.clear();
  Object.entries(stored).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let rtl: typeof TestingLibrary | undefined;
  let Slider: (() => ReactElement) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh store per mount */
    rtl = require('@testing-library/react/pure');
    Slider = require('renderer/graph/WindowTintSlider').default;
    /* eslint-enable global-require */
  });
  mounted = rtl;
  if (!rtl || !Slider) {
    throw new Error('the slider did not load');
  }
  const View = Slider;
  rtl.render(<View />);
  return rtl;
};

/** The colour a swatch wears, as its own style says it. */
const worn = (swatch: HTMLElement) => swatch.style.getPropertyValue('--swatch');

/** Opens `swatch`'s picker, types `hex` into it and presses `button`. */
const pick = (
  rtl: typeof TestingLibrary,
  swatch: HTMLElement,
  hex: string,
  button: 'accept' | 'cancel',
) => {
  rtl.fireEvent.click(swatch);
  const picker = rtl.screen.getByRole('dialog');
  rtl.fireEvent.change(
    rtl.within(picker).getByLabelText('graph.sceneColours.hex'),
    { target: { value: hex } },
  );
  rtl.fireEvent.click(
    rtl.within(picker).getByRole('button', {
      name: `graph.sceneColours.${button}`,
    }),
  );
};

afterEach(() => {
  mounted?.cleanup();
  mounted = undefined;
  window.localStorage.clear();
});

describe('the Tint’s second swatch', () => {
  it('follows the first colour until a colour is picked there', () => {
    const rtl = mount({ 'fluideq.windowTintColour': '#40c0a0' });
    const second = rtl.screen.getByRole('button', {
      name: 'graph.windowTintSecond',
    });
    expect(worn(second)).toBe('#40c0a0');
    expect(second).toHaveClass('graph-view-menu__swatch--follows');
    expect(
      rtl.screen.queryByRole('button', { name: 'graph.windowTintOneColour' }),
    ).toBeNull();
  });

  it('keeps a colour accepted there, filled, with a cross back to one colour', () => {
    const rtl = mount({ 'fluideq.windowTintColour': '#40c0a0' });
    const second = rtl.screen.getByRole('button', {
      name: 'graph.windowTintSecond',
    });
    pick(rtl, second, '#D03F8A', 'accept');
    expect(window.localStorage.getItem('fluideq.windowTintSecondary')).toBe(
      '#d03f8a',
    );
    expect(worn(second)).toBe('#d03f8a');
    expect(second).not.toHaveClass('graph-view-menu__swatch--follows');
    // The first is left as it was.
    expect(
      worn(rtl.screen.getByRole('button', { name: 'graph.windowTintPick' })),
    ).toBe('#40c0a0');

    rtl.fireEvent.click(
      rtl.screen.getByRole('button', { name: 'graph.windowTintOneColour' }),
    );
    expect(
      window.localStorage.getItem('fluideq.windowTintSecondary'),
    ).toBeNull();
    expect(worn(second)).toBe('#40c0a0');
  });

  it('puts the Tint back as it stood when the picker is cancelled', () => {
    const rtl = mount({ 'fluideq.windowTintColour': '#40c0a0' });
    const second = rtl.screen.getByRole('button', {
      name: 'graph.windowTintSecond',
    });
    pick(rtl, second, '#D03F8A', 'cancel');
    expect(
      window.localStorage.getItem('fluideq.windowTintSecondary'),
    ).toBeNull();
    expect(second).toHaveClass('graph-view-menu__swatch--follows');
    // The control: Accept on the same colour keeps it.
    pick(rtl, second, '#D03F8A', 'accept');
    expect(window.localStorage.getItem('fluideq.windowTintSecondary')).toBe(
      '#d03f8a',
    );
  });

  it('keeps the second where it was put when the first colour moves', () => {
    const rtl = mount({
      'fluideq.windowTintColour': '#40c0a0',
      'fluideq.windowTintSecondary': '#d03f8a',
    });
    pick(
      rtl,
      rtl.screen.getByRole('button', { name: 'graph.windowTintPick' }),
      '#ff8800',
      'accept',
    );
    expect(window.localStorage.getItem('fluideq.windowTintColour')).toBe(
      '#ff8800',
    );
    expect(
      worn(rtl.screen.getByRole('button', { name: 'graph.windowTintSecond' })),
    ).toBe('#d03f8a');
  });
});
