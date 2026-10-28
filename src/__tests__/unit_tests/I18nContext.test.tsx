/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  I18nProvider,
  readInitialLocale,
  useTranslation,
} from '../../renderer/utils/I18nContext';
import LanguagePicker from '../../renderer/components/LanguagePicker';

const LanguageProbe = () => {
  const { locale, setLocale, t } = useTranslation();
  return (
    <>
      <output>{`${locale}:${t('graph.view.fullscreen')}`}</output>
      <button type="button" onClick={() => setLocale('es')}>
        Switch
      </button>
    </>
  );
};

describe('I18nProvider', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('fluideq.locale', 'en');
  });

  it('updates mounted UI and persists a selected language', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    expect(screen.getByText('en:Full screen')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Switch' }));

    expect(screen.getByText('es:Pantalla completa')).toBeTruthy();
    expect(document.documentElement.lang).toBe('es');
    expect(window.localStorage.getItem('fluideq.locale')).toBe('es');
  });

  it.each([
    ['ko', '한국어', '전체 화면'],
    ['zh-Hant', '繁體中文', '全螢幕'],
  ] as const)(
    'offers %s by its native name and remembers it on a new mount',
    async (code, name, native) => {
      const user = userEvent.setup();
      const view = render(
        <I18nProvider>
          <LanguagePicker />
          <LanguageProbe />
        </I18nProvider>,
      );
      await user.click(
        screen.getByRole('menu', { name: 'Interface language' }),
      );
      await user.click(screen.getByRole('menuitem', { name }));
      expect(await screen.findByText(`${code}:${native}`)).toBeTruthy();
      expect(document.documentElement.lang).toBe(code);
      expect(window.localStorage.getItem('fluideq.locale')).toBe(code);
      view.unmount();
      render(
        <I18nProvider>
          <LanguageProbe />
        </I18nProvider>,
      );
      expect(await screen.findByText(`${code}:${native}`)).toBeTruthy();
    },
  );

  it.each([
    [null, 'ko-KR', 'ko'],
    [null, 'zh-HK', 'zh-Hant'],
    [null, 'zh-Hant-TW', 'zh-Hant'],
    ['zh', 'zh-TW', 'zh'],
    ['zh-Hans', 'ko-KR', 'zh'],
    ['zh-Hant', 'en-US', 'zh-Hant'],
    ['ko', 'zh-TW', 'ko'],
    ['en', 'ko-KR', 'en'],
  ] as const)(
    'resolves saved %s before OS %s without rewriting the preference',
    (stored, system, expected) => {
      if (stored === null) {
        window.localStorage.removeItem('fluideq.locale');
      } else {
        window.localStorage.setItem('fluideq.locale', stored);
      }
      jest.spyOn(navigator, 'language', 'get').mockReturnValue(system);
      expect(readInitialLocale()).toBe(expected);
      expect(window.localStorage.getItem('fluideq.locale')).toBe(stored);
    },
  );
});
