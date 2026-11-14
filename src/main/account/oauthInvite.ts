import { translate, type LocaleCode } from '../../common/i18n';
import { pluralCategory } from '../../renderer/utils/pluralCategory';
import type { IOAuthInvite } from './oauthPage';

/**
 * What the sign-in tab invites with: the coin's count and the line under it,
 * in the reader's own plural form ("1 free credit", Russian's "5 бесплатных
 * кредитов"). The locale must already be loaded; an unloaded one reads as
 * English.
 */
const oauthInvite = (locale: LocaleCode, count: number): IOAuthInvite => ({
  count,
  line: translate(
    locale,
    `account.google.doneInvite.${pluralCategory(count, locale)}`,
    { count },
  ),
});

export default oauthInvite;
