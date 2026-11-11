/* FluidEQ — GPL-3.0-or-later */

import type { TTakedownCost } from 'common/plusGallery';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { pluralCategory } from '../utils/pluralCategory';
import { creditsText } from './credits';

/** The confirmation's answer while the server is still being asked. */
export type TTakedownAsk = TTakedownCost | 'asking';

interface ITakedownWarningProps {
  /** Undefined for a scene nobody is refunded for: one of FluidEQ's own. */
  cost: TTakedownAsk | undefined;
}

/**
 * What taking a scene down does, said before the member confirms it: the
 * question, and when anybody bought the scene, that each buyer gets their
 * credit back and loses it, and what comes off the member's own balance
 * (premium 0103). Each sentence on a line of its own, which also keeps the
 * languages that put no space between sentences right.
 *
 * Nobody bought it, a server that refunds nothing yet, or a FluidEQ scene:
 * the question as it always was, which says that copies stay.
 */
export default function TakedownWarning({ cost }: ITakedownWarningProps) {
  const { t, locale } = useTranslation();
  const numbers = new Intl.NumberFormat(locale);
  const lines: string[] = [];
  if (cost === 'asking') {
    lines.push(t('plus.mine.confirmAsk'), t('plus.mine.confirmChecking'));
  } else if (cost?.known === 'unknown') {
    lines.push(t('plus.mine.confirmAsk'), t('plus.mine.confirmUnknown'));
  } else if (cost?.known === 'yes' && cost.buyers > 0) {
    lines.push(
      t('plus.mine.confirmAsk'),
      t(
        `plus.mine.confirmBuyers.${pluralCategory(cost.buyers, locale)}` as TranslationKey,
        { count: numbers.format(cost.buyers) },
      ),
    );
    if (cost.credits > 0) {
      lines.push(
        t('plus.mine.confirmEarned', {
          credits: creditsText(t, locale, cost.credits),
        }),
      );
    }
  } else {
    lines.push(t('plus.mine.confirm'));
  }
  return (
    <span
      className={`gallery-row__confirm${lines.length > 1 ? ' is-refunding' : ''}`}
      aria-live="polite"
      aria-busy={cost === 'asking'}
    >
      {lines.map((line) => (
        <span key={line} className="gallery-row__confirm-line">
          {line}
        </span>
      ))}
    </span>
  );
}
