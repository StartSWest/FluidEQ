/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the beat game hands its stylesheet: the verdict line's two longest
 * messages, which the line keeps invisibly in its own cell so the Share
 * button under it never moves (Ivan, 2026-10-25: "ui bug 2 lines push
 * down"), and the wave's colours, the palette Colourful mode is in rather
 * than five written-in ones. The stylesheet's half is in
 * `colourfulModeColours.test.ts`.
 */

import { render } from '@testing-library/react';
import { loadLocale, translate } from 'common/i18n';
import RhythmGame from 'renderer/components/RhythmGame';
import { I18nProvider } from 'renderer/utils/I18nContext';

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioFrame: () => ({ points: [], graphPoints: [] }),
  useLiveAudioControl: () => ({ isActive: false, isPaused: false }),
  useLiveAudioCapture: () => undefined,
}));

const renderGame = () =>
  render(
    <I18nProvider>
      <RhythmGame />
    </I18nProvider>,
  );

describe('the beat game’s markup', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('hands the verdict line its two longest messages, in the language on screen', async () => {
    await loadLocale('de');
    window.localStorage.setItem('fluideq.locale', 'de');
    const view = renderGame();
    const line = view.container.querySelector('.rhythm-game__verdict');
    expect(line?.getAttribute('data-hint')).toBe(
      translate('de', 'support.game.hint'),
    );
    expect(line?.getAttribute('data-listening')).toBe(
      translate('de', 'support.game.listening'),
    );
    // What is on show sits in the row, the one cell the copies share.
    expect(
      line?.querySelector(':scope > .rhythm-game__verdict-row'),
    ).not.toBeNull();
  });

  it('hands its wave the palette in use, never a colour written in', () => {
    const view = renderGame();
    ['#rhythm-line', '#rhythm-fill'].forEach((id) => {
      const stops = [
        ...view.container.querySelectorAll<SVGStopElement>(`${id} stop`),
      ];
      expect(
        stops.map((stop) => stop.style.getPropertyValue('--stop-colour')),
      ).toEqual([
        'var(--rainbow-1)',
        'var(--rainbow-3)',
        'var(--rainbow-4)',
        'var(--rainbow-5)',
        'var(--rainbow-7)',
      ]);
      stops.forEach((stop) => {
        expect(stop.getAttribute('stop-color')).toBeNull();
      });
    });
  });
});
