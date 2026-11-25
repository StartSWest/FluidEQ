/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What's New 2.6's first page is the window (Ivan, 2026-11-25: "the new
 * windows, the light and black we show, need to cover the whole scene. I
 * don't like the text on the top right like that"): one head on the left,
 * the split window under it with what to do as its caption, and nothing
 * else. The six chapter cards it used to end on are the rail's to list.
 * How large the window is drawn is the stylesheet's, measured on screen.
 */

import '@testing-library/jest-dom';
import { render, within } from '@testing-library/react';
import { WindowSlide } from '../../../renderer/components/featureTour/release26';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

it('stands the kicker, title and lead together in one head', () => {
  const view = render(<WindowSlide />);
  const head = view.container.querySelector('.tour-lit__opener');
  expect(head).not.toBeNull();
  const inHead = within(head as HTMLElement);
  expect(inHead.getByText('tour.v26.window.kicker')).toBeInTheDocument();
  expect(
    inHead.getByRole('heading', { name: 'tour.v26.window.title' }),
  ).toBeInTheDocument();
  expect(inHead.getByText('tour.v26.window.lead')).toBeInTheDocument();
  // The hint is the window's, not the head's.
  expect(inHead.queryByText('tour.v26.window.hint')).toBeNull();
});

it('captions the split window with what to do with its handle', () => {
  const view = render(<WindowSlide />);
  const figure = view.getByRole('figure');
  expect(within(figure).getByRole('slider')).toBeInTheDocument();
  expect(figure.querySelector('figcaption')).toHaveTextContent(
    'tour.v26.window.hint',
  );
});

it('ends on the window, with no cards to the slides after it', () => {
  const view = render(<WindowSlide />);
  expect(view.queryAllByRole('button')).toHaveLength(0);
  expect(view.queryByRole('navigation')).toBeNull();
});
