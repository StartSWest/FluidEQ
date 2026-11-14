import { loadLocale } from '../../../common/i18n';
import oauthInvite from '../../../main/account/oauthInvite';

// The sign-in tab's invitation, read from the real dictionaries: the coin's
// count, and the line in the reader's own plural form. At today's three
// credits every language happens to read the same in "few" and "other", so
// the counts below are the ones where the forms part.
beforeAll(() => Promise.all([loadLocale('ru'), loadLocale('es')]));

it('says one credit in the singular', () => {
  expect(oauthInvite('en', 1)).toEqual({
    count: 1,
    line: 'New accounts start with 1 free credit to spend on scenes in FluidEQ.',
  });
});

it('says three credits in the plural', () => {
  expect(oauthInvite('es', 3).line).toBe(
    'Las cuentas nuevas empiezan con 3 créditos gratis para escenas de FluidEQ.',
  );
});

it('follows each language past two forms', () => {
  expect(oauthInvite('ru', 3).line).toContain('3 бесплатных кредита ');
  expect(oauthInvite('ru', 5).line).toContain('5 бесплатных кредитов ');
  expect(oauthInvite('ru', 21).line).toContain('21 бесплатный кредит ');
});
