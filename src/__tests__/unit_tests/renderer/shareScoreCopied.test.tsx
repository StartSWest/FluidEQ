/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { translate } from 'common/i18n';
import ShareScoreCard from 'renderer/components/ShareScoreCard';
import { I18nProvider } from 'renderer/utils/I18nContext';

/**
 * Every timer this replaced would still be pending here. A helper, so the
 * check can run after each test without being an `expect` in a hook.
 */
const expectNothingScheduled = () => expect(jest.getTimerCount()).toBe(0);

const endAnimation = (target: Element, animationName: string) => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  fireEvent(target, event);
};

/**
 * "Copied" stays until its own hold ends — not on a clock. Time alone leaves
 * it up with nothing scheduled (the null; a 1.6 s timer took it down before),
 * and the hold's end puts the button's label back (the positive control).
 */
describe('the share card’s copy confirmation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    // jsdom draws no canvas, and says so on the console; the card is not the
    // subject here.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    expectNothingScheduled();
    jest.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
    jest.useRealTimers();
  });

  it('says it copied until its own hold ends', async () => {
    render(
      <I18nProvider>
        <ShareScoreCard
          score={120}
          multiplier={2}
          isEuphoric={false}
          onClose={() => {}}
        />
      </I18nProvider>,
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: translate('en', 'support.game.shareCopy'),
        }),
      );
      await Promise.resolve();
    });
    const said = screen.getByText(translate('en', 'support.game.shareCopied'));

    act(() => jest.advanceTimersByTime(60_000));
    endAnimation(said, 'rhythm-verdict');
    expect(said).toBeInTheDocument();

    endAnimation(said, 'share-score-copied');
    expect(
      screen.queryByText(translate('en', 'support.game.shareCopied')),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: translate('en', 'support.game.shareCopy'),
      }),
    ).toBeInTheDocument();
  });
});
