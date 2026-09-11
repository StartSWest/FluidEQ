import { ACCOUNT_CONFIG, IAccountConfig } from 'common/accountConfig';
import type { Translate } from 'common/i18n';

/**
 * What Plus costs, in the reader's language: "$5 / month", or
 * "$5 / month or $40 / year" when the build offers a yearly plan.
 *
 * One sentence for the Plus card and the terms both, so the offer and the
 * text a person agrees to can never quote different prices.
 */
const plusPriceText = (
  t: Translate,
  config: IAccountConfig = ACCOUNT_CONFIG,
): string => {
  const monthly = t('account.plus.perMonth', { price: config.plusPrice });
  if (!config.plusYearlyPrice) {
    return monthly;
  }
  return t('account.plus.priceChoice', {
    monthly,
    yearly: t('account.plus.perYear', { price: config.plusYearlyPrice }),
  });
};

export default plusPriceText;
