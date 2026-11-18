/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Tint's two swatches (Ivan, 2026-11-18: "I need to be able to also
 * select the secondary colour in the picker, so I have control of both
 * colours"; "by default the primary and the secondary have the same colour,
 * and if the user changes it, the gradient is created"). The second follows
 * the first, drawn as a ring of it with a plus, until a colour is picked
 * there; then it is filled, with a small cross that gives back one colour.
 * Each picker updates the window on a painted frame's rest and at once when
 * it settles (`useLiveSlider`).
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
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

/** The swatch's picker settling on `hex`, as the system picker says it. */
const settle = (
  rtl: typeof TestingLibrary,
  input: HTMLElement,
  hex: string,
) => {
  rtl.fireEvent.change(input, { target: { value: hex } });
  rtl.act(() => {
    input.dispatchEvent(new Event('change'));
  });
};

afterEach(() => {
  mounted?.cleanup();
  mounted = undefined;
  window.localStorage.clear();
});

describe('the Tint’s second swatch', () => {
  it('follows the first colour until a colour is picked there', () => {
    const rtl = mount({ 'fluideq.windowTintColour': '#40c0a0' });
    const second = rtl.screen.getByLabelText('graph.windowTintSecond');
    expect(second).toHaveValue('#40c0a0');
    expect(second.closest('label')).toHaveClass(
      'graph-view-menu__swatch--follows',
    );
    expect(
      rtl.screen.queryByRole('button', { name: 'graph.windowTintOneColour' }),
    ).toBeNull();
  });

  it('keeps a colour picked there, filled, with a cross back to one colour', () => {
    const rtl = mount({ 'fluideq.windowTintColour': '#40c0a0' });
    const second = rtl.screen.getByLabelText('graph.windowTintSecond');
    settle(rtl, second, '#D03F8A');
    expect(window.localStorage.getItem('fluideq.windowTintSecondary')).toBe(
      '#d03f8a',
    );
    expect(second).toHaveValue('#d03f8a');
    expect(second.closest('label')).not.toHaveClass(
      'graph-view-menu__swatch--follows',
    );
    // The first is left as it was.
    expect(rtl.screen.getByLabelText('graph.windowTintPick')).toHaveValue(
      '#40c0a0',
    );

    rtl.fireEvent.click(
      rtl.screen.getByRole('button', { name: 'graph.windowTintOneColour' }),
    );
    expect(
      window.localStorage.getItem('fluideq.windowTintSecondary'),
    ).toBeNull();
    expect(second).toHaveValue('#40c0a0');
  });

  it('keeps the second where it was put when the first colour moves', () => {
    const rtl = mount({
      'fluideq.windowTintColour': '#40c0a0',
      'fluideq.windowTintSecondary': '#d03f8a',
    });
    settle(rtl, rtl.screen.getByLabelText('graph.windowTintPick'), '#ff8800');
    expect(window.localStorage.getItem('fluideq.windowTintColour')).toBe(
      '#ff8800',
    );
    expect(rtl.screen.getByLabelText('graph.windowTintSecond')).toHaveValue(
      '#d03f8a',
    );
  });
});
