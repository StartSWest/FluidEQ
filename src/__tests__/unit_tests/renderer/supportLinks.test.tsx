/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { LOCALES, loadLocale, translate } from 'common/i18n';
import { SUPPORT_CONFIG } from 'common/support';
import AboutDialog from 'renderer/components/AboutDialog';
import SupportDialog from 'renderer/SupportDialog';
import { I18nProvider } from 'renderer/utils/I18nContext';
import installFakeIpcRenderer from '../../utils/fakeIpcRenderer';

// The real support UI renders against a silent audio boundary, without
// starting capture or requiring the app's hardware/provider hierarchy.
jest.mock('renderer/audio/LiveAudioContext', () => {
  const frame = { waveform: [], points: [], outputLevels: undefined };
  const control = { isActive: false, isPaused: false };
  return {
    useLiveAudioFrame: () => frame,
    useLiveAudioControl: () => control,
    useLiveAudioCapture: jest.fn(),
  };
});

const COFFEE = 'https://www.buymeacoffee.com/startswest';
const SPONSOR = 'https://github.com/sponsors/StartSWest';
const originalCoffee = SUPPORT_CONFIG.coffeeUrl;

const panels = [
  { name: 'About', render: () => <AboutDialog onClose={jest.fn()} /> },
  {
    name: 'Support',
    render: () => (
      <SupportDialog
        hasContributed={false}
        onContributed={jest.fn()}
        onResetContribution={jest.fn()}
        onClose={jest.fn()}
        onShowReleaseNotes={jest.fn()}
      />
    ),
  },
];

beforeAll(() => Promise.all(LOCALES.map(({ code }) => loadLocale(code))));
beforeEach(() => {
  installFakeIpcRenderer();
  window.localStorage.clear();
  SUPPORT_CONFIG.coffeeUrl = COFFEE;
});
afterEach(() => {
  SUPPORT_CONFIG.coffeeUrl = originalCoffee;
});

describe.each(panels)('$name support links', ({ render: panel }) => {
  it.each(LOCALES)(
    'keeps coffee first and offers Sponsors in $code',
    ({ code }) => {
      window.localStorage.setItem('fluideq.locale', code);
      const view = render(<I18nProvider>{panel()}</I18nProvider>);
      const coffee = screen.getByRole('link', {
        name: translate(code, 'support.coffee'),
      });
      const sponsor = screen.getByRole('link', {
        name: translate(code, 'support.github'),
      });
      expect(coffee).toHaveAttribute('href', COFFEE);
      expect(coffee).toHaveClass('button', 'small');
      expect(coffee).not.toHaveClass('subtle');
      expect(
        screen.getByRole('img', { name: translate(code, 'support.qr.coffee') }),
      ).toHaveAttribute('width', '168');
      expect(sponsor).toHaveAttribute('href', SPONSOR);
      expect(sponsor).toHaveAttribute('target', '_blank');
      expect(sponsor).toHaveAttribute('rel', 'noreferrer noopener');
      expect(sponsor).toHaveClass('subtle');
      const links = screen.getAllByRole('link');
      expect(links.indexOf(coffee)).toBeLessThan(links.indexOf(sponsor));
      expect(view.container.querySelector('iframe, webview')).toBeNull();

      // Opening the optional support destination must not unlock anything or
      // change preferences. Stop jsdom's navigation after the event propagates.
      const before = JSON.stringify(window.localStorage);
      const stopNavigation = (event: MouseEvent) => event.preventDefault();
      document.addEventListener('click', stopNavigation);
      fireEvent.click(sponsor);
      document.removeEventListener('click', stopNavigation);
      expect(JSON.stringify(window.localStorage)).toBe(before);
    },
  );

  it('still offers Sponsors in a build with no coffee destination', () => {
    SUPPORT_CONFIG.coffeeUrl = '';
    render(panel());
    expect(
      screen.getByRole('link', { name: 'Sponsor on GitHub' }),
    ).toHaveAttribute('href', SPONSOR);
    expect(screen.queryByRole('link', { name: 'Buy me a coffee' })).toBeNull();
    expect(screen.queryByRole('img', { name: /coffee/i })).toBeNull();
  });
});
