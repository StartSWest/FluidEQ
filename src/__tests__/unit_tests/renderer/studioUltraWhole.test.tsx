/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The ultra-wide frame's "Whole picture" switch (`StudioUltraWideFrame`;
 * Ivan, 2026-11-13: "there is not a good way to see the overflow"): one
 * press lifts the veil in every place the view is drawn, and the scene's
 * own hands still hear every press but the switch's.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import StudioUltraWideFrame from '../../../renderer/studio/StudioUltraWideFrame';
import { resetUltraWholeForTesting } from '../../../renderer/studio/studioUltraWhole';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

beforeEach(() => resetUltraWholeForTesting());

const frames = () => [...document.querySelectorAll('.studio-ultra-frame')];

it('veils the outside and names it until the switch is pressed', () => {
  render(<StudioUltraWideFrame />);
  const whole = screen.getByRole('button', { name: 'studio.stage.ultraWhole' });
  expect(whole).toHaveAttribute('aria-pressed', 'false');
  expect(frames()[0]).not.toHaveClass('is-whole');
  expect(screen.getByText('studio.stage.ultraRest')).toBeInTheDocument();

  fireEvent.click(whole);
  expect(whole).toHaveAttribute('aria-pressed', 'true');
  expect(frames()[0]).toHaveClass('is-whole');
  // The veil's own words go with it; the band keeps its name.
  expect(screen.queryByText('studio.stage.ultraRest')).toBeNull();
  expect(screen.getByText('studio.stage.ultraBand')).toBeInTheDocument();

  fireEvent.click(whole);
  expect(frames()[0]).not.toHaveClass('is-whole');
  expect(screen.getByText('studio.stage.ultraRest')).toBeInTheDocument();
});

it('holds one answer for every place the view is drawn', () => {
  // The stage's frame and the publish dialog's, both on screen.
  render(
    <>
      <StudioUltraWideFrame />
      <StudioUltraWideFrame />
    </>,
  );
  const [first, second] = screen.getAllByRole('button', {
    name: 'studio.stage.ultraWhole',
  });
  fireEvent.click(first);
  expect(second).toHaveAttribute('aria-pressed', 'true');
  frames().forEach((frame) => expect(frame).toHaveClass('is-whole'));
});

it('has nothing to press or read out but the switch', () => {
  render(<StudioUltraWideFrame />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  // The band and the words on the veil are a picture over the scene.
  expect(document.querySelector('.studio-ultra-frame__band')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  expect(screen.getByText('studio.stage.ultraRest')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
});
