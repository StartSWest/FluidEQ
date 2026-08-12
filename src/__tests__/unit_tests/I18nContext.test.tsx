/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useTranslation } from '../../renderer/utils/I18nContext';

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
});
